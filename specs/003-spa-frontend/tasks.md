# Tareas: SPA de AQP-SOLIDARIA

**Entrada**: documentos de diseño de `specs/003-spa-frontend/` (spec, plan, research, data-model, contracts, quickstart)

**Responsable**: Huamaní Vargas, Melsy Melany. Revisión del PR: QA (José).

**Pruebas**: obligatorias por la constitución (principio V). Cada control de seguridad tiene una prueba que falla si se quita el control.

**Organización**: tareas agrupadas por historia de usuario de [spec.md](./spec.md), para implementar y probar cada una por separado.

## Formato: `[ID] [P?] [Historia] Descripción`

- **[P]**: puede hacerse en paralelo (archivos distintos, sin dependencias pendientes).
- **[US#]**: historia de spec.md a la que pertenece la tarea.
- Los IDs T0xx de tres cifras son tareas; T01–T14 son las pruebas de aceptación de `requirements.md`.

## Fase 1: Preparación (infraestructura compartida)

**Propósito**: proyecto y herramientas.

- [x] T001 Crear `frontend/package.json` con versiones fijas de design.md §2 (React 19.3, Vite 8.3, Tailwind 4.3, React Router 8.5, TanStack Query 5, React Hook Form 7, Zod 4.6, `oidc-client-ts` 3.5, TypeScript 6.0.3)
- [x] T002 [P] Configurar `frontend/tsconfig.json`, `frontend/tsconfig.node.json`, `frontend/eslint.config.js` (prohíbe `localStorage` y `parseFloat`) y `frontend/.prettierrc.json`
- [x] T003 [P] Configurar `frontend/vite.config.ts`: Tailwind, Vitest con jsdom y `vite preview` con la CSP de `infra/template.yaml` en el puerto 5173
- [x] T004 [P] Crear `frontend/scripts/check-csp.mjs`: falla si el build tiene scripts o estilos en línea, dominios externos o `eval` (NFR-002)
- [x] T005 [P] Agregar el job `frontend` a `.github/workflows/ci.yml`: lint, typecheck, pruebas, build y `npm audit` (NFR-004)

---

## Fase 2: Fundamentos (bloquean todas las historias)

**Propósito**: configuración, contrato, sesión y piezas comunes.

- [x] T006 [P] Pruebas de configuración en `frontend/test/config.test.ts`: HTTPS obligatorio para API y Cognito, variables faltantes, URI de retorno derivada del origen
- [x] T007 Implementar `frontend/src/config/env.ts` y `frontend/src/config/zod.ts` (Zod sin `new Function`, por la CSP)
- [x] T008 [P] Pruebas del contrato en `frontend/test/services.test.ts`: métodos, rutas, `Authorization` solo en rutas protegidas, cuerpo de `createDonation` limitado a `{ projectId, amountCents }`, error uniforme, 401 del authorizer, respuesta fuera de contrato y falla de red
- [x] T009 Implementar `frontend/src/services/schemas.ts`, `errors.ts` y `http.ts`, y una función por `operationId` en `projects.ts`, `donations.ts` y `audit.ts` (contracts/api-consumption.md)
- [x] T010 [P] Pruebas de sesión en `frontend/test/auth.test.ts`: tokens fuera de `localStorage`, PKCE S256 y scopes, revocación con `token` y `client_id`, logout aunque falle la red, canje único del código, `safeReturnTo`, roles desconocidos ignorados
- [x] T011 Implementar `frontend/src/auth/oidc.ts`, `AuthService.ts`, `AuthContext.ts`, `AuthProvider.tsx` y `roles.ts` (contracts/oidc-cognito.md)
- [x] T012 Implementar `frontend/src/hooks/useApi.ts`, `queries.ts`, `usePageTitle.ts`, `frontend/src/queryClient.ts`, `App.tsx`, `routes.tsx` y `main.tsx`
- [x] T013 [P] Implementar componentes comunes en `frontend/src/components/`: `Layout`, `Alert`, `Button`, `Field`, `ErrorMessage`, `Loading`, `SignInButton`, `RequireRole`, `StatusBadge`

**Punto de control**: base lista; las historias pueden avanzar en paralelo.

---

## Fase 3: Historia 1, catálogo y detalle (P1) · HU-01, HU-02, HU-09 🎯 MVP

**Objetivo**: un visitante explora proyectos y su avance confirmado.

**Prueba independiente**: abrir la SPA sin sesión y recorrerla con teclado a 375 px.

- [x] T014 [P] [US1] Pruebas en `frontend/test/catalog.test.tsx`: avance accesible, búsqueda, estado vacío (CA-01.3), falla con reintento, cifras de `/stats` y 404 (CA-02.2)
- [x] T015 [P] [US1] Implementar `frontend/src/domain/money.ts` (`formatCents`, `progressPercent`) y `frontend/src/components/FundingProgress.tsx` con `<progress>`
- [x] T016 [US1] Implementar `frontend/src/pages/CatalogPage.tsx` y `frontend/src/components/ProjectCard.tsx` (CA-01.1)
- [x] T017 [US1] Implementar `frontend/src/pages/ProjectDetailPage.tsx` con cifras de `getProjectStats` (CA-09.1)
- [x] T018 [US1] Prueba en `frontend/test/catalog.test.tsx`: el detalle muestra identificador y estado (CA-02.1, FR-011); debe fallar antes de T019
- [x] T019 [US1] Mostrar identificador y estado del proyecto en `frontend/src/pages/ProjectDetailPage.tsx` (CA-02.1, FR-011)

**Punto de control**: la Historia 1 funciona sola.

---

## Fase 4: Historia 2, iniciar y cerrar sesión (P1) · HU-03, HU-11

**Objetivo**: sesión verificable y cierre seguro.

**Prueba independiente**: login con los cuatro roles y logout.

- [x] T020 [P] [US2] Pruebas en `frontend/test/roles.test.tsx`: menú por rol, cierre de sesión, guardas de UI, aviso de sesión vencida
- [x] T021 [US2] Implementar `frontend/src/pages/CallbackPage.tsx`: canje único y salida de la URL con `replace`
- [x] T022 [US2] Implementar sesión y logout en `frontend/src/components/Layout.tsx` y `frontend/src/components/SignInButton.tsx` (CA-03.3)

---

## Fase 5: Historia 3, donar y simular (P1) · HU-05, HU-06

**Objetivo**: un DONANTE registra una intención y simula el resultado.

**Prueba independiente**: donar S/ 19.99, reintentar y simular.

- [x] T023 [P] [US3] Pruebas en `frontend/test/money.test.ts`: «19.99» → 1999, casos de punto flotante (4.35, 1.15), formatos inválidos y límites 100–100000 (CA-05.1, CA-05.2)
- [x] T024 [P] [US3] Pruebas en `frontend/test/donate.test.tsx`: `Idempotency-Key` UUID, misma clave al reintentar y otra al cambiar el monto (T06, T07), validación antes de enviar, texto de CA-06.4, 409 de transición, visitante y GESTOR sin formulario
- [x] T025 [US3] Implementar `parseSolesToCents` y `checkDonationAmount` en `frontend/src/domain/money.ts`
- [x] T026 [US3] Implementar `frontend/src/hooks/useIdempotencyKey.ts` (data-model.md §Intento de donación)
- [x] T027 [US3] Implementar `frontend/src/components/DonationForm.tsx` sin datos de pago (CA-05.5)
- [x] T028 [US3] Implementar `frontend/src/components/SimulationPanel.tsx` con «Simulación académica: no se ha realizado ningún cobro» (CA-06.4)

---

## Fase 6: Historia 4, historial propio (P1) · HU-07

**Objetivo**: un DONANTE ve solo sus donaciones.

**Prueba independiente**: dos donantes con datos distintos.

- [x] T029 [P] [US4] Pruebas en `frontend/test/donate.test.tsx`: fecha, importe, proyecto y estado (CA-07.1), simulación de pendientes, estado vacío
- [x] T030 [US4] Implementar `frontend/src/pages/MyDonationsPage.tsx`

---

## Fase 7: Historia 5, gestión de proyectos (P2) · HU-08

**Objetivo**: un GESTOR crea y publica proyectos.

**Prueba independiente**: crear un borrador, publicarlo y verlo en el catálogo.

- [x] T031 [P] [US5] Pruebas en `frontend/test/roles.test.tsx`: borrador en céntimos con título recortado (1–120) y descripción (1–2000), publicación y 409 por identificador (CA-08.1, CA-08.2)
- [x] T032 [US5] Implementar `frontend/src/pages/ManageProjectsPage.tsx`

---

## Fase 8: Historia 6, auditoría (P3, extensión) · HU-10

**Objetivo**: un AUDITOR filtra eventos.

**Prueba independiente**: consultar `DONATION_CREATED` después de una donación.

- [x] T033 [P] [US6] Prueba en `frontend/test/roles.test.tsx`: filtro por tipo y tabla desplazable con teclado (CA-10.1, CA-10.2)
- [x] T034 [US6] Implementar `frontend/src/pages/AuditPage.tsx`

---

## Fase 9: Cierre y aspectos transversales

- [x] T035 Ejecutar lint, typecheck, pruebas, build y `check-csp`
- [x] T036 Comprobar con mutaciones que las pruebas detectan la falta de los controles: tokens en `localStorage` y clave de idempotencia siempre nueva
- [x] T037 [P] Actualizar `frontend/README.md`, `README.md`, `AI_USAGE.md` y T027 de `specs/001-secure-donations-core/tasks.md`
- [x] T038 Ejecutar `/speckit-analyze` y corregir las inconsistencias encontradas
- [ ] T039 Revisar `checklists/zero-trust.md` (integrante de seguridad)
- [x] T040 Recorrido de [quickstart.md](./quickstart.md) en local con los cuatro roles, con el build de producción y la CSP de CloudFront (`npm run preview`)
- [ ] T041 Publicar `frontend/dist` en el bucket S3 e invalidar CloudFront, con confirmación del responsable
- [ ] T042 Recorrido de quickstart.md en la URL pública a 375 px y con teclado; entregar evidencia sanitizada a QA

**Correcciones encontradas en el recorrido real de T040** (cada una con su prueba antes del cambio):

- [x] T043 Leer la URL de retorno una sola vez en `frontend/src/pages/CallbackPage.tsx`: el efecto se repetía después de navegar, intentaba un segundo canje sin `code` y mostraba un error aunque la sesión estaba iniciada. Prueba de regresión en `frontend/test/callback.test.tsx`
- [x] T044 Mostrar el foco de inmediato en los botones de `frontend/src/components/Button.tsx`: la transición animaba `outline-color` y el contorno empezaba blanco (WCAG 2.4.7)
- [x] T045 Concordar cantidades con `countLabel` en `frontend/src/domain/labels.ts` («1 evento», «3 eventos») y usar `<output>` para los mensajes de estado
- [x] T046 Dar margen lateral al aviso académico en `frontend/src/components/Layout.tsx`, que tocaba el borde a 375 px

## Dependencias y orden de ejecución

- Fase 1 → Fase 2 → Fases 3 a 8 → Fase 9.
- Las historias 1 a 6 dependen solo de la Fase 2; la Historia 3 reutiliza `FundingProgress` de la Historia 1.
- T018 se escribe antes de T019 y debe fallar primero.
- T041 requiere T040; T042 requiere T041.

## Ejemplo de ejecución en paralelo

```text
Historia 3: T023 (money.test.ts) y T024 (donate.test.tsx) en paralelo; luego T025 a T028.
Historias 5 y 6: T031–T032 y T033–T034 en paralelo, por personas distintas.
```

## Estrategia de implementación

1. **MVP**: Fases 1 y 2, luego Historias 1 a 4 (catálogo, sesión, donar y simular, historial). Es lo mínimo para la demo de `requirements.md` §5.
2. **Incremento**: Historia 5 (gestión) y Historia 6 (auditoría, extensión). Si no llegan, se demuestran con `scripts/demo-backend.sh`.
3. **Cierre**: publicación y recorrido con los cuatro roles.

## Trazabilidad

| Criterio | Dónde se cumple | Prueba |
|---|---|---|
| CA-01.1, CA-01.3, CA-09.1 | `CatalogPage.tsx`, `FundingProgress.tsx` | `catalog.test.tsx` |
| CA-02.1, CA-02.2 | `ProjectDetailPage.tsx` | `catalog.test.tsx` |
| CA-03.1 | `src/auth/oidc.ts` | `auth.test.ts` |
| CA-03.2 | `src/services/http.ts` | `services.test.ts` |
| CA-03.3 | `src/auth/AuthService.ts` | `auth.test.ts` |
| CA-05.1, CA-05.2 | `src/domain/money.ts` | `money.test.ts`, `donate.test.tsx` |
| CA-05.3 | `src/services/donations.ts` | `services.test.ts` |
| CA-05.4 | `src/hooks/useIdempotencyKey.ts` | `donate.test.tsx` |
| CA-06.4 | `src/components/SimulationPanel.tsx` | `donate.test.tsx` |
| CA-07.1 | `MyDonationsPage.tsx` | `donate.test.tsx` |
| CA-08.1, CA-08.2 | `ManageProjectsPage.tsx` | `roles.test.tsx` |
| CA-10.1, CA-10.2 | `AuditPage.tsx` | `roles.test.tsx` |
| CA-NF01.1 | `src/config/env.ts` | `config.test.ts` |
| CA-NF06.1–2 | Componentes y páginas | Consultas por rol y nombre accesible; recorrido a 375 px |
| CA-NF10.2 | `src/components/Layout.tsx` | `roles.test.tsx` |
| CA-NF11.1 | `src/auth/oidc.ts` | `auth.test.ts` |
| CA-NF11.2 | Build y `vite preview` | `scripts/check-csp.mjs` |
