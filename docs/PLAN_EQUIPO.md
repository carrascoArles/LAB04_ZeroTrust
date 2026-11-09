# Plan del equipo

**Entrega:** 12/11/2026, 12:59 p. m. El backend ya está en AWS; este plan reparte lo que falta.

| Rol | Responsable | Empieza | Bloquea a |
|---|---|---|---|
| Líder técnico; backend y AWS | Carrasco Choque, Arles Melvin | Ya | Todos |
| Identidad, MFA y seguridad | Yana Agramonte, Luis Efrain | Tras el redespliegue | QA, demo |
| Frontend; SPA y publicación | Huamaní Vargas Melsy Melany | Ya | QA, demo |
| QA, evidencias e informe | Llave Apaza, José Rodolfo | Ya | Entrega |

## Reglas para todos

- Trabaja en una rama corta y abre un Pull Request. Otra persona lo revisa; `main` no se toca directamente.
- Nunca publiques contraseñas, secretos TOTP, tokens ni el ID de la cuenta, ni en capturas ni en el repo.
- Usa solo usuarios ficticios `@aqp-solidaria.test`.
- Si usas IA, decláralo en `AI_USAGE.md`. Cada integrante debe poder explicar su parte en la defensa.
- Las contraseñas de prueba se comparten en persona, no por el repo ni por chats grupales.

## Arles: líder técnico, backend y AWS

- [ ] Abrir el PR de `001-secure-donations-core` y fusionarlo tras la revisión
- [ ] Proteger `main` y exigir una revisión y CI en verde
- [ ] Crear la alerta de presupuesto
- [ ] Redesplegar para activar el registro de MFA y localhost
- [ ] Invitar a Luis, Melsy y José como team members desde AWS Settings
- [ ] Crear los usuarios de prueba: `bash scripts/create-test-users.sh`
- [ ] Medir rendimiento: `bash scripts/perf-catalog.sh`
- [ ] Atender errores del API que reporte el equipo
- [ ] Al cierre: vaciar los buckets, `sam delete` y verificar que no queden recursos

## Luis: identidad, MFA y seguridad

**Objetivo:** que GESTOR y AUDITOR no puedan entrar sin segundo factor. Es lo más crítico de tu rol: hoy no se cumple CA-11.1.

- [ ] Registrar el TOTP del gestor y del auditor en CloudShell. Cada script termina comprobando T14:
  ```bash
  bash scripts/enroll-mfa.sh gestor
  ```
  ```bash
  bash scripts/enroll-mfa.sh auditor
  ```
- [ ] Confirmar en login que después piden el código y guardar la captura, sin mostrar el secreto ni el código
- [ ] Hacer el procedimiento AD-09 con cualquier usuario privilegiado nuevo: primero TOTP, después grupo
- [ ] Revisar `docs/threat-model.md` y el mapeo NIST, y comentar lo que cambiarías
- [ ] Probar el token de otro client: autenticar con `ProvisioningClientId` y llamar a una ruta protegida (debe rechazarse)
- [ ] Llevar al docente estas dos consultas y anotar su respuesta:
  - ¿Acepta MFA opcional en el pool con aprovisionamiento controlado (AD-09), o lo exige a todos?
  - ¿Acepta team members en lugar de usuarios IAM (CA-NF03.3)?
- [ ] Revisar el PR del backend, con foco en `backend/src/authz/`

**Listo cuando:** T14 pasa para ambos usuarios y las dos consultas tienen respuesta.

## Melsy: frontend, SPA y publicación

**Objetivo:** una SPA React accesible, publicada por HTTPS. Stack: React, Vite, Tailwind CSS (Bootstrap está prohibido), React Router, TanStack Query, React Hook Form, Zod y `oidc-client-ts`.

**Lo que ya tienes:** el contrato en `docs/api.yaml`. Arles te da estos valores, que salen de CloudShell:

```bash
for k in ApiUrl SpaUrl CognitoDomain UserPoolId UserPoolClientId SpaBucketName; do bash -c "source scripts/lib.sh; echo $k=\$(out $k)"; done
```

Tras el redespliegue, `http://localhost:5173` queda permitido para desarrollar con `npm run dev`.

### Pantallas

- [ ] Catálogo con meta y monto confirmado, y estado vacío (HU-01, HU-09)
- [ ] Detalle del proyecto (HU-02)
- [ ] Login y cierre de sesión con Authorization Code + PKCE (HU-03)
- [ ] Formulario de donación (HU-05)
- [ ] Simulación con el texto exacto **«Simulación académica: no se ha realizado ningún cobro»** (CA-06.4)
- [ ] Historial propio (HU-07)
- [ ] Gestión de proyectos para GESTOR (HU-08)
- [ ] Auditoría para AUDITOR (HU-10, extensión)

