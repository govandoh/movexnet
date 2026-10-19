// Falla si el bundle de `dist/` contiene una clave secreta de Supabase (regla dura 3, DEC-069).
// Lo publicable (URL y `sb_publishable_*`) puede estar; `service_role`, una clave
// `sb_secret_*` y cualquier JWT (`eyJhbGci`, como empiezan las claves heredadas anon y
// service_role) no. `sb_secret_` exige el cuerpo de la clave porque el prefijo solo aparece
// en `src/api-client/config.ts`, que lo rechaza. Corre dentro de `pnpm build`, también en CI.
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';

const DIST = 'dist';
const FORBIDDEN = [/service_role/, /sb_secret_[A-Za-z0-9_-]{16,}/, /eyJhbGci/];
const TEXT = /\.(js|mjs|css|html|json|map|txt|webmanifest)$/;

function* files(dir) {
  for (const name of readdirSync(dir)) {
    const path = join(dir, name);
    if (statSync(path).isDirectory()) yield* files(path);
    else if (TEXT.test(name)) yield path;
  }
}

const hits = [];
for (const file of files(DIST)) {
  const content = readFileSync(file, 'utf8');
  for (const pattern of FORBIDDEN) {
    // Solo el archivo y el patrón: imprimir el valor encontrado lo filtraría a los logs de CI.
    if (pattern.test(content)) hits.push(`${relative('.', file)}: ${pattern.source}`);
  }
}

if (hits.length > 0) {
  console.error('El bundle contiene material secreto; quítalo del entorno y rota la clave:');
  for (const hit of hits) console.error(`  ${hit}`);
  process.exit(1);
}
console.log('check-bundle-secrets: sin claves secretas en dist/');
