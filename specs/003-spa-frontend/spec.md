# Especificación de funcionalidad: SPA de AQP-SOLIDARIA

**Rama de la funcionalidad**: `003-spa-frontend`

**Creada**: 2026-11-11

**Responsable**: Huamaní Vargas, Melsy Melany (frontend; SPA y publicación)

**Estado**: Clarificada; implementada en local; pendiente de publicar

**Entrada**: "SPA React accesible, publicada por HTTPS, que permite a los cuatro roles usar la Plataforma de Donaciones Seguras a través del API ya desplegado de `001-secure-donations-core`, sin cambiar su contrato y sin que la interfaz se convierta en un control de seguridad. Fuentes del docente: `requirements.md` v2.0 y `design.md` v2.0."

> Cada historia conserva sus identificadores de `requirements.md` (HU, CA, RNF-HU) para la trazabilidad. Esta funcionalidad solo agrega la interfaz: el contrato (`docs/api.yaml`) y el backend de `001` no cambian.

## Clarifications

### Session 2026-11-11

Todas las preguntas se resolvieron con las fuentes del docente, el contrato o las decisiones de `001`; ninguna quedó abierta.

- Q: `TAREAS_EQUIPO.md` dice que los montos van de 1 a 100000 céntimos, pero el contrato dice `minimum: 100`. ¿Cuál se usa? → A: El de CA-05.1: de S/ 1.00 a S/ 1,000.00 (100 a 100000 céntimos), igual que el contrato y el backend.
- Q: El API no lista proyectos en BORRADOR. ¿Cómo publica el GESTOR un borrador? → A: La interfaz muestra los borradores creados en la sesión y permite publicar otro por su identificador. No se agrega ninguna ruta al API (FR-001).
- Q: ¿Dónde se guarda el estado temporal del inicio de sesión, que debe sobrevivir a la redirección hacia Cognito? → A: En el almacenamiento de la pestaña, solo durante el inicio de sesión, y se borra al volver. Los tokens quedan solo en memoria (CA-NF11.1). La alternativa se justifica en el informe, como pide CA-NF11.1.
- Q: ¿Qué dirección de retorno usa el inicio de sesión? → A: La del origen desde el que se abrió la SPA, más `/callback`. El proveedor de identidad solo acepta las direcciones registradas.
- Q: ¿Qué pasa al recargar la página? → A: La sesión en memoria se pierde y el usuario vuelve a iniciar sesión (R6 de `001`).

## Escenarios de usuario y pruebas *(obligatorio)*

### Historia 1 - Explorar el catálogo y el detalle (Prioridad: P1) · HU-01, HU-02, HU-09

Como visitante, quiero ver los proyectos publicados, su detalle y su avance confirmado sin iniciar sesión, para elegir una causa.

**Por qué esta prioridad**: es la primera demostración pública y no requiere identidad.

**Prueba independiente**: abrir la SPA sin sesión y recorrerla con teclado a 375 px.

**Escenarios de aceptación**:

1. **Dados** proyectos PUBLICADO, **cuando** se abre el catálogo, **entonces** cada uno muestra nombre, finalidad, meta en PEN y suma confirmada (CA-01.1, CA-09.1).
2. **Dado** un catálogo sin proyectos, **entonces** se muestra un estado vacío comprensible, sin errores técnicos (CA-01.3).
3. **Dado** un proyecto publicado, **cuando** se abre su detalle, **entonces** se ven su identificador, descripción, objetivo, estado y monto acumulado, sin datos de donantes (CA-02.1, CA-09.2).
4. **Dado** un identificador inexistente o no publicado, **entonces** se informa que el proyecto no existe, sin mostrar contenido (CA-02.2).
5. **Dada** una falla del servicio, **entonces** se muestra un mensaje claro con su código de referencia y se puede reintentar.

---

### Historia 2 - Iniciar y cerrar sesión (Prioridad: P1) · HU-03, HU-11

Como usuario de prueba, quiero iniciar y cerrar sesión de forma segura para que mis acciones tengan una identidad verificable.

**Por qué esta prioridad**: todas las operaciones protegidas dependen de ella.

**Prueba independiente**: iniciar sesión con los cuatro roles, cerrar sesión y entrar con otro usuario.

**Escenarios de aceptación**:

