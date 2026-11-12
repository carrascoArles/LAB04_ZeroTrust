# Research: decisiones técnicas de la SPA

Fase 0 de `/speckit-plan`. Se comprobó el comportamiento real de Cognito y del API el 2026-11-11 con solicitudes de solo lectura (descubrimiento OIDC y preflight CORS desde `http://localhost:5173`).

## F1. Biblioteca OIDC

- **Decisión**: `oidc-client-ts` 3.5, con los metadatos del proveedor declarados en la configuración.
- **Justificación**: implementa Authorization Code + PKCE (S256) y permite elegir dónde se guardan los tokens. Declarar los metadatos evita una solicitud de descubrimiento en cada carga y deja explícitos los endpoints que la CSP debe permitir.
- **Alternativas**: AWS Amplify Auth (más pesada y con su propio almacenamiento); implementar PKCE a mano (código de seguridad propio, sin necesidad).

## F2. Dónde viven los tokens

- **Decisión**: `userStore: new WebStorageStateStore({ store: new InMemoryWebStorage() })`.
- **Justificación**: CA-NF11.1 y R6 de `001`. Un XSS no puede leer tokens de `localStorage` porque nunca se escriben allí.
- **Consecuencia**: recargar la página cierra la sesión local.

## F3. Estado temporal del login

- **Decisión**: `stateStore` en `sessionStorage`.
- **Justificación**: el `state` y el `code_verifier` deben sobrevivir a la redirección hacia Cognito y de vuelta, y la memoria se pierde al navegar. No son tokens, viven en la pestaña y `oidc-client-ts` los borra al procesar el callback.
- **Alternativa**: login en ventana emergente con todo en memoria; se descarta por la experiencia en celular y el bloqueo de ventanas emergentes.

## F4. Renovación de la sesión

- **Decisión**: renovación automática con el refresh token, en memoria, contra `/oauth2/token`.
- **Justificación**: el access token dura 15 minutos; sin renovación, la demo se cortaría. Cognito no permite renovar en un iframe (`frame-ancestors`), así que se usa el refresh token.
- **Consecuencia**: T13 sigue igual: un access token revocado se acepta hasta expirar.

## F5. Revocación y cierre de sesión

- **Decisión**: `POST /oauth2/revoke` con `token` y `client_id` (form-urlencoded), luego borrar el usuario de memoria y redirigir a `/logout?client_id=…&logout_uri=…`.
- **Justificación**: son exactamente los parámetros documentados para un client público; el preflight confirmó CORS desde el origen de la SPA. Cerrar la sesión de Cognito evita que el siguiente login reutilice al usuario anterior, el problema de las primeras capturas.
- **Detalle**: `logout_uri` es el origen de la URI de retorno con `/`, que coincide con `LogoutURLs` de la plantilla. No se envía el ID token en la URL.

## F6. URI de retorno

- **Decisión**: `VITE_REDIRECT_URI` opcional; por defecto, `<origen>/callback`.
- **Justificación**: un mismo build funciona en CloudFront y en `localhost:5173`, y desaparece el error de publicar un build con la URI de desarrollo. Cognito rechaza cualquier URI no registrada, así que derivarla del origen no abre una redirección.

## F7. Montos

- **Decisión**: convertir el texto con una expresión regular (`^\d{1,7}([.,]\d{1,2})?$`), separar soles y céntimos y sumarlos como enteros.
- **Justificación**: `19.99 * 100` da `1998.9999…`. ESLint prohíbe `parseFloat`, igual que en el backend.

## F8. Idempotencia

- **Decisión**: el formulario guarda la clave y la carga del último intento sin éxito. Si se reenvía la misma carga, reutiliza la clave; si cambia, genera otra con `crypto.randomUUID()`.
- **Justificación**: un reintento tras un corte de red no duplica la donación (T06) y una carga distinta no choca con la anterior (T07).

## F9. Validación de respuestas

- **Decisión**: esquemas Zod que reflejan `components.schemas` del contrato; toda respuesta se valida antes de usarse.
- **Justificación**: si el contrato y el backend se separan, la SPA falla de forma visible y no muestra datos incorrectos. Los errores del JWT authorizer (`{"message": "Unauthorized"}`) no siguen el esquema `Error`; se interpretan por código HTTP.

