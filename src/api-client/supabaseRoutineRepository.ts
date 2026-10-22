/**
 * `RoutineRepository` y `GoalRepository` sobre PostgREST (issue #87, DEC-079).
 *
 * Gana la última escritura: `updated_at` lo fija el cliente con la hora del cambio y el
 * trigger `keep_newest` ignora una escritura más vieja que la guardada. Lo leído se valida
 * igual que lo leído de `localStorage` (`parseRoutines`, `isGoal`; DEC-024 y DEC-052): una
 * fila malformada se descarta, no rompe la app.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '../domain/database.types.ts';
import type { GoalRepository, RoutineRepository } from '../domain/ports.ts';
import { parseRoutines, type Routine } from '../domain/routines.ts';
import { isGoal, type Goal } from '../domain/progress.ts';
import { run } from './postgrest.ts';

type Db = SupabaseClient<Database>;

const iso = (ms: number) => new Date(ms).toISOString();

export class SupabaseRoutineRepository implements RoutineRepository {
  private readonly db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async list(): Promise<Routine[]> {
    const rows = (await run(this.db.from('routines').select('id, name, active, days, created_at, updated_at')
      .order('created_at'))) ?? [];
    return parseRoutines(rows.map(r => ({
      id: r.id, name: r.name, active: r.active, days: r.days,
      createdAt: Date.parse(r.created_at), updatedAt: Date.parse(r.updated_at),
    }))).routines;
  }

  async upsert(routines: readonly Routine[]): Promise<void> {
    if (routines.length === 0) return;
    await run(this.db.from('routines').upsert(routines.map(r => ({
      id: r.id,
      name: r.name,
      active: r.active,
      days: r.days as unknown as NonNullable<Json>,
      created_at: iso(r.createdAt),
      updated_at: iso(r.updatedAt),
    })), { onConflict: 'id' }));
  }

  async remove(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return;
    await run(this.db.from('routines').delete().in('id', [...ids]));
  }
}

/** `metric_name` guarda el tipo de objetivo de la app (`GoalKind`). */
export class SupabaseGoalRepository implements GoalRepository {
  private readonly db: Db;

  constructor(db: Db) {
    this.db = db;
  }

  async list(): Promise<Goal[]> {
    const rows = (await run(this.db.from('goals').select('id, metric_name, target, created_at, updated_at')
      .eq('status', 'active').order('created_at'))) ?? [];
    return rows
      .map((r): unknown => ({
        id: r.id, kind: r.metric_name, target: r.target,
        createdAt: Date.parse(r.created_at), updatedAt: Date.parse(r.updated_at),
      }))
      .filter(isGoal);
  }

  async upsert(goals: readonly Goal[]): Promise<void> {
    if (goals.length === 0) return;
    await run(this.db.from('goals').upsert(goals.map(g => ({
      id: g.id,
      metric_name: g.kind,
      target: g.target,
      created_at: iso(g.createdAt),
      updated_at: iso(g.updatedAt ?? g.createdAt),
    })), { onConflict: 'id' }));
  }

  async remove(ids: readonly string[]): Promise<void> {
    if (ids.length === 0) return;
    await run(this.db.from('goals').delete().in('id', [...ids]));
  }
}
