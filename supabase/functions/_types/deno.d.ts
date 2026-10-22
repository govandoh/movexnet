// Lo mínimo de la API de Deno que usan las Edge Functions, para revisar los tipos con `tsc`
// desde Node (`tsconfig.functions.json`). En Supabase corre el runtime real de Deno 2.
declare namespace Deno {
  function serve(handler: (request: Request) => Response | Promise<Response>): unknown;
  const env: { get(name: string): string | undefined };
}