## F10. Compatibilidad con la CSP

- **Decisión**: Tailwind CSS compilado a un archivo; sin atributos `style`; barras de avance con `<progress>`; fuentes del sistema; `vite preview` con la misma CSP de la plantilla; script `check-csp` sobre `dist/`.
- **Justificación**: `script-src 'self'; style-src 'self'` bloquea cualquier código en línea. Probar el build bajo la misma política detecta el problema antes de publicar.

## F11. Accesibilidad

- **Decisión**: HTML semántico, enlace para saltar al contenido, foco al contenido principal y título del documento en cada cambio de ruta, `aria-invalid` y `aria-describedby` en los campos, mensajes con `role="alert"` o `role="status"`, contraste AA y objetivos táctiles de al menos 44 px.
- **Alternativa descartada**: `eslint-plugin-jsx-a11y` 6.10 no admite ESLint 10. Las pruebas usan consultas por rol y nombre accesible, que fallan si falta una etiqueta.

**Criterios WCAG 2.2 AA aplicables (CA-NF06.2)** y dónde se atienden. La evaluación final la hace QA en la URL pública (T042).

| Criterio | Cómo se atiende | Verificación |
|---|---|---|
| 1.3.1 Información y relaciones | Encabezados, listas, `dl`, tabla con `th scope`, etiquetas ligadas a cada campo | Pruebas por rol y etiqueta |
| 1.4.1 Uso del color | Los estados se dicen con texto, no solo con color | `StatusBadge` |
| 1.4.3 Contraste mínimo | Texto `slate-700` o más oscuro sobre fondos claros; botones `emerald-700` con texto blanco (5.5:1) | Revisión manual |
| 1.4.10 Reflujo | Sin desplazamiento horizontal a 375 px, salvo la tabla de auditoría, que tiene su propia región | Recorrido a 375 px |
| 1.4.11 Contraste no textual | Bordes de campos `slate-500`; foco de 3 px `blue-700` | Revisión manual |
| 2.1.1 Teclado | Solo controles nativos; la tabla desplazable recibe foco | Pruebas con `user-event` |
| 2.4.1 Evitar bloques | Enlace «Saltar al contenido» | `roles.test.tsx` |
| 2.4.2 Página titulada | Título del documento por pantalla | `catalog.test.tsx` |
| 2.4.3 Orden del foco | El foco va al contenido al cambiar de pantalla | `roles.test.tsx` |
| 2.4.7 Foco visible | Contorno de 3 px en `:focus-visible` | Revisión manual |
| 2.5.8 Tamaño del objetivo | Botones y enlaces de al menos 44 px de alto | Revisión manual |
| 3.3.1 Identificación de errores | Error junto al campo, con `aria-invalid` y foco en el primer campo inválido | `donate.test.tsx` |
| 3.3.2 Etiquetas o instrucciones | Etiqueta y ayuda con formato y límites en cada campo | `donate.test.tsx` |
| 4.1.2 Nombre, función y valor | Controles nativos; botones con nombre accesible | Pruebas por rol |
| 4.1.3 Mensajes de estado | `role="status"` para resultados y `role="alert"` para errores | `catalog.test.tsx`, `donate.test.tsx` |

## F12. Desviaciones justificadas de `design.md` §2

`design.md` §2 permite que el equipo elija otra combinación estable si hay incompatibilidades, siempre que la justifique.

| Elemento de design.md §2 | Decisión | Justificación |
|---|---|---|
| TypeScript 7.0.x | TypeScript 6.0.3 | typescript-eslint 8 admite `<6.1.0`; el backend usa la misma versión (plan de `001`) |
| Esquemas Zod reutilizados entre frontend y backend | La SPA tiene sus propios esquemas, copiados de `docs/api.yaml` | Compartir archivos exigiría un paquete común y cambiar el build del backend ya desplegado. La fuente única es el contrato OpenAPI, y las pruebas de `services.test.ts` lo cubren |
| Radix UI y Lucide React (opcionales) | No se usan | Los controles nativos (`button`, `select`, `progress`) ya son accesibles; menos dependencias, menos superficie de ataque |
| `eslint-plugin-jsx-a11y` (no exigido) | No se usa | La versión 6.10 no admite ESLint 10 (ver F11) |
