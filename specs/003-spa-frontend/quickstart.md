# Quickstart: validar la SPA

Guía de validación de punta a punta de la funcionalidad `003` (fase 1 de `/speckit-plan`). Usa solo los usuarios ficticios `@aqp-solidaria.test`; la contraseña se comparte en persona, nunca en el repositorio ni en chats.

## Prerrequisitos

- Node.js 24 y npm.
- Valores de la pila (`ApiUrl`, `CognitoDomain`, `UserPoolId`, `UserPoolClientId`) en `frontend/.env.local`, copiado de `frontend/.env.example`.
- Para los pasos de GESTOR y AUDITOR, el código TOTP si el MFA ya está registrado (AD-09).

## Validación automática

Desde `frontend/`:

```bash
npm ci
```

```bash
npm run lint && npm run typecheck && npm test && npm run build
```

**Resultado esperado**: sin errores de lint ni de tipos, todas las pruebas en verde y la línea `check-csp: … sin código en línea ni dominios externos`.

## Recorrido de aceptación

Arranca con `npm run dev` (o `npm run build && npm run preview` para probar con la CSP de producción) y abre `http://localhost:5173`. Después de publicar, repite el recorrido en la URL de CloudFront. Cierra todas las ventanas privadas y abre una nueva para cada usuario.

| Paso | Usuario | Qué comprobar | Criterio |
|---|---|---|---|
| 1 | Sin sesión | El catálogo carga a 375 px y se recorre con Tab; el foco siempre se ve | HU-01, CA-NF06 |
| 2 | Sin sesión | El detalle muestra identificador, estado, objetivo y monto confirmado, y pide iniciar sesión para donar | CA-02.1, HU-09 |
| 3 | `donante1` | Tras el login, la barra de direcciones ya no muestra `code=` | CA-03.1 |
| 4 | `donante1` | DevTools → Application → Local Storage está vacío | CA-NF11.1, SC-004 |
| 5 | `donante1` | DevTools → Network: el API recibe `Authorization: Bearer` (no copies el valor) | CA-03.2 |
| 6 | `donante1` | Donar S/ 19.99: la solicitud lleva `amountCents: 1999` e `Idempotency-Key` | CA-05.1, CA-05.4 |
| 7 | `donante1` | Simular la confirmación: aparece «Simulación académica: no se ha realizado ningún cobro» y sube el monto confirmado | CA-06.1, CA-06.4 |
| 8 | `donante1` | «Mis donaciones» muestra fecha, importe, proyecto y estado | CA-07.1 |
| 9 | `donante1` | «Cerrar sesión»: Network muestra `POST /oauth2/revoke` con 200 y la redirección a `/logout` | CA-03.3 |
| 10 | `gestor` | Cognito pide el código TOTP; crea un borrador, lo publica y aparece en el catálogo | CA-11.1, CA-08.1, CA-08.2 |
| 11 | `auditor` | Cognito pide el código TOTP; consulta `DONATION_CREATED` y ve el evento del paso 6 | CA-10.1, CA-10.2 |
| 12 | `donante2` | No ve las donaciones de `donante1` | CA-07.1, T12 |
| 13 | Cualquiera | La consola no muestra errores de CSP | CA-NF11.2, SC-003 |

Detalle de cada interfaz: [contracts/api-consumption.md](./contracts/api-consumption.md), [contracts/oidc-cognito.md](./contracts/oidc-cognito.md) y [contracts/ui-routes.md](./contracts/ui-routes.md).

## Evidencia

Guarda las capturas sin tokens, sin direcciones con `code=` y sin el número de cuenta (está en el dominio de Cognito). Entrégalas a QA para `evidence/`.
