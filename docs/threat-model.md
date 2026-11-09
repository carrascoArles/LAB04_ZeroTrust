# Modelo de amenazas y mapeo Zero Trust

Alcance: arquitectura de [`infra/template.yaml`](../infra/template.yaml) y backend de `backend/src/`. El backend tiene pruebas locales, pero nada está desplegado: las pruebas que dependen de AWS (T02, T10, T11, T13 y T14) siguen pendientes.

## Límites de confianza

| Límite | Lado no confiable | Quién verifica | Qué se verifica |
|---|---|---|---|
| L1 | Navegador | API Gateway (JWT authorizer) | Emisor, firma, expiración, `client_id` y scope |
| L2 | Claims ya verificados y datos del cuerpo | Lambda (`authz`) | Rol, propietario del recurso, reglas de negocio y esquema Zod |
| L3 | Función Lambda | IAM | Solo las acciones y tablas de esa función |
| L4 | Internet | CloudFront + OAC | HTTPS; el bucket S3 no tiene acceso público |

## STRIDE resumido

| Amenaza | Ejemplo | Control | Verificación prevista |
|---|---|---|---|
| Suplantación | Token alterado o ID token como Bearer | JWT authorizer + scopes por ruta | T02, T11 |
| Suplantación | Credenciales robadas de un gestor | MFA TOTP (ver AD-09) | T14 |
| Manipulación | Monto o `donorSub` alterados en el cliente | Zod en backend; `donorSub` solo desde claims | T04, CA-05.3 |
| Manipulación | Doble conteo por concurrencia | `TransactWriteItems` condicionado | T06–T08 |
| Repudio | Negar una publicación | `AuditEvents` + logs con `requestId` + CloudTrail | CA-08.3, CA-NF07.2 |
| Divulgación | Ver una donación ajena (BOLA) | Ownership por `sub` | T09, T12 |
| Divulgación | Token robado por XSS | Tokens en memoria, CSP, vida ≤ 15 min | CA-NF11.1–2, T13 |
| Denegación de servicio | Abuso del API | Throttling del stage; límites de Cognito | Configuración SAM |
| Elevación de privilegios | Donante crea un proyecto | RBAC por `cognito:groups` en Lambda | T03 |
| Elevación de privilegios | Función comprometida escribe en otra tabla | Un rol IAM por función | T10 |

## Componentes NIST SP 800-207

| Componente | Implementación |
|---|---|
| Policy Enforcement Point (PEP) | API Gateway HTTP API con JWT authorizer y scopes; CloudFront para el frontend |
| Policy Engine (PE) | Módulo `authz` en Lambda (MVP); Verified Permissions + Cedar (extensión HU-12) |
| Policy Administrator (PA) | Cognito: emite, renueva y revoca tokens de sesión |
| Fuentes de información | Claims de Cognito, estado del recurso en DynamoDB, CloudWatch y CloudTrail |

## Los 7 principios de NIST SP 800-207

| # | Principio | Control | Evidencia prevista |
|---|---|---|---|
| 1 | Todo dato y servicio es un recurso | Cada endpoint y tabla con política explícita | Tabla de endpoints, políticas IAM |
| 2 | Comunicación segura sin importar la red | HTTPS en CloudFront y API Gateway | CA-NF01.1 |
| 3 | Acceso por sesión y por recurso | Token ≤ 15 min, scopes por ruta, ownership | T09, T11, T13 |
| 4 | Política dinámica | Decisión por solicitud: identidad, grupo, estado y stage | T03, T12 |
| 5 | Monitorear la postura de los activos | **Parcial:** CloudTrail y revisión de dependencias en CI; sin postura de dispositivo | Limitación declarada |
| 6 | Autenticación y autorización estrictas | JWT authorizer + `authz` + MFA en roles privilegiados | T02, T11, T14 |
| 7 | Recolectar información para mejorar | Logs JSON, `AuditEvents`, CloudTrail | CA-NF07.2 |

## AD-09: MFA obligatorio solo para GESTOR y AUDITOR

Esta decisión no está en `design.md`: surgió al modelar la plantilla SAM.

**Problema:** en Cognito, la configuración de MFA es por user pool, no por grupo. Con `ON` el MFA sería obligatorio también para DONANTE, y `requirements.md` lo define como opcional. Con `OPTIONAL`, nada impide por sí solo que un gestor inicie sesión sin segundo factor.

**Decisión:** `MfaConfiguration: OPTIONAL`, solo TOTP, con este aprovisionamiento controlado:

1. Crear el usuario sin ningún grupo.
2. El usuario registra su TOTP con `scripts/enroll-mfa.sh`, que usa un app client separado cuyos tokens el API rechaza.
3. Comprobar con `admin-get-user` que `UserMFASettingList` contiene `SOFTWARE_TOKEN_MFA`.
4. Recién entonces, agregarlo al grupo `GESTOR` o `AUDITOR`.

**Riesgo residual:** el control es operativo. Si alguien agrega a un usuario al grupo sin seguir los pasos, ese usuario entra sin MFA. La prueba T14 lo evidencia para los usuarios de la demo. Si el equipo prefiere una garantía técnica, la alternativa es `MfaConfiguration: ON`, a costa de exigir MFA también a DONANTE; esa decisión debe consultarse con el docente.

## Limitaciones declaradas

- **Revocación:** el JWT authorizer valida localmente; un access token revocado sigue siendo aceptado hasta expirar (máximo 15 min). Se demuestra en T13.
- **Sin postura de dispositivo ni evaluación continua de riesgo:** Verified Access y la protección contra amenazas de Cognito Plus quedan fuera del Free plan.
- **GuardDuty y Security Hub:** fuera de alcance según `requirements.md`; no se incluyen en la plantilla.
- **WAF:** HTTP API no se integra con AWS WAF.
- **PKCE:** lo inicia el cliente (`oidc-client-ts`). Debe verificarse en la implementación que Cognito rechace un intercambio de código sin `code_verifier` cuando la autorización se inició con `code_challenge`, y documentar el resultado.
- **ID token frente a CA-03.2:** al exigir scopes, el JWT authorizer podría responder 403 en lugar de 401 ante un ID token. La solicitud se rechaza de todos modos, pero debe comprobarse en AWS (T11) y, si es 403, declararse o ajustarse.
- **Team members:** la nueva experiencia de AWS no usa usuarios IAM para personas, como pide CA-NF03.3. Pendiente de confirmar con el docente.
- **Sin límite por usuario:** el throttling es por stage (25 solicitudes por segundo, ráfagas de 50). Un solo usuario podría agotarlo; `design.md` no exige más. Una versión real necesitaría límites por identidad.
- **Cuenta compartida:** el aislamiento entre integrantes depende de IAM y de la disciplina del equipo.
