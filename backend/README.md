# Backend

API de AQP-SOLIDARIA en TypeScript sobre Node.js 24: 10 handlers Lambda, uno por ruta de [`docs/api.yaml`](../docs/api.yaml). **Sin desplegar todavía.**

## Módulos

| Carpeta          | Responsabilidad                                                                |
| ---------------- | ------------------------------------------------------------------------------ |
| `src/authz/`     | Policy Engine: identidad solo desde claims verificados, rol, scope y seudónimo |
| `src/projects/`  | Catálogo público y gestión por GESTOR                                          |
| `src/donations/` | Intención idempotente, simulación e historial del propietario                  |
| `src/audit/`     | Eventos dentro de la transacción y consulta por AUDITOR                        |
| `src/shared/`    | Errores, envoltorio HTTP, logs, esquemas Zod y cliente DynamoDB                |

## Controles de seguridad

| Control                                                           | Dónde                             | Prueba                 |
| ----------------------------------------------------------------- | --------------------------------- | ---------------------- |
| Identidad y rol solo desde claims; falla cerrada                  | `authz/index.ts`                  | `authz.test.ts`        |
| Ajena e inexistente responden igual (BOLA)                        | `donations/get.ts`, `simulate.ts` | T09                    |
| Esquemas estrictos: `donorSub` o tarjeta en el cuerpo se rechazan | `shared/schemas.ts`               | T04, CA-05.3, CA-05.5  |
| Idempotencia atómica por usuario                                  | `donations/create.ts`             | T06, T07               |
| Transición única bajo concurrencia                                | `donations/simulate.ts`           | T08                    |
| Auditoría en la misma transacción que el cambio                   | `audit/record.ts`                 | CA-08.3                |
| Logs con lista blanca de campos; errores sin detalles internos    | `shared/logger.ts`, `http.ts`     | `logging.test.ts`, T10 |
| Cada operación permitida por el rol IAM de su función             | `infra/template.yaml`             | `template.test.ts`     |

## Comandos

```bash
npm ci
```

```bash
npm run lint
```

```bash
npm run typecheck
```

```bash
npm test
```

```bash
npm run build
```

`npm test` usa un motor DynamoDB en memoria que evalúa las expresiones reales. Para probar contra DynamoDB Local:

```bash
docker run -d --rm --name aqp-dynamodb -p 8765:8000 amazon/dynamodb-local:latest
```

```bash
DYNAMODB_ENDPOINT=http://localhost:8765 npm test
```

En PowerShell, define antes la variable con `$env:DYNAMODB_ENDPOINT = "http://localhost:8765"`.

## Versiones

Se usa TypeScript 6.0 y no el 7.0 que menciona `design.md`, porque typescript-eslint 8 admite como máximo `<6.1.0` (permitido por `design.md` §2 ante incompatibilidades).
