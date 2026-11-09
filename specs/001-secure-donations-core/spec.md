# Especificación de funcionalidad: Núcleo de la Plataforma de Donaciones Seguras

**Rama de la funcionalidad**: `001-secure-donations-core`

**Creada**: 2026-11-09

**Estado**: Clarificada; backend implementado, sin desplegar

**Entrada**: "Plataforma de Donaciones Seguras AQP-SOLIDARIA: la Fundación AQP-SOLIDARIA publica proyectos sociales y recibe intenciones de donación simuladas, verificables y auditables, con seguridad Zero Trust. Fuente: `requirements.md` v2.0 y `design.md` v2.0."

> Cada historia conserva su identificador de `requirements.md` (HU, CA, T) para mantener la trazabilidad. Los criterios completos están en ese documento.

## Clarifications

### Session 2026-11-09

- Q: `T09` y `CA-07.2` piden consultar una donación ajena, pero `design.md` no define ninguna ruta de lectura por id. ¿Cómo se verifica? → A: Se agrega `GET /v1/donations/{donationId}`, solo para DONANTE propietario. La tabla de `design.md` se titula «endpoints mínimos», así que la adición no la contradice.
- Q: Cuando un donante consulta una donación ajena, ¿se responde 403 o 404? → A: 404, igual que si no existiera, para no revelar que el identificador es válido.
- Q: `CA-04.2`: ¿qué responde `GET /v1/donations/me` a un GESTOR? → A: 403, porque la ruta exige el grupo DONANTE. Se añade 403 al contrato; `design.md` solo lista 200 y 401.
- Q: Cognito no configura el MFA por grupo. ¿Cómo se exige solo a GESTOR y AUDITOR manteniéndolo opcional para DONANTE? → A: `MfaConfiguration: OPTIONAL`, solo TOTP. El usuario se agrega al grupo privilegiado únicamente después de verificar su TOTP (decisión AD-09). El riesgo residual es operativo y queda declarado.
- Q: ¿Los scopes distinguen roles? → A: No. El app client de la SPA puede solicitar todos los scopes; el scope exige un access token en el PEP y el grupo se decide en Lambda. Por eso un donante que intenta crear un proyecto recibe 403 de Lambda (T03) y no 401.
- Q: ¿Quién elige el resultado de la simulación? → A: El propio donante, enviando `outcome` en el cuerpo (`CONFIRMADA_SIMULADA` o `RECHAZADA_SIMULADA`), según `CA-06.1`.
- Q: ¿Se admite el autorregistro de usuarios? → A: No. Las cuentas de prueba las crea el equipo, para evitar el ingreso de datos reales (`CA-NF10.1`). `AllowAdminCreateUserOnly: true`.
- Q: ¿Qué eventos se escriben en `AuditEvents` y cuáles solo en logs? → A: En `AuditEvents`: crear o publicar proyecto, crear donación y simular. Los rechazos 401 y 403 quedan en logs de CloudWatch (`CA-NF07.2`).
- Q: La nueva experiencia de AWS no crea usuarios IAM para personas. ¿Cómo se cumple `CA-NF03.3`? → A: Cada integrante se invita como team member desde AWS Settings, con credenciales temporales y sin llaves de larga duración. La adaptación está pendiente de confirmación con el docente.

## Escenarios de usuario y pruebas *(obligatorio)*

### Historia 1 - Explorar proyectos e indicadores (Prioridad: P1) · HU-01, HU-02, HU-09

Como visitante, quiero ver los proyectos publicados, su detalle y su avance confirmado para elegir una causa.

**Por qué esta prioridad**: es la primera demostración pública y no requiere autenticación.

**Prueba independiente**: con datos semilla, un cliente sin token lista proyectos y no recibe borradores.

**Escenarios de aceptación**:

1. **Dado** un proyecto PUBLICADO y uno BORRADOR, **cuando** un visitante consulta el catálogo, **entonces** recibe 200 y solo el publicado (T01).
2. **Dado** un id inexistente o no publicado, **cuando** se consulta su detalle, **entonces** recibe 404 sin contenido.
3. **Dado** un proyecto con donaciones en varios estados, **cuando** se consultan sus cifras, **entonces** la suma excluye pendientes y rechazadas y no expone donantes.

---

### Historia 2 - Iniciar y cerrar sesión (Prioridad: P1) · HU-03

Como donante, quiero autenticarme para que mis acciones tengan una identidad verificable.

**Por qué esta prioridad**: todas las operaciones protegidas dependen de ella.

**Prueba independiente**: se llama al API sin token, con token alterado y con ID token.

**Escenarios de aceptación**:

