/**
 * Traducción de los errores de PostgREST a `SyncError` (issue #87, DEC-079). La cola offline
 * solo necesita saber si reintentar: un error de red o de servidor se reintenta con backoff;
 * uno de datos o de permisos no se arregla reintentando y la operación se descarta.
 * Nunca se registra el mensaje crudo del servidor (puede traer datos de la fila).
 */

import { SyncError } from '../domain/sync.ts';

export interface PostgrestErrorLike {
  code?: string;
  message?: string;
}

export interface PostgrestResult<T = unknown> {
  data?: T | null;
  error: PostgrestErrorLike | null;
  status: number;
}

/** Clases de SQLSTATE que el reintento no arregla: datos (22), restricciones (23), permisos y sintaxis (42). */
const PERMANENT_SQLSTATE = /^(22|23|42)/;

export function toSyncError(error: PostgrestErrorLike | null, status: number): SyncError {
  const code = error?.code ?? '';
  // supabase-js responde status 0 cuando el fetch falla (sin red, DNS, CORS).
  if (status === 0) return new SyncError(true, 'network');
  // JWT vencido: supabase-js lo renueva solo; el siguiente intento ya va con la sesión nueva.
  if (status === 401 || code === 'PGRST301' || code === 'PGRST303') return new SyncError(true, 'auth');
  if (status === 408 || status === 429 || status >= 500) return new SyncError(true, `http_${status}`);
  if (PERMANENT_SQLSTATE.test(code)) return new SyncError(false, code);
  if (status >= 400) return new SyncError(false, code || `http_${status}`);
  return new SyncError(true, code || 'unknown');
}

/** Espera la consulta y lanza `SyncError` si falló; si no, devuelve los datos. */
export async function run<T>(query: PromiseLike<PostgrestResult<T>>): Promise<T | null> {
  let result: PostgrestResult<T>;
  try {
    result = await query;
  } catch {
    // Excepción del propio fetch (no debería pasar con supabase-js, que la convierte en error).
    throw new SyncError(true, 'network');
  }
  if (result.error) throw toSyncError(result.error, result.status);
  return result.data ?? null;
}

/** Tope de filas por respuesta de PostgREST en Supabase (`max_rows`). */
export const PAGE_SIZE = 1000;

/** Lee todas las páginas de una consulta ordenada; `page(from, to)` arma la consulta con `.range`. */
export async function readAll<T>(page: (from: number, to: number) => PromiseLike<PostgrestResult<T[]>>): Promise<T[]> {
  const rows: T[] = [];
  for (let from = 0; ; from += PAGE_SIZE) {
    const data = (await run(page(from, from + PAGE_SIZE - 1))) ?? [];
    rows.push(...data);
    if (data.length < PAGE_SIZE) return rows;
  }
}
