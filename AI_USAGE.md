# Declaración de uso de IA

Registro exigido por `design.md` §10. Se actualiza con cada etapa.

| Campo | Contenido |
|---|---|
| Herramienta/modelo | Claude Code, Claude Opus 5.5 |
| Participantes | Carrasco Choque Arles Melvin |
| Tareas asistidas | Análisis y arquitectura (constitución, especificación, plan, datos, contrato, plantilla SAM, modelo de amenazas, diagramas e informe) e implementación del backend (HU-01 a HU-10) con sus pruebas |
| Aportes IA | Todos los artefactos de `specs/001-secure-donations-core/`, `.specify/memory/constitution.md`, `infra/template.yaml`, `docs/`, `backend/`, `.github/workflows/ci.yml` y `README.md`. Enlace a PR: pendiente |
| Validación humana | **Pendiente:** revisión por otro integrante en Pull Request. Validación automática realizada: `cfn-lint`, validación OpenAPI, 119 pruebas con motor en memoria y con DynamoDB Local, y mutaciones manuales de la condición de transición y del control de propietario (detectadas por T08 y T09) |
| Limitaciones | Nada se ha desplegado ni probado en AWS: IAM real, JWT authorizer y MFA siguen sin verificar. El ciclo SDD se siguió con las plantillas y comandos de Spec Kit 1.2.5 copiados del Lab03, no con un `specify init` nuevo, porque la herramienta bloqueó la descarga. Las decisiones AD-09 (MFA), `GET /v1/donations/{donationId}` y el uso de team members requieren confirmación. Cada integrante debe poder explicar el código |

## Reglas aplicadas

- No se compartieron con el asistente contraseñas, llaves, tokens ni códigos MFA.
- El inicio de sesión en AWS lo realizó el responsable en su navegador.
- Ningún despliegue ni cambio en la cuenta AWS se ejecuta sin confirmación del responsable.
