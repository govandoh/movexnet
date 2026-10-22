/**
 * `ProfileRepository` sobre PostgREST (issue #87, DEC-079). Solo escribe los campos que el
 * cliente puede editar (privilegios por columna de 20261019000000_cuentas.sql y
 * 20261021100000_sincronizacion.sql); la aceptación del aviso y `user_id` nunca se envían.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../domain/database.types.ts';
import type { EquipmentTag } from '../domain/catalog.ts';
import type { Profile, ProfileRepository } from '../domain/ports.ts';
import type { ExperienceLevel, ProgramType, TrainingGoal, TrainingLocation } from '../domain/routineGenerator.ts';
import { run } from './postgrest.ts';

type Db = SupabaseClient<Database>;
type ProfileUpdate = Database['public']['Tables']['profiles']['Update'];
type ProfileRow = Database['public']['Tables']['profiles']['Row'];

// Un solo literal: supabase-js deduce el tipo de la fila a partir de este texto.
const COLUMNS = 'display_name, birth_year, birth_month, height_cm, weight_kg, experience_level, goal, training_location, equipment, days_per_week, session_minutes, program_type, preferred_camera, public_profile, program_started_at';

/** Campo del dominio → columna editable. Lo que no esté aquí no sale del cliente. */
const EDITABLE: { [K in keyof Profile]: keyof ProfileUpdate } = {
  displayName: 'display_name',
  birthYear: 'birth_year',
  birthMonth: 'birth_month',
  heightCm: 'height_cm',
  weightKg: 'weight_kg',
  experienceLevel: 'experience_level',
  goal: 'goal',
  trainingLocation: 'training_location',
  equipment: 'equipment',
  daysPerWeek: 'days_per_week',
  sessionMinutes: 'session_minutes',
  programType: 'program_type',
  preferredCamera: 'preferred_camera',
  publicProfile: 'public_profile',
  programStartedAt: 'program_started_at',
};

export class SupabaseProfileRepository implements ProfileRepository {
  private readonly db: Db;
  private readonly userId: string;

  /** `userId` solo sirve de filtro (Supabase exige WHERE en un UPDATE); quien autoriza es la RLS. */
  constructor(db: Db, userId: string) {
    this.db = db;
    this.userId = userId;
  }

  async get(): Promise<Profile | null> {
    const r = await run<ProfileRow>(this.db.from('profiles').select(COLUMNS).eq('user_id', this.userId).maybeSingle());
    if (!r) return null;
    return {
      displayName: r.display_name,
      birthYear: r.birth_year,
      birthMonth: r.birth_month,
      heightCm: r.height_cm,
      weightKg: r.weight_kg,
      experienceLevel: r.experience_level as ExperienceLevel,
      goal: r.goal as TrainingGoal,
      trainingLocation: r.training_location as TrainingLocation,
      equipment: r.equipment as EquipmentTag[],
      daysPerWeek: r.days_per_week,
      sessionMinutes: r.session_minutes,
      programType: r.program_type as ProgramType,
      preferredCamera: r.preferred_camera === 'user' ? 'user' : 'environment',
      publicProfile: r.public_profile,
      programStartedAt: r.program_started_at,
    };
  }

  async update(patch: Partial<Profile>): Promise<void> {
    const row: Record<string, unknown> = {};
    for (const [key, value] of Object.entries(patch)) {
      const column = EDITABLE[key as keyof Profile];
      if (column && value !== undefined) row[column] = value;
    }
    if (Object.keys(row).length === 0) return;
    await run(this.db.from('profiles').update(row as ProfileUpdate).eq('user_id', this.userId));
  }
}
