# Plan de implementación: SPA de AQP-SOLIDARIA

**Rama**: `003-spa-frontend` | **Fecha**: 2026-11-11 | **Especificación**: [spec.md](./spec.md)

**Entrada**: especificación de `/specs/003-spa-frontend/spec.md`

**Estado**: implementado; recorrido con los cuatro roles hecho en local con el build de producción; falta publicar en CloudFront ([tasks.md](./tasks.md)).

## Resumen

SPA React estática que consume las 10 operaciones de [`docs/api.yaml`](../../docs/api.yaml) sin modificarlas. Se publica en el bucket S3 privado y CloudFront la sirve por HTTPS con la CSP de [`infra/template.yaml`](../../infra/template.yaml). El inicio de sesión usa el client público de Cognito con Authorization Code + PKCE y tokens solo en memoria. La SPA se trata como un componente **no confiable** de la arquitectura Zero Trust: no toma decisiones de seguridad, solo presenta las del backend. Decisiones: [research.md](./research.md).

## Contexto técnico

**Lenguaje/Versión**: TypeScript 6.0.3, igual que el backend. `design.md` §2 menciona la 7.0.x, pero typescript-eslint 8 admite `<6.1.0` (research.md F12).

**Dependencias principales**: React 19.3, Vite 8.3, Tailwind CSS 4.3, React Router 8.5, TanStack Query 5, React Hook Form 7, Zod 4.6 y `oidc-client-ts` 3.5, según `design.md` §2. Sin Bootstrap.

**Almacenamiento**: ninguno persistente. Tokens en memoria; estado temporal del login en `sessionStorage` ([data-model.md](./data-model.md)).

**Pruebas**: Vitest 5 con jsdom y Testing Library; `scripts/check-csp.mjs` sobre el build; recorrido manual de [quickstart.md](./quickstart.md).

**Plataforma objetivo**: navegadores actuales, desde 375 px de ancho; CloudFront + S3 en `us-east-2`.

**Tipo de proyecto**: aplicación web; carpeta `frontend/` del mismo repositorio (`design.md` §8).

**Objetivos de rendimiento**: código propio de la SPA menor a 50 KB comprimido; bibliotecas en archivos aparte que el navegador conserva en caché entre publicaciones.

**Restricciones**: CSP sin código en línea ni dominios externos; montos en céntimos enteros; ninguna ruta nueva en el API.

**Escala/Alcance**: 6 pantallas, 4 roles, 10 operaciones del API.

## Verificación de la constitución

*Compuerta evaluada antes de Research y después del diseño. Resultado en ambos casos: **aprobada**.*

| Principio | Cómo lo cumple la SPA | Estado |
|---|---|---|
| I. Zero Trust | El navegador no es confiable: cada llamada protegida lleva un access token de vida corta que verifican el PEP y el PE. Ver la sección siguiente | Cumple |
| II. Backend autoritativo | Roles, montos, propietarios y estados los decide el API; la SPA solo adapta la interfaz (FR-015) | Cumple |
| III. Privilegio mínimo | Sin credenciales AWS en el navegador; client público sin secreto | Cumple |
| IV. Integridad | Céntimos enteros desde el texto; `Idempotency-Key` por intento | Cumple |
| V. Pruebas negativas | Pruebas de montos inválidos, clave reutilizada, tokens fuera de `localStorage`, 401/403/409 y respuestas fuera de contrato; mutaciones comprobadas | Cumple |
| VI. Trazabilidad sin secretos | Los errores muestran `requestId`, nunca tokens; el `code` sale del historial | Cumple |
| VII. Simplicidad | Sitio estático, sin SSR ni servidor propio | Cumple |

## La SPA en la arquitectura Zero Trust

`design.md` §3 define los límites de confianza: navegador (no confiable) → API Gateway (PEP) → Lambda (PE) → DynamoDB. La SPA vive en el primer tramo, así que su papel es **no debilitar** los controles de los siguientes y **reducir el impacto** si el navegador se ve comprometido.