1. **Dada** una ruta protegida, **cuando** se llama sin token, con token expirado, alterado, de otro client o con un ID token, **entonces** responde 401 (T02, T11).
2. **Dado** un inicio de sesión, **cuando** termina el flujo Authorization Code + PKCE, **entonces** el access token dura 15 minutos o menos y permanece en memoria.
3. **Dado** un cierre de sesión, **cuando** se revoca el refresh token, **entonces** el access token anterior sigue siendo aceptado hasta expirar; la limitación queda documentada (T13).

---

### Historia 3 - Control por rol y MFA (Prioridad: P1) · HU-04, HU-11

Como responsable de la fundación, quiero que solo las personas autorizadas realicen operaciones sensibles.

**Por qué esta prioridad**: es el núcleo de la demostración Zero Trust.

**Prueba independiente**: llamadas directas al API con tokens de cada rol.

**Escenarios de aceptación**:

1. **Dado** un DONANTE, **cuando** intenta crear un proyecto, **entonces** recibe 403 (T03).
2. **Dado** un GESTOR, **cuando** consulta el historial de un donante, **entonces** recibe 403 (T12).
3. **Dado** un GESTOR con TOTP, **cuando** no completa el segundo factor, **entonces** no obtiene tokens (T14).

---

### Historia 4 - Gestionar proyectos (Prioridad: P2) · HU-08

Como gestor, quiero crear y publicar proyectos para habilitar donaciones simuladas.

**Por qué esta prioridad**: sin proyectos publicados no hay donaciones.

**Prueba independiente**: un gestor crea un borrador y lo publica; se verifican 409 y el evento de auditoría.

**Escenarios de aceptación**:

1. **Dados** título, descripción y objetivo positivo, **cuando** un GESTOR crea un proyecto, **entonces** queda en BORRADOR con 201.
2. **Dado** un proyecto ya publicado, **cuando** se publica de nuevo, **entonces** responde 409.
3. **Dada** una creación o publicación, **entonces** se registra actor seudonimizado, fecha, acción y resultado.

---

### Historia 5 - Registrar una intención de donación (Prioridad: P2) · HU-05

Como donante autenticado, quiero registrar un monto para un proyecto y seguir mi aporte de prueba.

**Por qué esta prioridad**: es el flujo principal del negocio.

**Prueba independiente**: se envían cargas válidas, inválidas y claves repetidas.

**Escenarios de aceptación**:

1. **Dados** un proyecto PUBLICADO, `amountCents` válido e `Idempotency-Key`, **entonces** se crea `PENDIENTE_SIMULACION` con 201 (T05).
2. **Dado** un monto de 0, 100001 o no entero, o la falta de la clave, **entonces** responde 400 (T04).
3. **Dada** la misma clave y la misma carga, **entonces** devuelve el mismo resultado y una sola donación (T06).
4. **Dada** la misma clave con carga distinta, **entonces** responde 409 (T07).

---

### Historia 6 - Simular la confirmación (Prioridad: P2) · HU-06

Como donante, quiero comprobar el resultado de mi contribución en un flujo de prueba.

**Por qué esta prioridad**: demuestra integridad bajo concurrencia.

**Prueba independiente**: 10 solicitudes paralelas sobre la misma donación.

**Escenarios de aceptación**:

1. **Dadas** 10 confirmaciones concurrentes, **entonces** el acumulado aumenta una sola vez (T08).
2. **Dada** una donación rechazada, **entonces** las cifras no cambian.
3. **Dado** un stage distinto de `academic`, **entonces** la ruta no existe.
4. **Dada** la simulación en la UI, **entonces** se muestra «Simulación académica: no se ha realizado ningún cobro».

---

### Historia 7 - Consultar el historial propio (Prioridad: P2) · HU-07

Como donante, quiero consultar mis donaciones simuladas para verificar su estado.

**Por qué esta prioridad**: es la prueba directa contra BOLA.

**Prueba independiente**: dos donantes con datos distintos.

**Escenarios de aceptación**:

1. **Dado** un donante, **cuando** consulta su historial, **entonces** solo ve registros de su `sub`.
2. **Dada** una donación ajena, **cuando** la consulta por id, **entonces** recibe 404 sin datos (T09).

---

### Historia 8 - Consultar auditoría (Prioridad: P3, extensión) · HU-10

Como auditor, quiero consultar acciones críticas para investigar desviaciones.

**Por qué esta prioridad**: extensión; suma puntos, pero no es necesaria para la nota máxima.

**Prueba independiente**: tokens de AUDITOR y de otro rol contra `/v1/audit`.

**Escenarios de aceptación**:

