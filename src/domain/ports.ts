/**
 * Puertos de persistencia del backend de producto (issue #17, DEC-029).
 *
 * `src/domain` solo define las interfaces; `@fitnet/api-client` las implementará con
 * Supabase (regla de dependencias: el SDK de Supabase vive solo allí). Todos los métodos
 * operan sobre el usuario autenticado: el `userId` no se pasa, lo impone RLS en la base.
 * Las fechas viajan como ISO 8601, igual que en `payment.ts`. Módulo puro.
 *
 * Los nombres de campo siguen docs/DOMAIN.md; las columnas en `supabase/migrations` son
 * su versión snake_case. Los puertos de coaching, planes y rankings llegan con sus tablas.
 */

import type { SignUpInput } from './auth.ts';
import type { CatalogExercise, EquipmentTag } from './catalog.ts';
import type {
  ExperienceLevel, ProgramType, TrainingGoal, TrainingLocation, TrainingMethod,
} from './routineGenerator.ts';

/** Perfil y respuestas del cuestionario (DEC-056). */
export interface Profile {
  displayName: string;
  birthYear: number | null;
  /** 1 (enero) a 12; junto con el año, para la puerta 18+ (DEC-069). */
  birthMonth: number | null;
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
  /** null si no hay sesión. El perfil lo crea el alta de la cuenta (`AuthRepository.signUp`). */
  get(): Promise<Profile | null>;
  /** Actualiza los campos editables; la aceptación del aviso y la fecha no se tocan (DEC-069). */
  save(profile: Profile): Promise<void>;
}

/** Usuario autenticado; sin datos del perfil (esos van por `ProfileRepository`). */
export interface AuthUser {
  id: string;
  email: string;
}

/**
 * - `signed_in`: inicio de sesión, al volver del enlace de confirmación y al abrir la app
 *   con una sesión guardada.
 * - `password_recovery`: el usuario abrió el enlace de recuperación; la app debe pedirle la
 *   contraseña nueva y llamar a `updatePassword`.
 * - `signed_out`: cierre de sesión o sesión vencida que no se pudo renovar.
 */
/** Tipos de enlace que mandan las plantillas de `supabase/templates/` (DEC-069). */
export type EmailLinkType = 'email' | 'recovery';

export type AuthEvent = 'signed_in' | 'signed_out' | 'password_recovery' | 'user_updated';

/**
 * Cuentas con correo y contraseña (issue #60, DEC-069). Los errores son siempre `AuthError`
 * (`auth.ts`) con mensajes que no revelan si un correo tiene cuenta.
 */
export interface AuthRepository {
  /**
   * Crea la cuenta y su perfil (el servidor impone la edad y el aviso). Resuelve igual si el
   * correo ya existía, para no revelarlo: la app siempre dice "revisa tu correo".
   */
  signUp(input: SignUpInput): Promise<{ needsEmailConfirmation: boolean }>;
  signIn(input: { email: string; password: string; captchaToken?: string }): Promise<AuthUser>;
  /** Cierra la sesión en este dispositivo; si no hay red, la borra igual en local. */
  signOut(): Promise<void>;
  /** Envía el correo de recuperación. Resuelve igual exista o no la cuenta. */
  requestPasswordReset(input: { email: string; captchaToken?: string }): Promise<void>;
  /**
   * Canjea el enlace del correo (`?token_hash=…&type=…`). Funciona en cualquier navegador,
   * también si el correo se abre fuera de la PWA instalada. `recovery` emite
   * `password_recovery`; `email` confirma la cuenta e inicia sesión. Un solo uso, vence en 1 h.
   */
  verifyEmailLink(input: { tokenHash: string; type: EmailLinkType }): Promise<void>;
  /** Contraseña nueva para el usuario con sesión (tras `password_recovery` o desde Perfil). */
  updatePassword(newPassword: string): Promise<void>;
  /** Usuario de la sesión guardada en el dispositivo; null si no hay sesión. */
  currentUser(): Promise<AuthUser | null>;
  /** Devuelve la función para cancelar la suscripción. */
  onAuthChange(listener: (event: AuthEvent, user: AuthUser | null) => void): () => void;
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