1. **Dado** «Iniciar sesión», **entonces** se usa el login administrado de Cognito con Authorization Code + PKCE, nunca el flujo implícito (CA-03.1).
2. **Dado** un GESTOR o AUDITOR, **entonces** el segundo factor lo exige el proveedor de identidad; la SPA no lo omite ni lo reemplaza (CA-11.1).
3. **Dado** un inicio de sesión correcto, **entonces** los tokens quedan solo en memoria, nada en `localStorage`, y la barra de direcciones deja de mostrar el código de autorización (CA-NF11.1).
4. **Dada** una llamada protegida, **entonces** se envía el access token, nunca el ID token (CA-03.2, CA-NF02.1).
5. **Dado** «Cerrar sesión», **entonces** se revoca el refresh token, se borran los tokens de memoria y se cierra la sesión del proveedor (CA-03.3).
6. **Dada** una sesión vencida o un rechazo 401, **entonces** se pide volver a iniciar sesión.

---

### Historia 3 - Donar y simular (Prioridad: P1) · HU-05, HU-06

Como DONANTE, quiero registrar una intención de donación y simular su resultado.

**Por qué esta prioridad**: es el flujo principal del negocio y la demostración de integridad.

**Prueba independiente**: donar S/ 19.99, reintentar el envío y simular la confirmación.

**Escenarios de aceptación**:

1. **Dado** «19.99» o «19,99», **entonces** se envía `amountCents: 1999`, convertido sin aritmética de punto flotante (CA-05.1).
2. **Dado** un monto menor que S/ 1.00, mayor que S/ 1,000.00, con más de dos decimales o no numérico, **entonces** el formulario lo explica antes de enviar (CA-05.2).
3. **Dado** un envío, **entonces** lleva una `Idempotency-Key` nueva; si se reintenta el mismo envío, la misma clave; si cambia el monto, otra clave (CA-05.4).
4. **Dado** el formulario, **entonces** no pide datos de tarjeta, cuenta bancaria ni DNI y advierte que no se procesan pagos (CA-05.5).
5. **Dada** una intención creada, **cuando** el donante simula confirmación o rechazo, **entonces** se muestra «Simulación académica: no se ha realizado ningún cobro» y se actualizan las cifras (CA-06.1, CA-06.4).
6. **Dada** una transición repetida, **entonces** se muestra el rechazo 409 del API sin ocultarlo (CA-06.2).
7. **Dado** un usuario sin el rol DONANTE, **entonces** no se ofrece el formulario y se explica por qué; el API sigue decidiendo (CA-04.1, T03).

---

### Historia 4 - Consultar el historial propio (Prioridad: P1) · HU-07

Como DONANTE, quiero ver mis donaciones simuladas y su estado.

**Por qué esta prioridad**: es la evidencia visible de que el sistema separa datos por propietario.

**Prueba independiente**: dos donantes con donaciones distintas.

**Escenarios de aceptación**:

1. **Dado** un donante, **entonces** ve solo lo que el API devuelve para su identidad, con fecha, importe, proyecto y estado (CA-07.1).
2. **Dada** una donación pendiente, **entonces** puede simularla desde el historial (CA-06.1).
3. **Dado** un historial vacío, **entonces** se muestra un estado vacío con un enlace al catálogo.

---

### Historia 5 - Gestionar proyectos (Prioridad: P2) · HU-08

Como GESTOR, quiero crear proyectos en BORRADOR y publicarlos.

**Por qué esta prioridad**: el catálogo ya tiene proyectos de prueba; la gestión también se demuestra con los scripts.

**Prueba independiente**: crear un borrador, publicarlo y verlo en el catálogo.

**Escenarios de aceptación**:

1. **Dados** título (1–120), descripción (1–2000) y objetivo positivo en PEN, **entonces** se crea el BORRADOR (CA-08.1).
2. **Dado** un borrador, **cuando** se publica, **entonces** aparece en el catálogo (CA-08.2).
3. **Dado** un proyecto ya publicado, **cuando** se publica por identificador, **entonces** se muestra el 409 del API (CA-08.2).

---

### Historia 6 - Consultar auditoría (Prioridad: P3, extensión) · HU-10

Como AUDITOR, quiero filtrar eventos por tipo y fecha.

**Por qué esta prioridad**: es extensión; suma puntos, pero no es necesaria para la nota máxima.

**Prueba independiente**: consultar `DONATION_CREATED` después de una donación.

**Escenarios de aceptación**:

1. **Dados** un tipo de evento y un rango opcional, **entonces** se muestran fecha, `requestId`, actor seudonimizado, recurso, acción y resultado (CA-10.1, CA-10.2).
2. **Dada** la tabla a 375 px, **entonces** se puede desplazar con teclado (CA-NF06.1).

---

### Casos límite

- Token vencido durante el uso: el API responde 401 y se pide volver a iniciar sesión.
- Respuesta del API que no cumple el contrato: se trata como error, sin mostrar datos parciales.
- Rechazo del PEP sin el formato de error uniforme: se explica según el código HTTP.
- Retorno del login procesado dos veces: el código de autorización se canjea una sola vez.
- Destino posterior al login manipulado: solo se aceptan rutas internas.
- Configuración incompleta: se muestra qué falta en lugar de una pantalla en blanco.

