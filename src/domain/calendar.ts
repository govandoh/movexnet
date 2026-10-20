import { dayKey, type SetRecord } from './sessionHistory.ts';
import { PROGRAM_WEEKS } from './routineGenerator.ts';

/**
 * Calendario del programa (workstream D, puro; issue #35, DEC-056).
 *
 * Convierte "días de la semana del programa + fecha de inicio" en sesiones con fecha, y
 * responde las preguntas del calendario: qué toca, qué se hizo, cuándo avisar. No toca
 * `localStorage`, el reloj ni el azar: `now` llega como parámetro. Todo trabaja en la hora
 * local del dispositivo (como `sessionHistory`), con claves de día `AAAA-MM-DD`.
 *
 * Las semanas son bloques de 7 días de calendario contados desde el día de inicio (no
 * desde la hora exacta). `programWeek` da la misma semana que `scheduleProgram` para una
 * fecha dada; Hoy debe usarla en lugar de `currentProgramWeek` de `appStore`, que cuenta
 * 24 horas transcurridas y por la mañana del día 8 todavía marca la semana anterior.
 * La función es genérica en los días: sirve para el programa generado (`GeneratedRoutine`)
 * y para la rutina editable activa (`Routine`, DEC-040). El detalle de cada sesión
 * (ejercicios, series) se obtiene con `dayIndex` y `week`: `weekPlan(routine, week)[dayIndex]`.
 */

export interface ProgramSession {
  /** Día de la sesión, hora local: `AAAA-MM-DD`. */
  date: string;
  /** Semana del programa (0 = semana 1). */
  week: number;
  /** 0 = domingo … 6 = sábado. */
  weekday: number;
  /** Posición del día en la lista de días recibida. */
  dayIndex: number;
  /** true si la semana no es accesible con el plan actual (semana 1 libre, resto Premium). */
  locked: boolean;
}

export interface ScheduleOptions {
  /** Semanas del programa; por defecto `PROGRAM_WEEKS`. */
  weeks?: number;
  /** Semanas accesibles (`accessibleWeeks`); por defecto todas. La autoridad real es el backend. */
  unlockedWeeks?: number;
}

/** Tope de semanas que se calculan; protege el bucle de un `weeks` descontrolado. */
const MAX_WEEKS = 52;

function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

/**
 * Suma días de calendario, no milisegundos: un cambio de hora no desplaza la fecha.
 */
function addDays(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
}

/**
 * Semana del programa (0 = semana 1) en que cae `date`, contando días de calendario desde
 * el día de inicio. Antes del inicio o con fechas inválidas devuelve 0. No se acota por el
 * fin del programa: quien llama decide qué hacer pasadas las semanas (p. ej. `weeks - 1`).
 */
export function programWeek(startedAt: Date, date: Date): number {
  if (Number.isNaN(startedAt.getTime()) || Number.isNaN(date.getTime())) return 0;
  // `round` absorbe los días de 23 o 25 horas de un cambio de hora.
  const days = Math.round((startOfDay(date).getTime() - startOfDay(startedAt).getTime()) / 86_400_000);
  return Math.max(0, Math.floor(days / 7));
}

/**
 * Todas las sesiones del programa, ordenadas por fecha (y por posición del día si dos caen
 * el mismo día). El día de inicio cuenta si su día de la semana está en el programa.
 * Una fecha inválida o sin días devuelve una lista vacía.
 */
export function scheduleProgram(
  days: readonly { weekday: number }[], startedAt: Date, options: ScheduleOptions = {},
): ProgramSession[] {
  if (Number.isNaN(startedAt.getTime())) return [];
  const requested = options.weeks ?? PROGRAM_WEEKS;
  const weeks = Number.isNaN(requested) ? 0 : Math.min(MAX_WEEKS, Math.max(0, Math.floor(requested)));
  // Un valor no numérico bloquea todo: ante la duda, el paywall falla cerrado.
  const unlockedWeeks = Number.isNaN(options.unlockedWeeks ?? 0) ? 0 : (options.unlockedWeeks ?? weeks);
  const start = startOfDay(startedAt);
  const sessions: ProgramSession[] = [];
  for (let offset = 0; offset < weeks * 7; offset++) {
    const date = addDays(start, offset);
    const weekday = date.getDay();
    const week = Math.floor(offset / 7);
    days.forEach((day, dayIndex) => {
      if (day.weekday !== weekday) return;
      sessions.push({ date: dayKey(date), week, weekday, dayIndex, locked: week >= unlockedWeeks });
    });
  }
  return sessions;
}

