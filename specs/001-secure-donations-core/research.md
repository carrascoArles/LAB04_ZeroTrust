# Research: decisiones técnicas

Fase 0 de `/speckit-plan`. Los datos de servicios y versiones provienen de `design.md` v2.0 (verificado por el docente a 2026-11-02). Deben confirmarse en la documentación oficial de AWS antes de desplegar.

## R1. Tipo de API

- **Decisión**: API Gateway HTTP API con JWT authorizer.
- **Justificación**: valida emisor, firma, expiración y `client_id` sin código propio, y permite exigir scopes por ruta.
- **Alternativas**: REST API (admite WAF, pero es más compleja y no se necesita); Lambda authorizer con lista de revocación (resuelve la revocación inmediata, pero añade latencia y código de seguridad propio).

## R2. Vida del token frente a la revocación

- **Decisión**: access token de 15 minutos y refresh token revocable.
- **Justificación**: el JWT authorizer no consulta revocaciones, así que la vida corta acota la exposición.
- **Consecuencia**: la limitación se demuestra en T13 en lugar de ocultarse.

## R3. Granularidad de Lambda

- **Decisión**: una función y un rol por caso de uso.
- **Justificación**: es la forma más directa de demostrar que la función de listado no puede escribir (T10).
- **Alternativas**: una función por módulo: menos recursos, pero roles más amplios.

## R4. Idempotencia y concurrencia

- **Decisión**: `TransactWriteItems` con `attribute_not_exists(pk)` para la clave y `status = PENDIENTE_SIMULACION` para la transición.
- **Justificación**: evita la condición de carrera de «leer y luego escribir», sin bloqueos.
- **Alternativas**: comprobar y escribir en dos pasos (no atómico); una cola FIFO (costo y complejidad innecesarios).

## R5. MFA solo para roles privilegiados

- **Decisión**: `MfaConfiguration: OPTIONAL`, solo TOTP, con aprovisionamiento controlado: primero el TOTP y después el grupo (AD-09).
- **Justificación**: la configuración de MFA de Cognito es por user pool; `ON` también obligaría a DONANTE.
- **Alternativas**: `ON` para todos (garantía técnica, pero contradice «Opcional» en la matriz de roles); dos user pools (duplica la administración y el authorizer).
- **Riesgo residual**: control operativo; ver [threat-model.md](../../docs/threat-model.md).

## R6. Almacenamiento de tokens

- **Decisión**: en memoria, con `oidc-client-ts`.
- **Justificación**: reduce el impacto de un XSS; lo exige CA-NF11.1.
- **Consecuencia**: al recargar la página se pierde la sesión en memoria. Es un costo de experiencia aceptado.

## R7. Dependencia circular en la CSP

- **Decisión**: `connect-src` con comodín regional de `execute-api` y `amazoncognito`.
- **Justificación**: el CORS del API necesita el dominio de CloudFront, y CloudFront necesita la política de cabeceras. Si la CSP citara la URL del API, se formaría un ciclo en CloudFormation.
- **Alternativas**: actualizar la CSP en un segundo paso de despliegue (más estricta, pero menos reproducible). Puede adoptarse al endurecer el sistema (día 6).

## R8. Servicios fuera de alcance

- **Decisión**: no incluir GuardDuty, Security Hub ni Verified Access en la plantilla.
- **Justificación**: `requirements.md` y `design.md` AD-06 los declaran fuera de alcance.

## R9. Auditoría dentro de la transacción

- **Decisión**: el `AuditEvent` se escribe en el mismo `TransactWriteItems` que el cambio.
- **Justificación**: CA-08.3 pide que toda creación y publicación quede registrada. Con dos escrituras separadas, una falla entre ambas dejaría un cambio sin evidencia.
- **Consecuencia**: si la auditoría no se puede escribir, el cambio no se aplica.

## R10. Motor de pruebas

- **Decisión**: una sola batería con dos motores: en memoria (sin dependencias, evalúa las expresiones reales) y DynamoDB Local (también en CI).
- **Justificación**: el motor en memoria da retroalimentación inmediata; DynamoDB Local comprueba el comportamiento real de las condiciones y transacciones.
- **Limitación**: ninguno de los dos valida IAM ni el JWT authorizer. Eso se verifica en AWS (T02, T10, T11, T13 y T14).
