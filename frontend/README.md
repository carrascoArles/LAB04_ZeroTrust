# Frontend: SPA de AQP-SOLIDARIA

SPA en React 19, Vite 8 y Tailwind CSS 4 que consume el API de [`docs/api.yaml`](../docs/api.yaml) sin modificarlo. Especificación, plan y decisiones: [`specs/003-spa-frontend/`](../specs/003-spa-frontend/).

**Prototipo académico:** las donaciones son simuladas y no se procesa ningún pago.

## Pantallas

| Ruta              | Pantalla                       | Rol                         | Historias                  |
| ----------------- | ------------------------------ | --------------------------- | -------------------------- |
| `/`               | Catálogo con búsqueda y avance | Público                     | HU-01, HU-09               |
| `/proyectos/:id`  | Detalle, donación y simulación | Público; donar solo DONANTE | HU-02, HU-05, HU-06, HU-09 |
| `/mis-donaciones` | Historial propio               | DONANTE                     | HU-07                      |
| `/gestion`        | Crear y publicar proyectos     | GESTOR                      | HU-08                      |
| `/auditoria`      | Eventos de auditoría           | AUDITOR                     | HU-10                      |
| `/callback`       | Retorno del login de Cognito   | Público                     | HU-03                      |

Ocultar una pantalla según el rol solo mejora la experiencia: el API vuelve a decidir con el token en cada solicitud.

## Controles de seguridad

| Control                                                                      | Dónde                                                               | Prueba                  |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------- | ----------------------- |
| Authorization Code + PKCE S256 (CA-03.1)                                     | `src/auth/oidc.ts`                                                  | `test/auth.test.ts`     |
| Tokens solo en memoria (CA-NF11.1)                                           | `userStore` con `InMemoryWebStorage`; ESLint prohíbe `localStorage` | `test/auth.test.ts`     |
| Access token, nunca ID token, en `Authorization` (CA-03.2)                   | `src/services/http.ts`                                              | `test/services.test.ts` |
| Logout: revoca el refresh token, borra la memoria y cierra Cognito (CA-03.3) | `src/auth/AuthService.ts`                                           | `test/auth.test.ts`     |
| Montos en céntimos enteros, de 100 a 100000 (CA-05.1)                        | `src/domain/money.ts`; ESLint prohíbe `parseFloat`                  | `test/money.test.ts`    |
| `Idempotency-Key` por intento, reutilizada al reintentar (CA-05.4)           | `src/hooks/useIdempotencyKey.ts`                                    | `test/donate.test.tsx`  |
| Respuestas validadas contra el contrato                                      | `src/services/schemas.ts`                                           | `test/services.test.ts` |
| Sin redirección abierta tras el login                                        | `safeReturnTo` en `src/auth/AuthService.ts`                         | `test/auth.test.ts`     |
| CSP estricta, sin código en línea (CA-NF11.2)                                | `scripts/check-csp.mjs`, `vite preview` con la misma CSP            | `npm run build`         |

Las pruebas de `localStorage` y de idempotencia se comprobaron con mutaciones: al romper el control a propósito, la prueba falla.

## Arquitectura

```text
src/
├── main.tsx          Punto de entrada: arma las dependencias
├── App.tsx           Proveedores (TanStack Query, API, sesión)
├── routes.tsx        Rutas
├── config/           Variables VITE_* validadas; Zod sin eval (CSP)
├── domain/           Reglas puras: dinero y etiquetas
├── services/         Cliente HTTP, esquemas del contrato y una función por operationId
├── auth/             oidc-client-ts, sesión, revocación y roles
├── hooks/            Consultas y mutaciones de TanStack Query
├── components/       Piezas accesibles reutilizables
└── pages/            Una pantalla por ruta
```

Dependencias en una sola dirección: `pages → hooks → services`. `domain` no conoce React ni la red. Los componentes nunca leen tokens: solo los hooks de datos usan el access token.

## Desarrollo local

1. Copia `.env.example` como `.env.local` y completa los valores. `.env.local` no se sube al repositorio.
2. Instala y arranca:
   ```bash
   npm ci
   ```
   ```bash
   npm run dev
   ```
3. Abre `http://localhost:5173`. Cognito y el CORS del API ya aceptan ese origen.

No hace falta `VITE_REDIRECT_URI`: la SPA usa `<origen>/callback`, así el mismo build sirve en `localhost` y en CloudFront.

Para probar el build con la misma CSP de CloudFront:

```bash
npm run build && npm run preview
```

### Comandos

| Comando             | Qué hace                                                 |
| ------------------- | -------------------------------------------------------- |
| `npm run dev`       | Servidor de desarrollo en el puerto 5173                 |
| `npm run build`     | Build en `dist/` y verificación `check-csp`              |
| `npm run preview`   | Sirve `dist/` en el puerto 5173 con la CSP de producción |
| `npm test`          | Pruebas con Vitest y Testing Library                     |
| `npm run lint`      | ESLint y Prettier                                        |
| `npm run typecheck` | TypeScript                                               |

En Windows, ejecuta las pruebas desde PowerShell o la terminal de VS Code. Si Git Bash entrega la ruta con la unidad en minúscula (`d:`), Vitest carga dos copias de sí mismo y falla con «failed to find the current suite».

## Publicar

Requiere confirmación del responsable (CLAUDE.md). En CloudShell, desde `frontend/` y con `.env.local` completo:

```bash
npm ci && npm run build
```

```bash
aws s3 sync dist s3://<SpaBucketName> --delete
```

```bash
aws cloudfront create-invalidation --distribution-id <DistributionId> --paths "/*"
```

Si un comando de AWS responde `AccessDenied`, avisa al líder técnico.

## Limitaciones

- Recargar la página cierra la sesión: los tokens viven solo en memoria (R6 de `001`).
- El API no lista borradores. La gestión muestra los creados en la sesión y permite publicar otro por su identificador.
- Un access token revocado sigue siendo aceptado hasta expirar, como máximo 15 minutos (T13).
- La SPA no implementa el MFA: lo exige Cognito en el login de GESTOR y AUDITOR.
