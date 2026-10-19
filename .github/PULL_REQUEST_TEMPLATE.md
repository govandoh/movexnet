## Resumen
<!-- Qué cambia y por qué, en 2–4 líneas. Enlaza la historia/issue: Closes #NN -->

## Tipo de cambio
- [ ] `feat` nueva funcionalidad
- [ ] `fix` corrección
- [ ] `refactor` sin cambio de comportamiento (golden intactos)
- [ ] `test` / `fixtures`
- [ ] `docs` / `adr`
- [ ] `chore` tooling, CI, dependencias

## Workstream
- [ ] A · Pose & Captura
- [ ] B · Análisis & Runtime
- [ ] C · ML Training
- [ ] D · Backend de producto
- [ ] E · App & UI
- [ ] Plataforma / DevEx
- [ ] Contratos (`packages/contracts`, `src/contracts`) → requiere rama `contracts/*` o `adr/*` y ADR

## ADR relacionada
<!-- Obligatoria si el PR toca contratos, models/manifest.json o snapshots golden. -->
DEC-___ · <título> · `docs/adr/DEC-___-slug.md`

## Definition of Done
- [ ] `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm build` en verde (CI)
- [ ] Tests nuevos para comportamiento nuevo
- [ ] Golden intactos **o** DEC enlazada arriba y snapshot actualizado en este PR
- [ ] README del paquete actualizado (propósito · API · qué NO hace · cómo probar)
- [ ] Si cierra un hito o un PR de la migración, está anotado aquí (el líder actualiza `docs/STATUS.md`, DEC-062)
- [ ] Probado en celular (indicar modelo/navegador abajo) si toca cámara, UI o PWA
- [ ] Sin secretos ni datos personales (landmarks solo con consentimiento; nunca video)
- [ ] PR < 400 líneas o justificación de por qué no se partió

## Cómo probar
<!-- Pasos concretos. Ej.: abrir preview de Vercel en el celular, elegir "Sentadilla", hacer 5 reps, ... -->
1.
2.

**Dispositivos probados:** <!-- Pixel 7 / Chrome 128 · iPhone 13 / Safari 17 · n/a -->

## Notas para revisores
<!-- Riesgos, decisiones implícitas, deuda que queda, capturas o video corto si aplica. -->
