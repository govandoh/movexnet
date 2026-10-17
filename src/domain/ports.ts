/**
 * Puertos de persistencia del backend de producto (issue #17, DEC-029).
 *
 * `src/domain` solo define las interfaces; `@movexnet/api-client` las implementará con
 * Supabase (regla de dependencias: el SDK de Supabase vive solo allí). Todos los métodos
 * operan sobre el usuario autenticado: el `userId` no se pasa, lo impone RLS en la base.
 * Las fechas viajan como ISO 8601, igual que en `payment.ts`. Módulo puro.
 *
 * Los nombres de campo siguen docs/DOMAIN.md; las columnas en `supabase/migrations` son
 * su versión snake_case. Los puertos de coaching, planes y rankings llegan con sus tablas.
 */

import type { CatalogExercise, EquipmentTag } from './catalog.ts';
import type {
  ExperienceLevel, ProgramType, TrainingGoal, TrainingLocation, TrainingMethod,
} from './routineGenerator.ts';

/** Perfil y respuestas del cuestionario (DEC-056). */
export interface Profile {
  displayName: string;
  birthYear: number | null;
  heightCm: number | null;
  weightKg: number | null;
  experienceLevel: ExperienceLevel;
  goal: TrainingGoal;
  trainingLocation: TrainingLocation;
  equipment: EquipmentTag[];
  daysPerWeek: number;
  sessionMinutes: number;
  programType: ProgramType;
  preferredCamera: 'user' | 'environment';
  publicProfile: boolean;
}

export interface ProfileRepository {
  /** null si el usuario aún no creó su perfil. */
  get(): Promise<Profile | null>;
  /** Crea o reemplaza el perfil del usuario. */
  save(profile: Profile): Promise<void>;
}

/** Catálogo de solo lectura: se siembra con migraciones, nadie lo escribe desde el cliente. */
export interface ExerciseCatalogRepository {
  list(): Promise<CatalogExercise[]>;
}

export interface WorkoutSession {
  id: string;
  startedAt: string;
  endedAt: string | null;
  device: string | null;
  /** Versiones de `models/manifest.json` usadas en la sesión. */
  modelVersions: Record<string, string>;
}

export interface SetLog {
  id: string;
  sessionId: string;
  exerciseId: string;
  method: TrainingMethod;
  methodParams: Record<string, unknown>;
  loadKg: number | null;
  rpe: number | null;
  reps: number | null;
  startedAt: string;
}

/** Valor agregado con nombre (docs/METRICS.md); única entrada del CoachAssistant. */
export interface MetricValue {
  sessionId: string;
  setId: string | null;
  scope: 'set' | 'session';
  name: string;
  value: number;
  unit: string;
  schemaVersion: number;
  computedAt: string;
}

export interface WorkoutRepository {
  startSession(input: Pick<WorkoutSession, 'device' | 'modelVersions'>): Promise<WorkoutSession>;
  endSession(sessionId: string, endedAt: string): Promise<void>;
  /** `id` y `startedAt` los asigna el cliente para que la cola offline sea idempotente. */
  logSet(set: SetLog): Promise<void>;
  logMetrics(metrics: readonly MetricValue[]): Promise<void>;
  /** Series del usuario en un rango; `from` incluido, `to` excluido (poda por partición). */
  listSets(range: { from: string; to: string }): Promise<SetLog[]>;
}

export interface RecordingConsent {
  id: string;
  textVersion: string;
  grantedAt: string;
  revokedAt: string | null;
}

/**
 * Consentimiento explícito por grabación (regla dura 2, docs/DATA-GOVERNANCE.md §2,
 * DEC-064): cada consentimiento vale para UNA sola grabación, así que no hay un
 * consentimiento "vigente" que reutilizar; se pide uno nuevo antes de cada grabación.
 */
export interface ConsentRepository {
  grant(textVersion: string): Promise<RecordingConsent>;
  /**
   * Revocar es definitivo y vence la grabación asociada (`retention_until = now()`) para que
   * la purga y la exportación a ML la excluyan; la fila se borra con `deleteRecording`.
   */
  revoke(consentId: string): Promise<void>;
  /** Consentimiento de una grabación; null si no existe. */
  forRecording(recordingId: string): Promise<RecordingConsent | null>;
  deleteRecording(recordingId: string): Promise<void>;
}
