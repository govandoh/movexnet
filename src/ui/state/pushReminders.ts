import { useEffect, useState, useSyncExternalStore } from 'react';
import { loadPushRepository, vapidPublicKey } from '../../api-client/index.ts';
import { pushReminderItems, reminderTimes } from '../../domain/calendar';
import type { PushSubscriptionInfo } from '../../domain/ports.ts';
import { useAccount } from './accountStore';
import { useAppState } from './appStore';
import { useProgram, useProgramSessions } from './useProgram';

/**
 * Recordatorios con la app cerrada por Web Push (issue #88, DEC-080).
 *
 * El navegador se suscribe al servicio de push con la clave pública VAPID y la suscripción se
 * guarda en la cuenta. Cada vez que cambian el programa, el historial o la hora, se suben los
 * avisos de los próximos 14 días (`pushReminderItems`); los envía la Edge Function
 * `send-reminders`. Mientras el push está activo, el aviso local de `reminders.ts` no corre.
 *
 * Sin cuenta o sin clave VAPID no hay push: queda el aviso local y nada sale del dispositivo.
 * En iOS solo existe con la PWA instalada (iOS 16.4 o más).
 */

/** Espera tras un cambio antes de subir: varias series seguidas suben una sola vez. */
const UPLOAD_DELAY_MS = 1500;
/** `serviceWorker.ready` no resuelve si no hay service worker (dev): se acota la espera. */
const SW_READY_TIMEOUT_MS = 5000;
/** Reintentos tras un fallo (red, servicio de push), con esta espera creciente. */
const RETRY_MS = [30_000, 120_000, 600_000];

let active = false;
const listeners = new Set<() => void>();
/** Endpoint y cuenta ya registrados en esta apertura de la app. */
let registered: { endpoint: string; userId: string } | null = null;
/** Último contenido subido por endpoint: evita subir lo mismo en cada render. */
let lastUpload: string | null = null;
/** Suscripción en curso: el toque de Perfil y la subida no deben suscribir a la vez. */
let inflight: { userId: string; promise: Promise<string | null> } | null = null;

function setActive(next: boolean): void {
  if (active === next) return;
  active = next;
  for (const l of listeners) l();
}

/** Si los avisos del programa llegan por push en este navegador. */
export function usePushActive(): boolean {
  return useSyncExternalStore(
    cb => { listeners.add(cb); return () => listeners.delete(cb); },
    () => active,
  );
}

/** Este navegador puede recibir avisos con la app cerrada y la app tiene clave VAPID. */
export function pushAvailable(): boolean {
  return vapidPublicKey() !== null && typeof window !== 'undefined'
    && 'serviceWorker' in navigator && 'PushManager' in window;
}

function keyBytes(b64url: string): Uint8Array<ArrayBuffer> {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const bin = atob(b64 + '='.repeat((4 - (b64.length % 4)) % 4));
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** Una suscripción hecha con otra clave VAPID (rotada) no recibe nada: hay que rehacerla. */
function sameKey(sub: PushSubscription, key: Uint8Array): boolean {
  const current = sub.options?.applicationServerKey;
  if (!current) return true;
  const a = new Uint8Array(current);
  return a.length === key.length && a.every((b, i) => b === key[i]);
}

function toInfo(sub: PushSubscription): PushSubscriptionInfo | null {
  const json = sub.toJSON();
  if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return null;
  return { endpoint: json.endpoint, p256dh: json.keys.p256dh, auth: json.keys.auth, userAgent: navigator.userAgent || null };
}

async function readyRegistration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null;
  return Promise.race([
    navigator.serviceWorker.ready,
    new Promise<null>(resolve => window.setTimeout(() => resolve(null), SW_READY_TIMEOUT_MS)),
  ]);
}

/**
 * Suscribe este navegador (si hace falta) y lo registra en la cuenta. Requiere el permiso de
 * notificaciones ya concedido; en iOS conviene llamarlo desde el toque que lo pidió.
 */
