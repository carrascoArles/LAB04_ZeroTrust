# Contrato: SPA y Amazon Cognito

Cognito es el Policy Administrator (design.md §6.1): emite, renueva y revoca las sesiones. La SPA es un client público, sin secreto (`UserPoolClient` en `infra/template.yaml`). Endpoints verificados el 2026-11-11 en el descubrimiento OIDC del user pool.

## Configuración del client

| Parámetro | Valor | Origen |
|---|---|---|
| Emisor (`issuer`) | `https://cognito-idp.us-east-2.amazonaws.com/<UserPoolId>` | Plantilla SAM |
| `client_id` | `UserPoolClientId` | Salida de la pila |
| Flujo | `response_type=code` con PKCE `S256`; sin flujo implícito | CA-03.1; `AllowedOAuthFlows: [code]` |
| Scopes | `openid email api/projects.write api/donations.write api/donations.read api/audit.read` | Los scopes no dan roles: el grupo lo decide `authz` |
| URI de retorno | `<origen>/callback` | `CallbackURLs` de la plantilla |
| URI tras logout | `<origen>/` | `LogoutURLs` de la plantilla |
| Vida del access token | 15 minutos | CA-03.3 |
| Vida del refresh token | 1 día, revocable | `EnableTokenRevocation: true` |

## Intercambios

| Paso | Endpoint | Parámetros que envía la SPA | Resultado |
|---|---|---|---|
| 1. Autorizar | `GET <dominio>/oauth2/authorize` | `client_id`, `redirect_uri`, `response_type=code`, `scope`, `state`, `code_challenge`, `code_challenge_method=S256` | Login administrado; MFA para GESTOR y AUDITOR (CA-11.1) |
| 2. Canjear | `POST <dominio>/oauth2/token` | `grant_type=authorization_code`, `code`, `code_verifier`, `client_id`, `redirect_uri` | Access, ID y refresh token, solo en memoria |
| 3. Renovar | `POST <dominio>/oauth2/token` | `grant_type=refresh_token`, `refresh_token`, `client_id` | Tokens nuevos antes de que venza el access token |
| 4. Revocar | `POST <dominio>/oauth2/revoke` | `token=<refresh_token>`, `client_id` | 200; Cognito invalida el refresh token (CA-03.3) |
| 5. Cerrar sesión | `GET <dominio>/logout` | `client_id`, `logout_uri` | Borra la cookie del login administrado y vuelve a la SPA |

**Nunca** se envía un token en la URL. El `code` de retorno se borra del historial con una navegación `replace`.

## Verificación previa

Preflight CORS desde `http://localhost:5173` (2026-11-11): `/oauth2/token` y `/oauth2/revoke` responden con `Access-Control-Allow-Origin` del origen. La CSP de CloudFront permite `https://*.auth.us-east-2.amazoncognito.com` y `https://cognito-idp.us-east-2.amazonaws.com` en `connect-src`.

## Limitación (CA-03.4, T13)

Revocar el refresh token no invalida el access token ya emitido: el JWT authorizer lo valida localmente y lo acepta hasta que vence, como máximo 15 minutos.
