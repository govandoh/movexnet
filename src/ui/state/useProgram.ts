import { useMemo } from 'react';
import {
  accessibleWeeks, generateRoutine, weekPlan, type GeneratedRoutine, type PlannedDay,
} from '../../domain/routineGenerator';
import { programWeek, scheduleProgram, withStatus, type SessionWithStatus } from '../../domain/calendar';
import { useAppState } from './appStore';

export interface ProgramView {
  routine: GeneratedRoutine;
  /** Semana en curso (0 = semana 1). */
  week: number;
  /** Semanas que se pueden abrir con el plan actual (1 libre, 8 premium; DEC-056). */
  unlockedWeeks: number;
  /** true si la semana en curso está bloqueada por no ser premium. */
  weekLocked: boolean;
  /** Días de la semana visible (la en curso, o la última abierta si está bloqueada). */
  days: PlannedDay[];
  /** Día que toca hoy o el siguiente de la semana. */
  next: PlannedDay | null;
  /** true si `next` es el día de hoy. */
  nextIsToday: boolean;
}

/** Programa derivado del cuestionario guardado; `null` si aún no se respondió. */
export function useProgram(now: Date): ProgramView | null {
  const { questionnaire, programStartedAt, entitlement } = useAppState();
  const today = now.getDay();
  const dateKey = now.toDateString();

  return useMemo(() => {
    if (!questionnaire) return null;
    const routine = generateRoutine(questionnaire);
    // Semanas de calendario desde el día de inicio, igual que el calendario (calendar.ts).
    const week = programStartedAt
      ? Math.min(programWeek(new Date(programStartedAt), new Date(dateKey)), routine.weeks - 1)
      : 0;
    const unlockedWeeks = accessibleWeeks(routine, entitlement.premium);
    const weekLocked = week >= unlockedWeeks;
    const days = weekPlan(routine, Math.min(week, unlockedWeeks - 1));
    const ordered = [...days].sort((a, b) => ((a.weekday - today + 7) % 7) - ((b.weekday - today + 7) % 7));
    const next = ordered[0] ?? null;
    return { routine, week, unlockedWeeks, weekLocked, days, next, nextIsToday: next?.weekday === today };
  }, [questionnaire, programStartedAt, entitlement.premium, today, dateKey]);
}

/**
 * Sesiones del programa con fecha y estado (hecha, perdida, hoy, próxima, bloqueada), para el
 * calendario y los recordatorios (#35). `[]` si aún no hay programa.
 */
export function useProgramSessions(now: Date): SessionWithStatus[] {
  const { questionnaire, programStartedAt, entitlement, history } = useAppState();
  const dateKey = now.toDateString();
  return useMemo(() => {
    if (!questionnaire) return [];
    const routine = generateRoutine(questionnaire);
    // Programas guardados antes de existir la fecha de inicio arrancan hoy.
    const started = programStartedAt ? new Date(programStartedAt) : new Date(dateKey);
    const sessions = scheduleProgram(routine.days, started, {
      weeks: routine.weeks, unlockedWeeks: accessibleWeeks(routine, entitlement.premium),
    });
    return withStatus(sessions, history, new Date(dateKey));
  }, [questionnaire, programStartedAt, entitlement.premium, history, dateKey]);
}
