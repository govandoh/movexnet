import { useSyncExternalStore } from 'react';
import { forgetSync, startSync, type SyncSession, type SyncStatus } from '../../api-client/index.ts';
import { newId, onLocalChange, syncLocal, type LocalChange } from './appStore';
import { authRepository, watchAccount, type AccountState } from './accountStore';
import { unsubscribePush } from './pushReminders';

/**
 * Conecta la cuenta, el estado local y la sincronización (issue #87, DEC-079).
 *
 * - Con sesión: arranca la cola de esa cuenta y le pasa cada cambio local.
 * - Sesión vencida o cerrada en otro lado: se detiene, pero la cola queda guardada para cuando
 *   la misma cuenta vuelva a entrar.
 * - Cuentas apagadas: no se arranca nada y nada sale del dispositivo.
 * - Cerrar sesión desde la app (`signOutAndForget`) borra la cola y los datos de la cuenta.
 */

/** Última cuenta conocida: el cierre de sesión necesita su id aunque el motor no haya cargado. */
let account: AccountState | null = null;
let session: SyncSession | null = null;
let sessionUser: string | null = null;
let starting: Promise<void> | null = null;
let status: SyncStatus | null = null;
let unsubscribeStatus: (() => void) | null = null;
const listeners = new Set<() => void>();

function setStatus(next: SyncStatus | null): void {
  status = next;
  for (const l of listeners) l();
}

function stopSession(): void {
  unsubscribeStatus?.();
  unsubscribeStatus = null;
  session?.stop();
  session = null;
  sessionUser = null;
  setStatus(null);
}

function forward(change: LocalChange): void {
  const engine = session?.engine;
  if (!engine) return;
  switch (change.type) {
    case 'sets': return engine.recordSets(change.records, change.close);
    case 'session_end': return engine.endSession(change.sessionId, change.endedAt);
    case 'routines': return engine.saveRoutines(change.upserted, change.deleted);
    case 'goals': return engine.saveGoals(change.upserted, change.deleted);
    case 'program': return engine.saveProgram(change.program);
  }
}

let started = false;

/** Se llama una vez al arrancar la app, después de `startAccount`. */
export function startSyncStore(): void {
  if (started) return;
  started = true;
  onLocalChange(forward);
  watchAccount(next => {
    account = next;
    const userId = account.status === 'signed_in' ? account.user?.id ?? null : null;
    if (userId === sessionUser) return;
    stopSession();
    if (!userId) return;
    sessionUser = userId;
    const run = startSync(userId, syncLocal, newId).then(s => {
      // Si mientras cargaba cambió la cuenta, esta sesión ya no sirve.
      if (!s || sessionUser !== userId) {
        s?.stop();
        return;
      }
      session = s;
      unsubscribeStatus = s.engine.subscribe(() => setStatus(s.engine.status()));
      setStatus(s.engine.status());
    }).catch(() => {
      // Sin el módulo (red caída al cargar el chunk): se reintenta al próximo cambio de cuenta.
      sessionUser = null;
    });
    starting = run.finally(() => { starting = null; });
  });
}

/** Estado para Perfil; null sin cuenta o mientras arranca. */
export function useSyncStatus(): SyncStatus | null {
  return useSyncExternalStore(
    cb => { listeners.add(cb); return () => listeners.delete(cb); },
    () => status,
  );
}

/**
 * Cerrar sesión desde la app: borra la cola, la marca de dueño y los datos de la cuenta de
 * este dispositivo (DEC-079) y después cierra la sesión de Auth. Lo que no se subió se pierde:
 * la UI lo advierte antes con `useSyncStatus().pendingOps`.
 */
export async function signOutAndForget(): Promise<void> {
  // Antes del signOut: borrar la suscripción de push necesita la sesión (DEC-080 §6).
  await unsubscribePush().catch(() => {});
  await starting;
  const s = session;
  const userId = account?.user?.id ?? null;
  stopSession();
  if (s) s.engine.discard();
  else {
    // El motor no llegó a cargar: igual se borran la cola, la marca y los datos de la cuenta.
    syncLocal.clear();
    if (userId) await forgetSync(userId).catch(() => {});
  }
  await (await authRepository()).signOut();
}