## Requisitos *(obligatorio)*

### Requisitos funcionales

- **FR-001**: La SPA DEBE usar solo las operaciones de `docs/api.yaml`, con sus métodos, rutas, cabeceras y cuerpos (design.md §4).
- **FR-002**: La SPA DEBE validar cada respuesta contra el contrato antes de mostrarla.
- **FR-003**: El inicio de sesión DEBE usar Authorization Code + PKCE con el login administrado de Cognito y pedir solo los scopes del API (CA-03.1).
- **FR-004**: Los tokens DEBEN vivir solo en memoria; se prohíbe `localStorage` (CA-NF11.1).
- **FR-005**: Las llamadas protegidas DEBEN enviar el access token como `Authorization: Bearer` (CA-03.2).
- **FR-006**: El cierre de sesión DEBE revocar el refresh token, borrar los tokens y cerrar la sesión del proveedor (CA-03.3).
- **FR-007**: Los montos DEBEN convertirse de texto a céntimos enteros, entre 100 y 100000 para donar (CA-05.1, CA-05.2).
- **FR-008**: Cada intento de donación DEBE llevar una `Idempotency-Key` UUID, reutilizada solo al reintentar la misma carga (CA-05.4).
- **FR-009**: La SPA NO DEBE pedir datos de pago ni DNI (CA-05.5).
- **FR-010**: La simulación DEBE mostrar «Simulación académica: no se ha realizado ningún cobro» (CA-06.4).
- **FR-011**: El detalle DEBE mostrar identificador, descripción, objetivo, estado y monto acumulado (CA-02.1).
- **FR-012**: El historial DEBE mostrar fecha, importe, proyecto y estado de cada donación (CA-07.1).
- **FR-013**: Toda pantalla DEBE informar que es un prototipo académico y la nota de la Ley N.º 29733 (CA-NF10.2).
- **FR-014**: Los errores DEBEN mostrar un mensaje comprensible y, si existe, el `requestId`; nunca tokens (CA-NF01.2).
- **FR-015**: La navegación por rol es solo de experiencia; ocultar una opción no reemplaza la autorización del API (requirements.md §1, CA-NF02.2).

### Requisitos no funcionales

- **NFR-001 (CA-NF06.1–2)**: Usable a 375 px y con teclado; etiquetas, foco visible y mensajes accesibles; se evalúan los criterios WCAG 2.2 AA aplicables.
- **NFR-002 (CA-NF11.2)**: Compatible con la CSP de CloudFront: sin scripts ni estilos en línea y sin recursos de otros dominios.
- **NFR-003 (CA-NF01.1)**: Servida solo por HTTPS desde CloudFront.
- **NFR-004 (CA-NF08.1)**: Lint, typecheck, pruebas y build en CI.

### Entidades clave

- **Sesión**: identidad verificada del usuario (identificador, correo de prueba y roles) y sus tokens, que existen solo mientras la pestaña está abierta.
- **Proyecto (vista pública)**: título, finalidad, meta, monto confirmado y estado; nunca datos de donantes.
- **Donación**: intención simulada del usuario, con monto, estado y fecha.
- **Intento de donación**: carga enviada y su clave de idempotencia, hasta que el envío tiene éxito.
- **Evento de auditoría**: acción crítica con actor seudonimizado.

Detalle en [data-model.md](./data-model.md).

## Criterios de éxito *(obligatorio)*

- **SC-001**: Los cuatro roles inician sesión desde la URL pública y solo ven las opciones de su rol (requirements.md §5, demo).
- **SC-002**: Donar, simular y ver el historial se completa en un celular de 375 px, solo con pantalla táctil o solo con teclado (CA-NF06.1).
- **SC-003**: El sitio publicado no provoca ninguna violación de la política de seguridad de contenido (CA-NF11.2).
- **SC-004**: Después de usar la SPA, el almacenamiento persistente del navegador no contiene tokens (CA-NF11.1).
- **SC-005**: El 100 % de los criterios CA de esta especificación tiene una prueba automática o un paso del recorrido de aceptación (requirements.md §7).

## Supuestos

- El API de `001` está desplegado en `us-east-2` y acepta `localhost:5173` en CORS y en Cognito.
- La CSP, HSTS y demás cabeceras las entrega CloudFront (`infra/template.yaml`); la SPA no las define.
- El MFA de GESTOR y AUDITOR lo exige Cognito, según la configuración de `infra/template.yaml` (AD-09).
- La pila tecnológica la fija `design.md` §2: React, Vite, Tailwind CSS, React Router, React Hook Form, Zod, TanStack Query y `oidc-client-ts`.
