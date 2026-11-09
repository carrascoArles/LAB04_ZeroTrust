# Plan de implementación: Núcleo de la Plataforma de Donaciones Seguras

**Rama**: `001-secure-donations-core` | **Fecha**: 2026-11-09 | **Especificación**: [spec.md](./spec.md)

**Entrada**: especificación de `/specs/001-secure-donations-core/spec.md`

**Estado**: backend implementado y probado localmente (ver [tasks.md](./tasks.md)). Falta el frontend y no se ha desplegado nada en AWS.

## Resumen

SPA React estática servida por CloudFront desde un S3 privado, y API serverless en API Gateway HTTP API con 10 funciones Lambda. Cognito emite los tokens, el JWT authorizer rechaza en el borde lo no autenticado y el módulo `authz` decide rol y propietario en cada solicitud. Toda la infraestructura se describe en [`infra/template.yaml`](../../infra/template.yaml). Detalle: [arquitectura](../../docs/architecture/README.md).

## Contexto técnico

**Lenguaje/Versión**: TypeScript 6.0 sobre Node.js 24 (`nodejs24.x`). No se usa TypeScript 7 porque typescript-eslint 8 admite como máximo `<6.1.0`.

**Dependencias principales**: React 19, Vite 8, Tailwind CSS 4, React Router 8, TanStack Query 5, React Hook Form 7, Zod 4, oidc-client-ts, AWS SDK v3.

**Almacenamiento**: Amazon DynamoDB on-demand, 4 tablas ([data-model.md](./data-model.md)).

**Pruebas**: Vitest con motor en memoria y DynamoDB Local (misma batería), Testing Library para la UI y Bruno/Postman contra el stage desplegado.

**Plataforma objetivo**: AWS Free plan, `us-east-2`, stage `academic`.

**Tipo de proyecto**: aplicación web (frontend + backend + infraestructura) en un repositorio.

**Objetivos de rendimiento**: el 95 % de los GET en 1.5 s o menos con 50 proyectos, sin cold start.

**Restricciones**: sin pagos reales; access token de 15 minutos como máximo; logs con retención de 14 días; solo servicios del Free plan.

**Escala/Alcance**: laboratorio; 4 a 5 integrantes, 1 semana, 10 endpoints.

## Verificación de la constitución

*Compuerta: evaluada antes de Research y de nuevo después del diseño. Resultado en ambos casos: **aprobada**, con una observación.*

| Principio | Cómo lo cumple el diseño | Estado |
|---|---|---|
| I. Zero Trust | PEP, PE y PA identificados; mapeo a los 7 principios; limitaciones declaradas | Cumple |
| II. Backend autoritativo | `authz` en Lambda; `sub` y grupos solo de claims | Cumple |
| III. Privilegio mínimo | Un rol por función, sin comodines en acciones o tablas | Cumple |
| IV. Integridad | Céntimos enteros; `TransactWriteItems` condicionado | Cumple |
| V. Pruebas negativas | T01–T14 trazadas a cada control; se escriben antes de implementar | Previsto en `tasks` |
| VI. Trazabilidad | Identificadores HU/CA en spec, contrato y plantilla; logs JSON | Cumple |
| VII. Simplicidad | Serverless modular en un repo; todo en SAM | Cumple, con observación |

**Observación (VII):** se elige una función por caso de uso, aunque `design.md` también admite una por módulo. Se justifica abajo.

## Estructura del proyecto

### Documentación (esta funcionalidad)

```text
specs/001-secure-donations-core/
├── spec.md              # /speckit-specify y /speckit-clarify
├── plan.md              # este archivo
├── research.md          # fase 0
├── data-model.md        # fase 1
├── quickstart.md        # fase 1
├── contracts/api.yaml   # fase 1; copia de docs/api.yaml
└── checklists/requirements.md
```

### Código fuente (raíz del repositorio)

```text
frontend/src/{pages,components,auth,services}/
backend/src/{projects,donations,authz,audit,shared}/
backend/test/
infra/template.yaml            # arquitectura como código (AWS SAM)
docs/architecture/             # diagramas y su código fuente
docs/{api.yaml,threat-model.md}
policies/                      # Cedar (extensión HU-12)
evidence/
```

**Decisión de estructura**: aplicación web en un único repositorio, según `design.md` §8. La carpeta `frontend` está vacía hasta que se asigne ese rol.

## Seguimiento de complejidad

| Decisión | Por qué se necesita | Alternativa más simple descartada porque |
|---|---|---|
| 10 funciones Lambda (una por caso de uso) | Cada una tiene un rol IAM distinto, lo que permite demostrar T10 con precisión | Una función por módulo obligaría a dar al listado permisos de escritura y debilitaría CA-NF03.1 |
