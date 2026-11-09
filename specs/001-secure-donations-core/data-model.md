# Modelo de datos

Fase 1 de `/speckit-plan`. Las tablas están definidas en [`infra/template.yaml`](../../infra/template.yaml).

## Tablas

| Tabla | Clave primaria | Índice o TTL | Uso |
|---|---|---|---|
| `Projects` | `projectId` | GSI `status-createdAt` | Catálogo y detalle |
| `Donations` | `donationId` | GSI `donorSub-createdAt` | Historial y transición |
| `Idempotency` | `pk = donorSub#createDonation#idempotencyKey` | TTL `expiresAt` (24 h) | Reserva de la clave |
| `AuditEvents` | `eventType` + `sk = timestamp#eventId` | — | Filtro por tipo y fecha |

## Entidades

### Project

| Campo | Tipo | Regla |
|---|---|---|
| `projectId` | UUID | Generado por el backend |
| `title` | texto | Obligatorio, de 1 a 120 caracteres |
| `description` | texto | Obligatorio, de 1 a 2000 caracteres |
| `goalAmountCents` | entero | Mayor que 0 |
| `confirmedAmountCents` | entero | Inicia en 0; solo lo incrementa una confirmación |
| `currency` | texto | Siempre `PEN` |
| `status` | enum | `BORRADOR` o `PUBLICADO` |
| `createdAt`, `updatedAt` | ISO 8601 | Los asigna el backend |

Transición: `BORRADOR` → `PUBLICADO`. Publicar uno ya publicado devuelve 409.

### Donation

| Campo | Tipo | Regla |
|---|---|---|
| `donationId` | UUID | Generado por el backend |
| `projectId` | UUID | Proyecto PUBLICADO al crear |
| `donorSub` | texto | Solo de los claims; nunca del cuerpo |
| `amountCents` | entero | De 100 a 100000 |
| `currency` | texto | Siempre `PEN` |
| `status` | enum | Ver transiciones |
| `createdAt`, `updatedAt` | ISO 8601 | Los asigna el backend |

Transiciones: `PENDIENTE_SIMULACION` → `CONFIRMADA_SIMULADA` o `RECHAZADA_SIMULADA`. Ambos estados son terminales.

### IdempotencyRecord

| Campo | Tipo | Regla |
|---|---|---|
| `pk` | texto | Una clave por usuario y operación |
| `payloadHash` | texto | SHA-256 del cuerpo normalizado |
| `donationId` | UUID | Donación creada |
| `responseStatus` | entero | Código devuelto originalmente |
| `expiresAt` | epoch | 24 horas |

### AuditEvent

| Campo | Tipo | Regla |
|---|---|---|
| `eventType` | texto | Por ejemplo, `PROJECT_CREATED` |
| `sk` | texto | `timestamp#eventId` |
| `requestId` | texto | Correlación con los logs |
| `actorRef` | texto | Seudónimo; nunca el correo ni el `sub` en claro |
| `action`, `resourceRef`, `outcome` | texto | Sin tokens ni datos financieros |

## Escrituras atómicas

Todas las transacciones incluyen además un `Put` en `AuditEvents`, de modo que un cambio no puede quedar sin evidencia.

**Crear donación:** un `TransactWriteItems` con estas operaciones.

1. `ConditionCheck` en `Projects`: `status = PUBLICADO`.
2. `Put` en `Idempotency`: `attribute_not_exists(pk)`.
3. `Put` en `Donations`.

**Simular confirmación:** un `TransactWriteItems` con estas operaciones.

1. `Update` en `Donations`: condición `status = PENDIENTE_SIMULACION AND donorSub = :sub`.
2. `Update` en `Projects`: `confirmedAmountCents + :amount`. Se omite si el resultado es rechazo.

Si una condición falla (`TransactionCanceledException`), se responde 409 sin efectos parciales.

## Invariantes

- Montos siempre en céntimos enteros.
- Una clave de idempotencia por usuario y operación.
- Una confirmación se registra una sola vez.
- El historial se limita al propietario.
- Solo se pasa de pendiente a un estado terminal.