export function subscribePush(userId: string): Promise<string | null> {
  if (inflight?.userId === userId) return inflight.promise;
  const promise = doSubscribe(userId).finally(() => {
    if (inflight?.promise === promise) inflight = null;
  });
  inflight = { userId, promise };
  return promise;
}

async function doSubscribe(userId: string): Promise<string | null> {
  const key = vapidPublicKey();
  if (!key || !pushAvailable()) return null;
  const repo = await loadPushRepository();
  const reg = await readyRegistration();
  if (!repo || !reg) return null;
  const bytes = keyBytes(key);
  let sub = await reg.pushManager.getSubscription();
  if (sub && !sameKey(sub, bytes)) {
    await sub.unsubscribe().catch(() => false);
    sub = null;
  }
  sub ??= await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: bytes });
  const info = toInfo(sub);
  if (!info) return null;
  if (registered?.endpoint !== info.endpoint || registered.userId !== userId) {
    await repo.register(info);
    registered = { endpoint: info.endpoint, userId };
    lastUpload = null;
  }
  return info.endpoint;
}

/**
 * Baja de este navegador: borra la suscripción de la cuenta (y sus avisos, en cascada) y la
 * anula en el navegador. Sin red o sin sesión se anula igual: el endpoint queda muerto y el
 * siguiente envío recibe 410 y borra la fila (DEC-080 §6).
 */
export async function unsubscribePush(): Promise<void> {
  setActive(false);
  registered = null;
  lastUpload = null;
  if (!('serviceWorker' in navigator)) return;
  const reg = await navigator.serviceWorker.getRegistration().catch(() => undefined);
  const sub = await reg?.pushManager?.getSubscription().catch(() => null);
  if (!sub) return;
  try {
    await (await loadPushRepository())?.unregister(sub.endpoint);
  } catch {
    // Sin red o sin sesión: lo limpia el 410 del siguiente envío.
  }
  await sub.unsubscribe().catch(() => false);
}

/** Mantiene los avisos del servidor al día. Se monta una vez, en `AppShell`. */
export function usePushReminders(): void {
  const { reminders, history, questionnaire } = useAppState();
  const account = useAccount();
  const now = new Date();
  const program = useProgram(now);
  const sessions = useProgramSessions(now);
  const userId = account.status === 'signed_in' ? account.user?.id ?? null : null;
  const [attempt, setAttempt] = useState(0);
  // Sin importar reminders.ts, que ya importa este módulo (`usePushActive`).
  const granted = typeof Notification !== 'undefined' && Notification.permission === 'granted';
  const wanted = userId !== null && reminders.enabled && granted
    && questionnaire !== null && pushAvailable();

  useEffect(() => {
    if (!wanted || !userId) {
      setActive(false);
      return;
    }
    let cancelled = false;
    let retry: number | undefined;
    const timer = window.setTimeout(async () => {
      try {
        const endpoint = await subscribePush(userId);
        if (!endpoint || cancelled) return;
        const at = new Date();
        const labels = program?.routine.days.map(d => d.label) ?? [];
        const items = pushReminderItems(reminderTimes(sessions, history, at, reminders), at, s => labels[s.dayIndex]);
        const payload = `${endpoint}\n${JSON.stringify(items)}`;
        if (payload !== lastUpload) {
          const repo = await loadPushRepository();
          if (!repo || cancelled) return;
          await repo.replaceReminders(endpoint, items);
          lastUpload = payload;
        }
        if (!cancelled) setActive(true);
      } catch (e) {
        // Sin red, permiso retirado o servicio de push caído: queda el aviso local y se
        // reintenta (o con el siguiente cambio, o al volver a abrir la app).
        console.warn(`[recordatorios] no se pudo activar el push: ${e instanceof Error ? e.name : 'error'}`);
        if (cancelled) return;
        setActive(false);
        const wait = RETRY_MS[attempt];
        if (wait !== undefined) retry = window.setTimeout(() => setAttempt(a => a + 1), wait);
      }
    }, UPLOAD_DELAY_MS);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      window.clearTimeout(retry);
    };
  }, [wanted, userId, program, sessions, history, reminders, attempt]);
}
