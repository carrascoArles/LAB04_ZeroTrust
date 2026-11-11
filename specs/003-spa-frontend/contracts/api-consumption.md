# Contrato: consumo del API

Cómo usa la SPA cada operación de [`docs/api.yaml`](../../../docs/api.yaml). No agrega rutas, parámetros ni campos (FR-001).

## Reglas comunes

| Regla | Valor | Criterio |
|---|---|---|
| URL base | `VITE_API_URL` (HTTPS obligatorio) | CA-NF01.1 |
| Credencial | `Authorization: Bearer <access_token>` solo en rutas protegidas | CA-03.2, CA-NF02.1 |
| Cookies | Nunca (`credentials: "omit"`) | Sin sesión implícita |
| Caché HTTP | `no-store` | Datos siempre del backend |
| Respuesta | Se valida con el esquema del contrato antes de usarla | FR-002 |
| Error | `{ code, message, requestId }`; si no viene, se usa el código HTTP | design.md §4 |

## Operaciones

| operationId | Método y ruta | Scope | Cabeceras extra | Cuerpo enviado | Pantalla |
|---|---|---|---|---|---|
| `listProjects` | `GET /v1/projects` | Público | — | — | Catálogo; títulos del historial |
| `getProject` | `GET /v1/projects/{projectId}` | Público | — | — | Detalle |
| `getProjectStats` | `GET /v1/projects/{projectId}/stats` | Público | — | — | Avance del detalle |
| `createProject` | `POST /v1/projects` | `api/projects.write` | — | `{ title, description, goalAmountCents }` | Gestión |
| `publishProject` | `PATCH /v1/projects/{projectId}/publish` | `api/projects.write` | — | — | Gestión |
| `createDonation` | `POST /v1/donations` | `api/donations.write` | `Idempotency-Key: <UUID>` | `{ projectId, amountCents }` | Detalle |
| `getMyDonations` | `GET /v1/donations/me` | `api/donations.read` | — | — | Historial |
| `getDonation` | `GET /v1/donations/{donationId}` | `api/donations.read` | — | — | Implementada; sin pantalla (T09 se prueba con scripts) |
| `simulateDonation` | `POST /v1/donations/{donationId}/simulate` | `api/donations.write` | — | `{ outcome }` | Detalle e historial |
| `listAuditEvents` | `GET /v1/audit?eventType&from&to` | `api/audit.read` | — | — | Auditoría |

## Respuestas que la SPA explica

| Código | Mensaje para la persona | Acción ofrecida |
|---|---|---|
| 400 | El `message` del backend | Corregir el formulario |
| 401 | «Tu sesión no es válida o ya expiró» | Iniciar sesión |
| 403 | «Tu cuenta no tiene permiso para esta acción» | — |
| 404 | «No encontramos lo que buscas» | Volver al catálogo |
| 409 | El `message` del backend (por ejemplo, «El proyecto ya está publicado.») | — |
| 5xx | «El servidor tuvo un problema» | Reintentar |
| Sin respuesta | «No se pudo conectar con el servidor» | Reintentar con la misma `Idempotency-Key` |
| Fuera de contrato | «El servidor respondió con datos inesperados» | Avisar al equipo |

Las pruebas de este contrato están en `frontend/test/services.test.ts`.
