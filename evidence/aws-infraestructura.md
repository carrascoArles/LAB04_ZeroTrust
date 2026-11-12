# Evidencia de infraestructura en AWS

**Fecha:** 2026-11-09 | **Pila:** `aqp-solidaria` (`CREATE_COMPLETE`) | **Región:** `us-east-2` | **Plan:** Free, activo

Resultados obtenidos con AWS CLI en modo lectura y con llamadas directas al API. Datos sanitizados: sin ID de cuenta, tokens ni datos personales. Aún no hubo tráfico con usuarios autenticados.

## Pruebas de aceptación

| Prueba | Comprobación | Resultado |
|---|---|---|
| T01 | `GET /v1/projects` sin token | 200, lista vacía |
| T02 | `POST /v1/donations` sin token | 401; `authorizerError: missing: token not provided` |
| T11 (parcial) | Token alterado | 401; `authorizerError: invalid_token` |
| T10 | Política del rol de `ListProjects` y simulador IAM | Ver abajo |

## T10: mínimo privilegio real

Política inline del rol de `ListProjectsFunction`: `Allow dynamodb:Query` solo sobre el índice `status-createdAt`. Además tiene `AWSLambdaBasicExecutionRole`, para escribir logs.

Simulador IAM, con el contexto `aws:RequestedRegion=us-east-2`:

| Acción | Decisión |
|---|---|
| `dynamodb:Query` | `allowed` |
| `dynamodb:PutItem` | `implicitDeny` |
| `dynamodb:UpdateItem` | `implicitDeny` |
| `dynamodb:DeleteItem` | `implicitDeny` |
| `dynamodb:Scan` | `implicitDeny` |

Sin ese contexto, el simulador devuelve `explicitDeny` en todas las acciones, incluso en `Query`; se atribuye a la política de región de la nueva experiencia de AWS. Por eso debe indicarse la región.

## Seguridad de la infraestructura

| Criterio | Comprobación | Resultado |
|---|---|---|
| CA-NF01.1 | HTTP a CloudFront | 301 a HTTPS |
| CA-NF11.2 | Cabeceras de CloudFront | CSP, HSTS (`max-age=31536000; includeSubDomains`), `nosniff`, `strict-origin-when-cross-origin`, `DENY` |
| Frontend privado | Acceso directo a S3 | 403; bloqueo de acceso público activo en las 4 opciones |
| CA-NF03.1 | Roles IAM de la pila | 10 roles, uno por función |
| Runtime | Lambda | `nodejs24.x`, logs en formato JSON |
| CA-NF07.1 | Retención de logs | 14 días en los 11 grupos |
| CA-NF07.2 | CloudTrail | Registrando; contiene `ExecuteChangeSet` y `CreateUserPool` del despliegue |
| CA-11.1 | Cognito | MFA `OPTIONAL`, solo TOTP |
| CA-NF10.1 | Cognito | Sin autorregistro |
| CA-NF01.2 | Búsqueda en los 9 eventos de log existentes | Sin tokens, correos ni `sub` |

## Rendimiento (CA-NF05.1)

`scripts/perf-catalog.sh`, ejecutado por el líder técnico el 2026-11-09 a las 19:44 UTC.

| Dato | Valor |
|---|---|
| Proyectos publicados | 50 (49 de carga, creados por `gestor` con login PKCE) |
| Método | 100 `GET /v1/projects` secuenciales con curl desde CloudShell, en `us-east-2`, tras 5 solicitudes de calentamiento |
| p50 | 0.037 s |
| p95 | 0.075 s |
| Máximo | 0.175 s |
| Resultado | **Cumple**: p95 muy por debajo de 1.5 s |

Limitación: el cliente está en la misma región que el API, así que no incluye la latencia de internet de un usuario real ni el cold start.

## Pendiente

- Demo del backend (`scripts/demo-backend.sh`): T03–T09, T12, T13, ID token en T11 y logs con usuarios autenticados. Responsable: QA.
- Registro de TOTP y T14 (`scripts/enroll-mfa.sh`). Responsable: identidad y MFA.
