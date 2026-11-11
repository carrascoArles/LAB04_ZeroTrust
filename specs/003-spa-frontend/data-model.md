# Modelo de datos del cliente: SPA de AQP-SOLIDARIA

Fase 1 de `/speckit-plan`. La SPA no tiene base de datos: estas entidades son las vistas que recibe del API (definidas en `docs/api.yaml` y en `requirements.md` §4) y el estado que mantiene mientras la pestaña está abierta. La fuente de verdad sigue siendo el backend (constitución, principio II).

## Dónde vive cada dato

Es la decisión de Zero Trust más importante del cliente: el navegador no es confiable, así que guarda lo mínimo y por el menor tiempo posible.

| Dato | Dónde vive | Cuánto dura | Por qué |
|---|---|---|---|
| Access token, ID token y refresh token | Memoria (`InMemoryWebStorage`) | Hasta cerrar sesión, recargar o cerrar la pestaña | CA-NF11.1: un XSS no los encuentra en almacenamiento persistente |
| `state` y `code_verifier` de PKCE | `sessionStorage` de la pestaña | Solo durante el viaje de ida y vuelta a Cognito | Deben sobrevivir a la redirección; se borran al procesar el callback (research.md F3) |
| Datos de proyectos y donaciones | Caché en memoria de TanStack Query | 30 s antes de volver a pedirlos | Se pierden al recargar |
| Intento de donación pendiente | Memoria del formulario | Hasta que el envío tiene éxito | CA-05.4 |
| Borradores de la sesión (GESTOR) | Memoria de la pantalla | Hasta salir de la pantalla | El API no lista borradores |
| Tarjeta, cuenta bancaria, DNI | En ningún lado | — | CA-05.5: nunca se piden |

## Entidades

### Sesión

Identidad verificada por Cognito (el Policy Administrator). La SPA la usa solo para adaptar la interfaz.

| Campo | Origen | Regla |
|---|---|---|
| `sub` | Claim del ID token | Solo para separar la caché por usuario |
| `email` | Claim `email` | Solo correos de prueba `@aqp-solidaria.test` (CA-NF10.1) |
| `roles` | Claim `cognito:groups` | Solo se reconocen `DONANTE`, `GESTOR` y `AUDITOR`; cualquier otro valor se ignora |
| `accessToken` | Respuesta del token endpoint | Vida de 15 minutos o menos (CA-03.3); se envía al API |
| `sessionExpired` | Evento de expiración | Muestra el aviso para volver a iniciar sesión |

**Estados**:

```text
anónimo ──Iniciar sesión──▶ redirigiendo a Cognito ──código + PKCE──▶ autenticado
autenticado ──renovación con refresh token──▶ autenticado
autenticado ──token vencido sin renovar──▶ expirado ──Iniciar sesión──▶ redirigiendo
autenticado ──Cerrar sesión: revoca y borra──▶ anónimo (sesión de Cognito cerrada)
cualquiera ──recargar la página──▶ anónimo
```

### Proyecto (`ProjectPublic`)

| Campo | Tipo | Regla de validación |
|---|---|---|
| `projectId` | UUID | Se muestra en el detalle (CA-02.1) |
| `title` | Texto | 1 a 120 caracteres al crear (CA-08.1) |
| `description` | Texto | 1 a 2000 caracteres al crear; es la finalidad del catálogo (CA-01.1) |
| `goalAmountCents` | Entero ≥ 1 | Meta en céntimos de PEN |
| `confirmedAmountCents` | Entero ≥ 0 | Solo confirmadas; excluye pendientes y rechazadas (CA-09.1) |
| `currency` | `PEN` | Constante |
| `status` | `BORRADOR` o `PUBLICADO` | El catálogo solo recibe PUBLICADO (CA-01.2) |

**Estados**: `BORRADOR ──publicar (GESTOR)──▶ PUBLICADO`. Publicar dos veces responde 409 (CA-08.2).

### Donación (`Donation`)

| Campo | Tipo | Regla de validación |
|---|---|---|
| `donationId` | UUID | Se muestra en el historial |
| `projectId` | UUID | Enlaza al detalle |
| `amountCents` | Entero | Entre 100 y 100000 al crear (CA-05.1) |
| `currency` | `PEN` | Constante |
| `status` | Ver estados | |
| `createdAt` | Fecha ISO 8601 | Se muestra en hora de Lima |

El `donorSub` nunca llega al navegador ni sale de él: el backend lo toma del token (CA-05.3).

**Estados** (requirements.md §4):

```text
PENDIENTE_SIMULACION ──Simular confirmación──▶ CONFIRMADA_SIMULADA  (suma al monto confirmado)
PENDIENTE_SIMULACION ──Simular rechazo──────▶ RECHAZADA_SIMULADA   (no cambia las cifras)
estado terminal ──cualquier simulación──▶ 409 (CA-06.2)
```

### Intento de donación

Estado del cliente, sin equivalente en el API.

| Campo | Regla |
|---|---|
| `payload` | `{ projectId, amountCents }`; nunca otros campos (CA-05.3) |
| `idempotencyKey` | UUID de `crypto.randomUUID()` |

**Reglas**: misma carga tras un fallo → misma clave (T06); carga distinta → clave nueva (T07); éxito → se descarta el intento.

### Evento de auditoría (`AuditEvent`)

| Campo | Regla |
|---|---|
| `timestamp`, `requestId`, `action`, `resourceRef`, `outcome` | Se muestran tal como llegan |
| `actorRef` | Seudónimo `usr_…`; nunca el `sub` ni el correo (CA-10.2) |

**Filtro**: `eventType` obligatorio; `from` y `to` opcionales, enviados en ISO 8601 con zona horaria.

### Error del API (`Error`)

| Campo | Uso en la SPA |
|---|---|
| `code` | Se interpreta junto con el código HTTP |
| `message` | Se muestra si el código es 400, 404 o 409 |
| `requestId` | Se muestra como «Código de referencia» para reportar el problema |

Los rechazos del JWT authorizer (`{"message": "Unauthorized"}`) no tienen este formato; se explican por el código HTTP.
