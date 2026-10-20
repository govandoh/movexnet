import { useEffect, useState } from 'react';
import { reminderTimes } from '../../domain/calendar';
import { dayKey } from '../../domain/sessionHistory';
import { useAppState } from './appStore';
import { useProgramSessions } from './useProgram';

/**
 * Recordatorios de las sesiones del programa (#35). El cálculo es del dominio
 * (`reminderTimes`); aquí solo se programa el aviso del día.
 *
 * Límite conocido: sin un servidor que envíe push, el aviso llega con la app abierta o en
 * segundo plano, no con la app cerrada. Con la app cerrada hace falta Web Push sobre
 * Supabase (historia aparte, con su DEC). En iOS las notificaciones solo existen con la PWA
 * instalada (iOS 16.4 o más).
 */

export type PermissionState = NotificationPermission | 'unsupported';

/** `setTimeout` desborda pasados ~24,8 días; más allá se reprograma. */
const MAX_DELAY_MS = 2_147_000_000;
/** Último día avisado: evita repetir el aviso al recargar la app ese mismo día (DEC-024). */
const LAST_KEY = 'fitnet_reminder_last_v1';
const ICON = '/icons/icon-192.png';

export function notificationPermission(): PermissionState {
  return typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'unsupported';
}

export async function requestNotificationPermission(): Promise<PermissionState> {
  if (notificationPermission() === 'unsupported') return 'unsupported';
  try {
    return await Notification.requestPermission();
  } catch {
    return 'denied';
  }
}

function lastNotified(): string | null {
  try { return localStorage.getItem(LAST_KEY); } catch { return null; }
}

function markNotified(day: string): void {
  try { localStorage.setItem(LAST_KEY, day); } catch { /* sin almacenamiento: puede repetirse */ }
}

/**
 * Por el service worker si existe (así el toque abre la app, ver `notificationclick` en
 * public/sw.js); si no, con la API directa de la página.
 */
export async function showReminder(title: string, body: string): Promise<void> {
  try {
    const reg = 'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : undefined;
    if (reg) {
      await reg.showNotification(title, { body, tag: 'movexnet-recordatorio', icon: ICON, badge: ICON, data: { url: '/#/' } });
      return;
    }
  } catch {
    // Sin service worker o con el registro roto: se usa la API de la página.
  }
  try {
    new Notification(title, { body, tag: 'movexnet-recordatorio', icon: ICON });
  } catch {
    // Android no permite `new Notification` sin service worker; no hay más que hacer.
  }
}

/** Programa el próximo aviso mientras la app está abierta. Se monta una vez, en `AppShell`. */
export function useReminderScheduler(): void {
  const { reminders, history, questionnaire } = useAppState();
  const now = new Date();
  const sessions = useProgramSessions(now);
  const [tick, setTick] = useState(0);
  const permission = notificationPermission();

  useEffect(() => {
    if (!reminders.enabled || permission !== 'granted' || !questionnaire) return;
    const last = lastNotified();
    const next = reminderTimes(sessions, history, new Date(), reminders)
      .find(r => r.session.date !== last);
    if (!next) return;
    const delay = next.at - Date.now();
    const timer = window.setTimeout(() => {
      if (Date.now() < next.at) { setTick(t => t + 1); return; } // tope de setTimeout: reprogramar
      // Si el celular durmió y el aviso llega tarde, solo vale el mismo día.
      if (dayKey(new Date()) === next.session.date) {
        markNotified(next.session.date);
        void showReminder('Hoy toca entrenar', 'Tu sesión del programa te espera en MovexNet.');
      }
      setTick(t => t + 1);
    }, Math.min(Math.max(delay, 0), MAX_DELAY_MS));
    return () => window.clearTimeout(timer);
  }, [reminders, permission, questionnaire, sessions, history, tick]);
}
