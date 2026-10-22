/**
 * `WorkoutRepository` sobre PostgREST (issue #87, DEC-079).
 *
 * Todo se inserta con `ignoreDuplicates` (ON CONFLICT DO NOTHING) y ids del cliente: la cola
 * offline puede reenviar un lote entero sin saber qué parte llegó. Nunca se envía `user_id`
 * (lo pone la base con `auth.uid()`), ni `flagged` ni `flag_reasons` (el cliente no tiene
 * privilegio sobre esas columnas; las fija el trigger anti-trampa, DEC-067 y DEC-074).
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '../domain/database.types.ts';
import type { MetricValue, SetLog, WorkoutRepository, WorkoutSession } from '../domain/ports.ts';
import type { SetSource } from '../domain/sessionHistory.ts';
import type { TrainingMethod } from '../domain/routineGenerator.ts';
import { readAll, run } from './postgrest.ts';

type Db = SupabaseClient<Database>;

const SET_COLUMNS = 'id, session_id, exercise_id, method, method_params, load_kg, rpe, reps, started_at, source, duration_ms';
const METRIC_COLUMNS = 'id, session_id, set_id, scope, name, value, unit, schema_version, computed_at';

/** Series que se leen como máximo: las mismas que guarda el dispositivo. */
export const MAX_SETS = 1000;

export class SupabaseWorkoutRepository implements WorkoutRepository {
  private readonly db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async startSession(s: WorkoutSession): Promise<void> {
    await run(this.db.from('workout_sessions').upsert({
      id: s.id,
      started_at: s.startedAt,
      ended_at: s.endedAt,
      device: s.device,
      model_versions: s.modelVersions as NonNullable<Json>,
    }, { onConflict: 'id', ignoreDuplicates: true }));
  }

  async endSession(sessionId: string, endedAt: string): Promise<void> {
    await run(this.db.from('workout_sessions').update({ ended_at: endedAt }).eq('id', sessionId));
  }

  async logSets(sets: readonly SetLog[]): Promise<void> {
    if (sets.length === 0) return;
    await run(this.db.from('set_logs').upsert(sets.map(s => ({
      id: s.id,
      session_id: s.sessionId,
      exercise_id: s.exerciseId,
      method: s.method,
      method_params: s.methodParams as NonNullable<Json>,
      load_kg: s.loadKg,
      rpe: s.rpe,
      reps: s.reps,
      started_at: s.startedAt,
      source: s.source,
      duration_ms: s.durationMs,
      // La clave primaria incluye la columna de partición (20261010000000_core_schema.sql).
    })), { onConflict: 'id,started_at', ignoreDuplicates: true }));
  }

  async logMetrics(metrics: readonly MetricValue[]): Promise<void> {
    if (metrics.length === 0) return;
    await run(this.db.from('metrics').upsert(metrics.map(m => ({
      id: m.id,
      session_id: m.sessionId,
      set_id: m.setId,
      scope: m.scope,
      name: m.name,
      value: m.value,
      unit: m.unit,
      schema_version: m.schemaVersion,
      computed_at: m.computedAt,
    })), { onConflict: 'id', ignoreDuplicates: true }));
  }

  async listSets(range: { from: string; to: string }): Promise<SetLog[]> {
    // Las más recientes primero para quedarse con las últimas MAX_SETS; se devuelven en orden.
    const rows = (await run(this.db.from('set_logs').select(SET_COLUMNS)
      .gte('started_at', range.from).lt('started_at', range.to)
      .order('started_at', { ascending: false }).limit(MAX_SETS))) ?? [];
    return rows.reverse().map(r => ({
      id: r.id,
      sessionId: r.session_id,
      exerciseId: r.exercise_id,
      method: r.method as TrainingMethod,
      methodParams: (r.method_params ?? {}) as Record<string, unknown>,
      loadKg: r.load_kg,
      rpe: r.rpe,
      reps: r.reps,
      startedAt: r.started_at,
      source: r.source as SetSource,
      durationMs: r.duration_ms,
    }));
  }

  async listSetMetrics(range: { from: string; to: string }): Promise<MetricValue[]> {
    // Hasta cuatro métricas por serie: más de una página de PostgREST con 1000 series.
    const rows = await readAll((from, to) => this.db.from('metrics').select(METRIC_COLUMNS)
      .eq('scope', 'set').gte('computed_at', range.from).lt('computed_at', range.to)
      .order('computed_at').order('id').range(from, to));
    return rows.map(r => ({
      id: r.id,
      sessionId: r.session_id,
      setId: r.set_id,
      scope: r.scope as MetricValue['scope'],
      name: r.name,
      value: r.value,
      unit: r.unit,
      schemaVersion: r.schema_version,
      computedAt: r.computed_at,
    }));
  }
}