| Principio NIST SP 800-207 (design.md §6.1) | Aporte de la SPA | Verificación |
|---|---|---|
| 1. Todo dato y servicio es un recurso | Cada operación es una función separada con su `operationId`; ninguna ruta implícita | `test/services.test.ts` |
| 2. Comunicación segura sin importar la red | Solo HTTPS (la configuración rechaza URL `http://` del API y de Cognito) | `test/config.test.ts`, CA-NF01.1 |
| 3. Acceso por sesión y por recurso | Access token de 15 min en memoria; se envía por solicitud; el refresh token se revoca al salir | `test/auth.test.ts`, T13 |
| 4. Política dinámica | La SPA no decide: muestra el 401/403/409 que devuelve el API en cada solicitud | `test/roles.test.tsx`, `test/donate.test.tsx` |
| 5. Postura de los activos | Parcial: dependencias fijadas, `npm audit` en CI; sin postura de dispositivo (limitación declarada) | CI |
| 6. Autenticación y autorización estrictas | PKCE S256, sin flujo implícito; MFA exigido por Cognito; nunca envía el ID token | `test/auth.test.ts`, T14 |
| 7. Recolectar información | Muestra el `requestId` de cada error para correlacionarlo con CloudWatch | `test/services.test.ts` |

| Componente NIST | Relación con la SPA | Contrato |
|---|---|---|
| Policy Administrator (Cognito) | La SPA pide, renueva y revoca sesiones | [oidc-cognito.md](./contracts/oidc-cognito.md) |
| Policy Enforcement Point (API Gateway; CloudFront) | La SPA entrega el access token; CloudFront le impone CSP y HTTPS | [api-consumption.md](./contracts/api-consumption.md) |
| Policy Engine (`authz`) | La SPA presenta su decisión; no la reemplaza | [ui-routes.md](./contracts/ui-routes.md) |

**Asumir brecha (requirements.md §1).** Si un atacante inyecta código en la página, encuentra: ningún token en almacenamiento persistente, una CSP que bloquea scripts externos y en línea, y un access token que vence en 15 minutos. No encuentra secretos ni credenciales AWS, porque no existen en el navegador.

## Estructura del proyecto

### Documentación (esta funcionalidad)

```text
specs/003-spa-frontend/
├── spec.md                # /speckit-specify y /speckit-clarify
├── checklists/
│   ├── requirements.md    # /speckit-specify
│   └── zero-trust.md      # /speckit-checklist
├── plan.md                # este archivo
├── research.md            # fase 0
├── data-model.md          # fase 1
├── contracts/             # fase 1: API, Cognito y rutas
├── quickstart.md          # fase 1
└── tasks.md               # /speckit-tasks
```

### Código fuente

```text
frontend/
├── index.html
├── public/favicon.svg
├── scripts/check-csp.mjs        # build sin código en línea ni dominios externos
├── src/
│   ├── main.tsx                 # punto de entrada: arma las dependencias
│   ├── App.tsx                  # proveedores
│   ├── routes.tsx               # rutas (contracts/ui-routes.md)
│   ├── config/                  # variables VITE_* validadas; Zod sin eval
│   ├── domain/                  # reglas puras: dinero y etiquetas
│   ├── services/                # cliente HTTP y una función por operationId
│   ├── auth/                    # oidc-client-ts, sesión, revocación y roles
│   ├── hooks/                   # consultas y mutaciones de TanStack Query
│   ├── components/              # piezas accesibles reutilizables
│   └── pages/                   # una pantalla por ruta
└── test/                        # Vitest y Testing Library
```

**Decisión de estructura**: se conservan las carpetas de `design.md` §8 (`pages`, `components`, `auth`, `services`) y se agregan `config`, `domain` y `hooks` para separar responsabilidades. Las dependencias van en una sola dirección: `pages → hooks → services`; `domain` no conoce React ni la red; los componentes nunca leen tokens.

## Desviación de proceso (resultado de `/speckit-analyze`)

**Principio V, pruebas antes que el código.** La primera versión de la SPA se escribió con la especificación a mano y con las pruebas junto al código, no antes. Después se pasó por los procedimientos de Spec Kit, y `/speckit-analyze` lo marcó como hallazgo crítico. No se puede rehacer el orden, así que se compensó así:

- Se comprobó con mutaciones que las pruebas de los controles fallan si se quita el control (T036): tokens en `localStorage` y clave de idempotencia siempre nueva.
- El cambio posterior (CA-02.1, T018–T019) ya siguió el orden correcto: la prueba se escribió primero y falló antes de implementar.
- La desviación queda declarada en `AI_USAGE.md`.

## Seguimiento de complejidad

| Decisión | Por qué se necesita | Alternativa más simple descartada porque |
|---|---|---|
| Validar respuestas con Zod | Detecta que el backend se aparta del contrato | Los tipos de TypeScript no validan nada en tiempo de ejecución |
| Revocación con `fetch` propio en lugar de `revokeTokens()` | Envía exactamente los parámetros documentados por Cognito | `revokeTokens()` agrega `token_type_hint`, que Cognito no documenta |
| `stateStore` en `sessionStorage` | El `code_verifier` debe sobrevivir a la redirección | Login en ventana emergente: mala experiencia en celular |
