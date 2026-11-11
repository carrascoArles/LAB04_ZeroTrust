# Declaración de uso de IA

Registro exigido por `design.md` §10. Se actualiza con cada etapa.

| Campo | Contenido |
|---|---|
| Herramienta/modelo | Claude Code, Claude Opus 5.5 |
| Participantes | Carrasco Choque Arles Melvin |
| Tareas asistidas | Análisis y arquitectura (constitución, especificación, plan, datos, contrato, plantilla SAM, modelo de amenazas, diagramas e informe) e implementación del backend (HU-01 a HU-10) con sus pruebas |
| Aportes IA | Todos los artefactos de `specs/001-secure-donations-core/`, `.specify/memory/constitution.md`, `infra/template.yaml`, `docs/`, `backend/`, `scripts/`, `evidence/`, `.github/workflows/ci.yml` y `README.md`. Enlace a PR: pendiente |
| Validación humana | **Pendiente:** revisión por otro integrante en Pull Request. Validación automática realizada: `cfn-lint`, validación OpenAPI, 122 pruebas con motor en memoria y con DynamoDB Local, y mutaciones manuales de la condición de transición y del control de propietario (detectadas por T08 y T09) |
| Limitaciones | Solo se verificaron en AWS T01, T02, T10 y parte de T11; el resto sigue pendiente, incluido MFA. El ciclo SDD se siguió con las plantillas y comandos de Spec Kit 1.2.5 copiados del Lab03, no con un `specify init` nuevo, porque la herramienta bloqueó la descarga. Las decisiones AD-09 (MFA), `GET /v1/donations/{donationId}` y el uso de team members requieren confirmación. Cada integrante debe poder explicar el código |

## Frontend (`003-spa-frontend`)

| Campo | Contenido |
|---|---|
| Herramienta/modelo | Claude Code, Claude Opus 5.5 |
| Participantes | Huamaní Vargas Melsy Melany |
| Tareas asistidas | Ciclo SDD de la SPA con Spec Kit 1.2.5 (`specify`, `clarify`, `plan`, `checklist`, `tasks`, `analyze`, `implement`); implementación de las seis pantallas (HU-01 a HU-10), login PKCE, cliente del contrato y pruebas |
| Aportes IA | `specs/003-spa-frontend/` (spec, checklists, plan, research, data-model, contracts, quickstart y tasks), `frontend/` y el job `frontend` de `.github/workflows/ci.yml`. Enlace a PR: pendiente |
| Validación humana | **Pendiente:** revisión de las capturas y repetición del recorrido en la URL pública ([quickstart](specs/003-spa-frontend/quickstart.md)), revisión de `checklists/zero-trust.md` por el integrante de seguridad y revisión del PR por QA. Validación automática realizada: lint, typecheck, 87 pruebas con Vitest y Testing Library, recorrido real con los cuatro roles en Edge (build de producción con la CSP de CloudFront, contra el API desplegado), `check-csp` sobre el build y mutaciones manuales del almacenamiento de tokens y de la clave de idempotencia (detectadas por sus pruebas) |
| Limitaciones | La primera versión se especificó a mano y con las pruebas junto al código; después se pasó por los procedimientos de Spec Kit, y `/speckit-analyze` lo marcó como desviación del principio V (detalle en `specs/003-spa-frontend/plan.md`). Al rehacer la especificación contra `requirements.md` se detectó que el detalle no mostraba identificador ni estado (CA-02.1); se corrigió con la prueba primero. El asistente no publicó la SPA. Para el recorrido real y las capturas usó la contraseña de los usuarios de prueba, con autorización expresa de la responsable y en contra de la regla de CLAUDE.md; la recibió en el chat, la pasó solo como variable de entorno y no la escribió en archivos ni en registros. Se recomienda cambiarla. El recorrido creó un proyecto de prueba («Biblioteca comunitaria en Cerro Colorado») y una donación simulada de S/ 19.99, y encontró cuatro defectos que las pruebas automáticas no veían (T043–T046) |

## Reglas aplicadas

- No se compartieron con el asistente llaves, tokens ni códigos MFA. La excepción de la contraseña de los usuarios de prueba se declara arriba.
- El inicio de sesión en AWS lo realizó el responsable en su navegador.
- Los despliegues los ejecutó el responsable en CloudShell; el asistente solo hizo consultas de lectura en la cuenta.
