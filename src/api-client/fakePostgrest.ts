/**
 * Doble del cliente de PostgREST de supabase-js, solo para las pruebas de los adaptadores de
 * datos. Registra la cadena de llamadas de cada consulta (`from('t').upsert(...).eq(...)`) y
 * responde con lo que devuelva `reply`. No lo importa ningún módulo de la app.
 */

import type { PostgrestResult } from './postgrest.ts';

export interface FakeCall {
  table: string;
  steps: [string, unknown[]][];
}

/** Argumentos del paso `name` de la llamada, o undefined si no se usó. */
export function step(call: FakeCall | undefined, name: string): unknown[] | undefined {
  return call?.steps.find(([n]) => n === name)?.[1];
}

export function fakeDb(reply: (call: FakeCall) => PostgrestResult = () => ({ data: null, error: null, status: 201 })) {
  const calls: FakeCall[] = [];
  function chain(call: FakeCall): object {
    calls.push(call);
    const builder: object = new Proxy({}, {
      get(_target, prop) {
        if (prop === 'then') {
          return (resolve: (v: PostgrestResult) => unknown, reject: (e: unknown) => unknown) =>
            Promise.resolve().then(() => reply(call)).then(resolve, reject);
        }
        return (...args: unknown[]) => {
          call.steps.push([String(prop), args]);
          return builder;
        };
      },
    });
    return builder;
  }
  const db = {
    from: (table: string) => chain({ table, steps: [] }),
    /** Las funciones de la base se registran como `rpc:<nombre>` con un paso `args`. */
    rpc: (fn: string, args: unknown) => chain({ table: `rpc:${fn}`, steps: [['args', [args]]] }),
  };
  // El adaptador espera un SupabaseClient tipado; el doble solo implementa `from` y `rpc`.
  return { db: db as never, calls };
}
