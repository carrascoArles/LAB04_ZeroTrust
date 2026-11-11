# Contrato: rutas de la interfaz

Rutas que la SPA expone a las personas. CloudFront devuelve `index.html` para cualquier ruta (403 y 404 → 200), así que todas funcionan al abrirlas directamente.

| Ruta | Pantalla | Visible en el menú para | Si el rol no corresponde | Operaciones | Historias |
|---|---|---|---|---|---|
| `/` | Catálogo con búsqueda | Todos | — | `listProjects` | HU-01, HU-09 |
| `/proyectos/:projectId` | Detalle, donación y simulación | Todos | Explica quién puede donar | `getProject`, `getProjectStats`, `createDonation`, `simulateDonation` | HU-02, HU-05, HU-06, HU-09 |
| `/mis-donaciones` | Historial propio | DONANTE | Mensaje sin datos | `getMyDonations`, `listProjects`, `simulateDonation` | HU-07 |
| `/gestion` | Crear y publicar proyectos | GESTOR | Mensaje sin formularios | `createProject`, `publishProject` | HU-08 |
| `/auditoria` | Eventos de auditoría | AUDITOR | Mensaje sin filtros | `listAuditEvents` | HU-10 |
| `/callback` | Retorno del login | — | — | Canje del código en Cognito | HU-03 |
| cualquier otra | Página no encontrada | — | — | — | — |

**Regla de Zero Trust (FR-015):** esconder una ruta o un botón no protege nada. Si alguien abre `/gestion` con un token de DONANTE y fuerza la llamada, el API responde 403 (T03). La interfaz solo evita mostrar pantallas inútiles.

## Elementos presentes en todas las pantallas

- Enlace «Saltar al contenido» y un único `h1` (CA-NF06.2).
- Aviso «Prototipo académico: las donaciones son simuladas y no se realiza ningún cobro» (CA-NF10.2).
- Pie con la nota de la Ley N.º 29733 (CA-NF10.2).
- Correo y roles de la sesión, o el botón «Iniciar sesión».
