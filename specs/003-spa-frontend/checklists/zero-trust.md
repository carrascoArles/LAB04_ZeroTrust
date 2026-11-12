# Checklist de Zero Trust: SPA de AQP-SOLIDARIA

**Propósito**: revisar si los requisitos de la SPA están completos, claros y alineados con NIST SP 800-207 y con `design.md` §6, antes de dar por cerrada la funcionalidad. Evalúa los requisitos, no el código.
**Creada**: 2026-11-11
**Funcionalidad**: [spec.md](../spec.md) · [plan.md](../plan.md) · [contracts/](../contracts/)

**Nota**: lista generada con el procedimiento de `/speckit-checklist`.
**Responsable de la revisión**: integrante de identidad y seguridad (sugerido: Yana Agramonte, Luis Efrain). Se marca `[x]` solo cuando quien revisa confirma que el requisito cumple el criterio.
**Significado de las marcas**: `[x]` indica que el requisito está bien especificado; no indica que el código esté terminado.

## Límite de confianza del navegador

- [ ] CHK001 ¿Queda explícito que la SPA no es un control de seguridad y que el API decide cada solicitud? [Clarity, Spec §FR-015, design.md §3]
- [ ] CHK002 ¿Se especifica qué hace la interfaz cuando el API rechaza con 401, 403 o 409, para que no oculte la decisión del PEP o del PE? [Completeness, Spec §Casos límite, contracts/api-consumption.md]
- [ ] CHK003 ¿Está definido que ningún secreto ni credencial AWS existe en el navegador? [Completeness, Plan §La SPA en la arquitectura Zero Trust, design.md §3]
- [ ] CHK004 ¿Se declara que el `donorSub` nunca sale del navegador ni se acepta del cliente? [Consistency, data-model.md §Donación, CA-05.3]

## Sesión e identidad (Policy Administrator)

- [ ] CHK005 ¿Se exige Authorization Code + PKCE y se prohíbe de forma explícita el flujo implícito? [Clarity, Spec §FR-003, CA-03.1]
- [ ] CHK006 ¿Está especificado qué token se envía al API y cuál nunca debe enviarse? [Clarity, Spec §FR-005, CA-03.2]
- [ ] CHK007 ¿Se define dónde vive cada token y cuánto dura, incluida la excepción del estado temporal de PKCE y su justificación? [Completeness, data-model.md §Dónde vive cada dato, CA-NF11.1]
- [ ] CHK008 ¿El cierre de sesión enumera las tres acciones: revocar el refresh token, borrar la memoria y cerrar la sesión del proveedor? [Completeness, Spec §FR-006, CA-03.3]
- [ ] CHK009 ¿Se documenta la limitación de que un access token revocado sigue vigente hasta 15 minutos? [Coverage, contracts/oidc-cognito.md §Limitación, CA-03.4]
- [ ] CHK010 ¿Queda claro que el MFA lo exige Cognito y que la SPA no puede omitirlo? [Clarity, Spec §Historia 2, CA-11.1]
- [ ] CHK011 ¿Se especifica qué pasa cuando la renovación de la sesión falla? [Coverage, data-model.md §Sesión, Spec §Historia 2 escenario 6]
- [ ] CHK012 ¿Se acota el destino posterior al login a rutas internas, para evitar una redirección abierta? [Coverage, Spec §Casos límite]

## Acceso por recurso y política dinámica

- [ ] CHK013 ¿Cada pantalla indica qué operaciones del API usa y con qué scope? [Traceability, contracts/ui-routes.md, contracts/api-consumption.md]
- [ ] CHK014 ¿Se especifica que ocultar rutas por rol es solo experiencia, con el ejemplo de T03? [Clarity, contracts/ui-routes.md §Regla de Zero Trust]
- [ ] CHK015 ¿Los roles se derivan solo de `cognito:groups` y se ignoran valores desconocidos? [Clarity, data-model.md §Sesión, CA-04.3]

## Integridad de las donaciones

- [ ] CHK016 ¿La conversión de montos está definida sin aritmética de punto flotante y con límites exactos de 100 a 100000? [Clarity, Spec §FR-007, CA-05.1]
- [ ] CHK017 ¿Las reglas de reutilización de la `Idempotency-Key` cubren reintento, cambio de carga y éxito? [Completeness, data-model.md §Intento de donación, CA-05.4]
- [ ] CHK018 ¿Se exige que el cuerpo enviado tenga solo los campos del contrato? [Consistency, contracts/api-consumption.md, CA-05.3]

## Seguridad del navegador y transporte

- [ ] CHK019 ¿Se exige HTTPS para el API y para Cognito, incluido el rechazo de URL `http://` en la configuración? [Completeness, Spec §NFR-003, CA-NF01.1]
- [ ] CHK020 ¿Los requisitos de CSP indican qué está prohibido (scripts y estilos en línea, dominios externos, `eval`)? [Clarity, Spec §NFR-002, research.md F10]
- [ ] CHK021 ¿Hay un criterio medible para comprobar que el sitio publicado no viola la CSP? [Measurability, Spec §SC-003]
- [ ] CHK022 ¿Se especifica que los mensajes de error muestran el `requestId` y nunca tokens? [Completeness, Spec §FR-014, CA-NF01.2]

## Trazabilidad y limitaciones

- [ ] CHK023 ¿Cada principio de NIST SP 800-207 tiene un aporte de la SPA o una limitación declarada? [Coverage, Plan §La SPA en la arquitectura Zero Trust, CA-NF02.3]
- [ ] CHK024 ¿Se declara la falta de postura de dispositivo como limitación del principio 5? [Gap check, design.md §6.3]
- [ ] CHK025 ¿La pérdida de sesión al recargar está declarada como costo aceptado? [Assumption, Spec §Clarifications, research.md F2]

## Notas

- Marca `[x]` solo después de revisar; deja sin marcar lo que necesite aclaración y anota el hallazgo debajo del ítem.
- `/speckit-implement` lee estas marcas como compuerta y no las modifica.
- `checklists/requirements.md` tiene su propio ciclo, a cargo de `/speckit-specify` y `/speckit-clarify`.
