/**
 * Edge Function `send-reminders` (issue #88, DEC-080). Solo conecta `dispatch.ts` con Deno:
 * secretos de la función, `fetch` y reloj. Se despliega con `verify_jwt = false`
 * (supabase/config.toml) porque la llama `pg_cron` con `x-cron-secret`, no un usuario.
 */

import { handleRequest, readEnv } from './dispatch.ts';

Deno.serve(req => handleRequest(req, readEnv(name => Deno.env.get(name)), {
  fetch,
  now: Date.now,
  log: message => console.error(`[send-reminders] ${message}`),
}));