### Reglas que no se negocian

- **Tokens solo en memoria:** `userStore: new WebStorageStateStore({ store: new InMemoryWebStorage() })`, nunca `localStorage` (CA-NF11.1).
- **Enviar el access token**, no el ID token, en `Authorization: Bearer`.
- **Montos en céntimos enteros.** No hagas `19.99 * 100`, porque da `1998.9999…` y el API responde 400. Convierte desde el texto: separa soles y céntimos, y súmalos como enteros.
- **`Idempotency-Key`:** genera un `crypto.randomUUID()` por intento de donación y reutilízalo si reintentas ese mismo envío.
- **Cierre de sesión:** elimina los tokens de memoria y revoca el refresh token (CA-03.3).
- **CSP estricta:** sin scripts ni estilos en línea, y sin recursos de otros dominios.
- **Ocultar botones no es seguridad:** el backend ya valida; la interfaz solo mejora la experiencia.
- **Accesibilidad:** usable a 375 px y con teclado, con etiquetas, foco visible y errores claros (RNF-HU-06).
- **Aviso:** indica que es un prototipo académico (CA-NF10.2).

### Publicar

La ruta de retorno del login es `/callback`. Desde `frontend/`, con el build generado en `dist/`:

```bash
aws s3 sync dist "s3://$SPA_BUCKET" --delete
```

CloudFront guarda en caché los archivos. Para ver el cambio, Arles crea una invalidación con el ID de la distribución.

**Listo cuando:** los cuatro roles usan la SPA desde la URL HTTPS y el flujo de donar, simular y ver historial funciona a 375 px.

## José: QA, evidencias e informe

**Objetivo:** demostrar T01–T14 con evidencia y cerrar el informe.

- [ ] Ejecutar la demo en CloudShell y registrar cada resultado, comparado con lo esperado:
  ```bash
  bash scripts/demo-backend.sh
  ```
- [ ] Repetir la llamada de T13 pasados 15 minutos y anotar el 401
- [ ] Anotar qué responde T11 con un ID token. Si es 403 y no 401, avisar a Arles: contradice CA-03.2 y hay que declararlo
- [ ] Crear una colección Bruno o Postman en `docs/` con las pruebas negativas, sin tokens guardados (`design.md` §9)
- [ ] Capturar en CloudWatch un caso exitoso y uno rechazado, y en CloudTrail el despliegue (CA-NF07.2)
- [ ] Guardar todo en `evidence/`, siguiendo `evidence/aws-infraestructura.md`. Revisa que las capturas no muestren tokens, correos reales ni el ID de cuenta
- [ ] Probar la SPA a 375 px y con teclado, y anotar los criterios WCAG 2.2 AA evaluados
- [ ] Completar `AI_USAGE.md` con los enlaces a los PR y la revisión de cada integrante
- [ ] Actualizar el informe con los resultados reales; pídele a Arles la última versión de `informe/`, que no está en el repo
- [ ] Preguntar al docente si hay cuestionario; la sección 2 del informe está pendiente
- [ ] Revisar el PR del frontend

**Listo cuando:** cada prueba T01–T14 tiene resultado y evidencia, y el informe no dice nada que no se haya comprobado.

## Orden

| Cuándo | Qué | Quién |
|---|---|---|
| Hoy | PR, presupuesto, redespliegue, invitaciones y usuarios | Arles |
| Hoy | Registro de TOTP y T14 | Luis |
| Hoy | Ejecutar la demo y registrar evidencias del backend | José |
| 10/11 | Consultas al docente | Luis, José |
| 10–11/11 | Frontend, con una versión publicada al final del 10/11 | Melsy |
| 11/11 | Pruebas de la SPA y accesibilidad | José, Melsy |
| 11/11 | Rendimiento, revisión final y correcciones | Arles, Luis |
| 12/11, mañana | Informe final, ensayo y entrega | Todos |
| Tras la evaluación | Eliminar los recursos de AWS | Arles |

## Riesgos

| Riesgo | Plan |
|---|---|
| El frontend no llega completo | Priorizar catálogo, login, donar, simular e historial. Gestión y auditoría se pueden demostrar con `scripts/demo-backend.sh` |
| T11 responde 403 con ID token | Declararlo en el informe; la solicitud se rechaza igualmente |
| El docente exige MFA para todos | Arles cambia `MfaConfiguration` a `ON` y se registra TOTP para los donantes |
| Los tokens expiran durante la demo | Duran 15 minutos: iniciar sesión justo antes |
