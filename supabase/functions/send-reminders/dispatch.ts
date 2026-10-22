/**
 * Envío de los recordatorios vencidos (issue #88, DEC-080 §4). Lo llama `pg_cron` cada 5
 * minutos, solo si hay avisos vencidos (`private.dispatch_push_reminders`). Módulo puro: la
 * red y el reloj entran inyectados para probarlo con Vitest; `index.ts` lo conecta a Deno.
 *
 * Como mucho una vez: la base marca `sent_at` al reclamar, así que un error al enviar pierde
 * ese aviso en vez de duplicarlo. Nunca se registra un endpoint (es una URL con capacidad).
 */

import { isPushEndpoint, sendPush, type VapidKeys } from './webpush.ts';

export interface DispatchEnv {
  supabaseUrl: string;
  serviceRoleKey: string;
  /** Secreto propio de la función; el cron lo lee de Vault (`send_reminders_secret`). */
  cronSecret: string;
  vapid: VapidKeys;
}

export interface DispatchDeps {
  fetch: typeof fetch;
  now: () => number;
  log: (message: string) => void;
}

/** Fila de `claim_due_push_reminders`. */
export interface ClaimedReminder {
  reminder_id: string;
  subscription_id: string;
  endpoint: string;
  p256dh: string;
  auth: string;
  title: string;
  body: string;
  url: string;
}

export interface DispatchResult {
  claimed: number;
  sent: number;
  /** Suscripciones vencidas (404 o 410) que se borraron, con sus avisos. */
  gone: number;
  failed: number;
}

/** Avisos por invocación; el resto queda para la siguiente, 5 minutos después. */
const BATCH = 200;
/** Envíos simultáneos al servicio de push. */
const CONCURRENCY = 10;
/** 4 h: un celular apagado a la hora del aviso lo recibe al encenderse, no al día siguiente. */
const TTL_S = 4 * 3600;
/** Un aviso no entregado lo reemplaza el siguiente en vez de acumularse (RFC 8030 §5.4). */
const TOPIC = 'recordatorio';

export function readEnv(get: (name: string) => string | undefined): DispatchEnv | null {
  const supabaseUrl = get('SUPABASE_URL');
  const serviceRoleKey = get('SUPABASE_SERVICE_ROLE_KEY');
  const cronSecret = get('CRON_SECRET');
  const publicKey = get('VAPID_PUBLIC_KEY');
  const privateKey = get('VAPID_PRIVATE_KEY');
  const subject = get('VAPID_SUBJECT');
  if (!supabaseUrl || !serviceRoleKey || !cronSecret || !publicKey || !privateKey || !subject) return null;
  return { supabaseUrl, serviceRoleKey, cronSecret, vapid: { publicKey, privateKey, subject } };
}

/** Comparación en tiempo constante sobre los hashes, que además igualan el largo. */
export async function secretMatches(given: string | null, expected: string): Promise<boolean> {
  if (given === null) return false;
  const digest = async (s: string) => new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s)));
  const [a, b] = await Promise.all([digest(given), digest(expected)]);
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function restHeaders(env: DispatchEnv): Record<string, string> {
  const headers: Record<string, string> = { apikey: env.serviceRoleKey, 'Content-Type': 'application/json' };
  // La service_role clásica es un JWT; las claves `sb_secret_` nuevas van solo en `apikey`.
  if (env.serviceRoleKey.startsWith('eyJ')) headers.Authorization = `Bearer ${env.serviceRoleKey}`;
  return headers;
}

async function claim(env: DispatchEnv, deps: DispatchDeps): Promise<ClaimedReminder[]> {
  const res = await deps.fetch(`${env.supabaseUrl}/rest/v1/rpc/claim_due_push_reminders`, {
    method: 'POST', headers: restHeaders(env), body: JSON.stringify({ p_limit: BATCH }),
  });
  if (!res.ok) throw new Error(`claim_due_push_reminders respondió ${res.status}`);
  return await res.json() as ClaimedReminder[];
}

async function deleteSubscriptions(ids: string[], env: DispatchEnv, deps: DispatchDeps): Promise<void> {
  if (ids.length === 0) return;
  const res = await deps.fetch(`${env.supabaseUrl}/rest/v1/push_subscriptions?id=in.(${ids.join(',')})`, {
    method: 'DELETE', headers: restHeaders(env),
  });
  if (!res.ok) deps.log(`no se pudieron borrar ${ids.length} suscripciones vencidas: ${res.status}`);
}

type Outcome = 'sent' | 'gone' | 'failed';

async function deliver(r: ClaimedReminder, env: DispatchEnv, deps: DispatchDeps): Promise<Outcome> {
  // La base ya lo impide con un `check`; si aun así llega, no se le envía nada y se borra.
  if (!isPushEndpoint(r.endpoint)) return 'gone';
  const payload = JSON.stringify({ title: r.title, body: r.body, url: r.url });
  try {
    const status = await sendPush(r, payload, env.vapid, { ttlSeconds: TTL_S, topic: TOPIC }, deps);
    if (status >= 200 && status < 300) return 'sent';
    if (status === 404 || status === 410) return 'gone';
    deps.log(`aviso ${r.reminder_id}: el servicio de push respondió ${status}`);
  } catch (e) {
    deps.log(`aviso ${r.reminder_id}: ${e instanceof Error ? e.name : 'error'} al enviar`);
  }
  return 'failed';
}

export async function dispatch(env: DispatchEnv, deps: DispatchDeps): Promise<DispatchResult> {
  const claimed = await claim(env, deps);
  const outcomes: Outcome[] = [];
  for (let i = 0; i < claimed.length; i += CONCURRENCY) {
    const chunk = claimed.slice(i, i + CONCURRENCY);
    outcomes.push(...await Promise.all(chunk.map(r => deliver(r, env, deps))));
  }
  const gone = [...new Set(claimed.filter((_, i) => outcomes[i] === 'gone').map(r => r.subscription_id))];
  await deleteSubscriptions(gone, env, deps);
  return {
    claimed: claimed.length,
    sent: outcomes.filter(o => o === 'sent').length,
    gone: gone.length,
    failed: outcomes.filter(o => o === 'failed').length,
  };
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
}

export async function handleRequest(req: Request, env: DispatchEnv | null, deps: DispatchDeps): Promise<Response> {
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });
  if (!env) {
    deps.log('faltan secretos de la función (CRON_SECRET o VAPID_*)');
    return json(500, { error: 'not_configured' });
  }
  if (!(await secretMatches(req.headers.get('x-cron-secret'), env.cronSecret))) {
    return json(401, { error: 'unauthorized' });
  }
  try {
    return json(200, await dispatch(env, deps));
  } catch (e) {
    deps.log(e instanceof Error ? e.message : 'error al reclamar los avisos');
    return json(502, { error: 'claim_failed' });
  }
}
