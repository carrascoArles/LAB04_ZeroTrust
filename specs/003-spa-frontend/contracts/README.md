# Contratos de la SPA

Fase 1 de `/speckit-plan`. La SPA tiene tres interfaces externas:

| Contrato | Con quién | Componente NIST SP 800-207 |
|---|---|---|
| [api-consumption.md](./api-consumption.md) | API de AQP-SOLIDARIA | Policy Enforcement Point (API Gateway) y Policy Engine (`authz`) |
| [oidc-cognito.md](./oidc-cognito.md) | Amazon Cognito | Policy Administrator |
| [ui-routes.md](./ui-routes.md) | Personas usuarias | Recurso servido por CloudFront (PEP del frontend) |

El contrato del API no se copia: la fuente única es [`docs/api.yaml`](../../../docs/api.yaml), igual a `specs/001-secure-donations-core/contracts/api.yaml`. Una copia en esta carpeta podría quedar desactualizada sin que nadie lo note.