/** Sesiones entre dos días, ambos incluidos (vista de semana o de mes). */
export function sessionsBetween<T extends ProgramSession>(sessions: readonly T[], from: Date, to: Date): T[] {
  const a = dayKey(from);
  const b = dayKey(to);
  // Las claves `AAAA-MM-DD` se ordenan como texto igual que como fechas.
  return sessions.filter(s => s.date >= a && s.date <= b);
}

/** Las próximas `limit` sesiones desde hoy (hoy incluido), accesibles o no. */
export function nextSessions<T extends ProgramSession>(sessions: readonly T[], now: Date, limit: number): T[] {
  const today = dayKey(now);
  return sessions.filter(s => s.date >= today).slice(0, Math.max(0, limit));
}

/**
 * - `done`: ese día hay al menos una serie en el historial (el mismo criterio de la racha).
 * - `missed`: el día pasó sin ninguna serie.
 * - `today`: toca hoy y aún no se entrenó.
 * - `upcoming`: es futura.
 * - `locked`: su semana no es accesible; manda sobre las demás para no marcar como perdida
 *   una sesión que el plan no permitía hacer.
 */
export type SessionStatus = 'done' | 'missed' | 'today' | 'upcoming' | 'locked';

export interface SessionWithStatus extends ProgramSession {
  status: SessionStatus;
}

function activeDays(history: readonly SetRecord[]): Set<string> {
  return new Set(history.map(r => dayKey(new Date(r.completedAt))));
}

function statusOf(s: ProgramSession, active: ReadonlySet<string>, today: string): SessionStatus {
  if (s.locked) return 'locked';
  if (active.has(s.date)) return 'done';
  if (s.date < today) return 'missed';
  return s.date === today ? 'today' : 'upcoming';
}

/** Cruza las sesiones con el historial para saber qué se hizo contra lo planificado. */
export function withStatus(
  sessions: readonly ProgramSession[], history: readonly SetRecord[], now: Date,
): SessionWithStatus[] {
  const active = activeDays(history);
  const today = dayKey(now);
  return sessions.map(s => ({ ...s, status: statusOf(s, active, today) }));
}

export interface ReminderTime {
  /** Hora local del aviso, 0–23. */
  hour: number;
  /** Minuto del aviso, 0–59. */
  minute: number;
}

export interface Reminder {
  /** Instante del aviso, epoch en milisegundos (DEC-040). */
  at: number;
  session: ProgramSession;
}

function clampInt(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, Math.round(n)));
}

/**
 * Avisos pendientes: uno por sesión accesible, a la hora local elegida del día de la
 * sesión. Omite lo que ya pasó y los días ya entrenados (no se avisa de lo que ya se hizo).
 * Quien llama programa la notificación; el cálculo es el mismo con notificación local o push.
 */
export function reminderTimes(
  sessions: readonly ProgramSession[], history: readonly SetRecord[], now: Date, time: ReminderTime,
): Reminder[] {
  const hour = clampInt(time.hour, 0, 23);
  const minute = clampInt(time.minute, 0, 59);
  const active = activeDays(history);
  const reminders: Reminder[] = [];
  for (const session of sessions) {
    if (session.locked || active.has(session.date)) continue;
    const [y, m, d] = session.date.split('-').map(Number);
    const at = new Date(y, m - 1, d, hour, minute).getTime();
    if (at > now.getTime()) reminders.push({ at, session });
  }
  return reminders;
}
