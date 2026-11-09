# Tareas: Núcleo de la Plataforma de Donaciones Seguras

**Entrada**: `specs/001-secure-donations-core/` (spec, plan, research, data-model, contracts)

**Alcance de esta lista**: backend y AWS (responsable: líder técnico). El frontend, la identidad operativa y las evidencias se agregan cuando se asignen esos roles.

**Pruebas**: obligatorias por la constitución (principio V). Se escriben primero y deben fallar antes de implementar.

**Formato**: `[ID] [P?] [Historia] Descripción`. `[P]` indica que puede hacerse en paralelo. Los IDs T0xx de tres cifras son tareas; T01–T14 son las pruebas de aceptación de `requirements.md`.

## Fase 1: Preparación

- [x] T001 Crear `backend/package.json`, `tsconfig.json`, ESLint, Prettier y Vitest con versiones fijas
- [x] T002 [P] Crear `backend/scripts/build.mjs`: un bundle por handler en `backend/dist/`, tal como espera `infra/template.yaml`
- [x] T003 [P] Crear `.github/workflows/ci.yml`: lint, typecheck, tests, build, `npm audit` y `cfn-lint`, con DynamoDB Local como servicio

## Fase 2: Fundamentos (bloquean todas las historias)

- [x] T004 Crear el arnés de pruebas en `backend/test/helpers/`: motor DynamoDB en memoria con condiciones y transacciones, opción de DynamoDB Local, eventos de API Gateway y lector de la plantilla
- [x] T005 [P] Escribir pruebas de `authz` y logs en `backend/test/authz.test.ts` y `backend/test/logging.test.ts`
- [x] T006 [P] Escribir pruebas de plantilla y mínimo privilegio en `backend/test/template.test.ts` (T10, rutas, scopes, retención)
- [x] T007 Implementar `backend/src/shared/`: errores, envoltorio HTTP, logger con lista blanca, esquemas Zod y cliente DynamoDB
- [x] T008 Implementar `backend/src/authz/`: identidad solo desde claims verificados, RBAC y propietario
- [x] T009 Implementar `backend/src/audit/record.ts`: evento con actor seudonimizado dentro de la transacción

## Fase 3: Historias 1 y 4, proyectos e indicadores (HU-01, HU-02, HU-08, HU-09)

- [x] T010 [US1] [US4] Escribir pruebas en `backend/test/projects.test.ts` (T01, T03, 404, 409, sin datos de donantes)
- [x] T011 [US1] Implementar `backend/src/projects/list.ts`, `get.ts` y `stats.ts`
- [x] T012 [US4] Implementar `backend/src/projects/create.ts` y `publish.ts`

## Fase 4: Historia 5, intención de donación (HU-05)

- [x] T013 [US5] Escribir pruebas en `backend/test/donations.test.ts` (T04–T07, 404, 409, `donorSub` del cliente rechazado)
- [x] T014 [US5] Implementar `backend/src/donations/create.ts` con idempotencia atómica

## Fase 5: Historia 6, simulación (HU-06)

- [x] T015 [US6] Escribir pruebas en `backend/test/donations.test.ts` (T08 con 10 solicitudes paralelas, rechazo sin cambio de cifras)
- [x] T016 [US6] Implementar `backend/src/donations/simulate.ts`

## Fase 6: Historia 7, historial propio (HU-07)

- [x] T017 [US7] Escribir pruebas en `backend/test/donations.test.ts` (T09, T12)
- [x] T018 [US7] Implementar `backend/src/donations/me.ts` y `get.ts`

## Fase 7: Historia 8, auditoría (HU-10, extensión)

- [x] T019 [US8] Escribir pruebas en `backend/test/audit.test.ts`
- [x] T020 [US8] Implementar `backend/src/audit/list.ts`

## Fase 8: Cierre del backend

- [x] T021 Ejecutar lint, typecheck, pruebas, build y `cfn-lint`
- [x] T022 Actualizar `README.md`, `backend/README.md` y `AI_USAGE.md`

## Pendiente: requiere AWS o a otros responsables

- [ ] T023 Desplegar con `sam deploy`, previa confirmación del responsable
- [ ] T024 Ejecutar contra AWS las pruebas que dependen de la plataforma: T02, T11 y T13 (JWT authorizer), T14 (MFA) y T10 (`AccessDenied` real). En T11, comprobar qué código devuelve el authorizer ante un ID token: por la validación de scopes podría ser 403 en lugar del 401 que pide CA-03.2
- [ ] T025 Crear usuarios de prueba de los cuatro roles según AD-09
- [ ] T026 Medir rendimiento (SC-003)
- [ ] T027 Frontend: login PKCE, catálogo, donación, simulación e historial (rol de frontend)

## Dependencias

Fase 1 → Fase 2 → Fases 3 a 7 → Fase 8. Las fases 4 a 6 dependen de los proyectos de la Fase 3.

## Trazabilidad de las pruebas de aceptación

| Prueba | Verificación en este avance | Verificación pendiente en AWS |
|---|---|---|
| T01 | `projects.test.ts` | Demo |
| T02 | `authz.test.ts`, `template.test.ts` | JWT authorizer real |
| T03 | `projects.test.ts` | Llamada directa al API |
| T04–T07 | `donations.test.ts` | Llamada directa al API |
| T08 | `donations.test.ts` | 10 solicitudes paralelas reales |
| T09, T12 | `donations.test.ts` | Llamada directa al API |
| T10 | `template.test.ts` | Policy Simulator o prueba controlada |
| T11 | `authz.test.ts`, `template.test.ts` | JWT authorizer real |
| T13 | No aplica en local | Token revocado antes de expirar |
| T14 | No aplica en local | Login de GESTOR sin segundo factor |