1. **Dado** un AUDITOR con MFA, **cuando** filtra por tipo y fecha, **entonces** recibe eventos sin tokens ni datos financieros.
2. **Dado** otro rol, **entonces** recibe 403.

---

### Casos límite

- Publicar un proyecto mientras se dona: la transacción comprueba que siga PUBLICADO; si no, responde 409 sin efectos parciales.
- Confirmar mientras otro proceso rechaza: solo gana la primera transición; la otra recibe 409.
- Clave de idempotencia expirada tras 24 horas: se trata como una clave nueva.
- Función sin permiso de escritura que intenta escribir: `AccessDenied` y error controlado (T10).
- Catálogo vacío: estado vacío comprensible, sin errores técnicos.

## Requisitos *(obligatorio)*

### Requisitos funcionales

- **FR-001**: El sistema DEBE publicar solo proyectos PUBLICADO a visitantes (CA-01.1, CA-01.2, CA-02.2).
- **FR-002**: El sistema DEBE autenticar con Cognito, Authorization Code + PKCE, sin flujo implícito (CA-03.1).
- **FR-003**: El sistema DEBE rechazar con 401 credenciales ausentes, expiradas, alteradas, de otro client o ID tokens (CA-03.2, CA-NF02.1).
- **FR-004**: El access token DEBE durar 15 minutos o menos; al cerrar sesión se revoca el refresh token (CA-03.3).
- **FR-005**: El sistema DEBE autorizar por grupo y propietario en backend, solo con claims verificados (CA-04.1–3, CA-NF02.2).
- **FR-006**: GESTOR y AUDITOR DEBEN tener MFA TOTP; no se admite SMS (CA-11.1–2).
- **FR-007**: Solo GESTOR DEBE crear y publicar proyectos, con registro de auditoría (CA-08.1–3).
- **FR-008**: Solo DONANTE DEBE crear intenciones, con `amountCents` entero entre 100 y 100000 e `Idempotency-Key` UUID (CA-05.1–3).
- **FR-009**: La clave de idempotencia y la donación DEBEN escribirse de forma atómica (CA-05.4, CA-NF04.2).
- **FR-010**: La simulación DEBE aplicar una única transición desde `PENDIENTE_SIMULACION` y existir solo en el stage `academic` (CA-06.1–3).
- **FR-011**: El historial y la consulta por id DEBEN limitarse al propietario (CA-07.1–2).
- **FR-012**: Las cifras públicas DEBEN excluir pendientes y rechazadas, sin exponer donantes (CA-09.1–2).
- **FR-013**: El sistema NO DEBE solicitar datos de pago ni DNI (CA-05.5).
- **FR-014**: Solo AUDITOR DEBE consultar la auditoría (CA-10.1–2, extensión).

### Requisitos no funcionales

RNF-HU-01 a RNF-HU-11 aplican sin cambios: HTTPS, Zero Trust, mínimo privilegio, integridad, rendimiento, accesibilidad, observabilidad, calidad, presupuesto, protección de datos y seguridad del navegador.

### Entidades clave

- **Project**: campaña social. Estados BORRADOR y PUBLICADO; meta y acumulado en céntimos.
- **Donation**: intención simulada de un donante hacia un proyecto; un estado inicial y dos terminales.
- **IdempotencyRecord**: reserva de una clave por usuario y operación, con hash de la carga y vencimiento.
- **AuditEvent**: acción crítica con actor seudonimizado, sin datos sensibles.

## Criterios de éxito *(obligatorio)*

### Resultados medibles

- **SC-001**: Las 14 pruebas T01–T14 se ejecutan con evidencia.
- **SC-002**: Con 10 solicitudes paralelas, el acumulado cambia una sola vez.
- **SC-003**: Con 50 proyectos, el 95 % de las respuestas GET termina en 1.5 s o menos, sin contar cold start.
- **SC-004**: Catálogo, detalle, donación y confirmación son usables a 375 px y con teclado.
- **SC-005**: Ningún log ni archivo del repositorio contiene tokens, claves ni datos personales.
- **SC-006**: Los 7 principios de NIST SP 800-207 tienen control y evidencia o limitación declarada.

## Supuestos

- La evaluación usa solo donaciones simuladas y usuarios ficticios.
- El equipo trabaja con una cuenta AWS Free plan en `us-east-2`.
- Pago real, conciliación, comprobantes y verificación legal quedan fuera de alcance.
- Postura de dispositivo, riesgo continuo, Verified Access, GuardDuty y Security Hub quedan fuera de alcance.
- HU-12 (Verified Permissions) es una extensión opcional que no se incluye en este plan base.
