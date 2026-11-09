# Guía de validación

Fase 1 de `/speckit-plan`. Describe cómo validar la funcionalidad. El backend se valida en local; **aún no hay despliegue.**

## Lo que ya se puede validar, sin cuenta AWS

Revisar la plantilla SAM (no despliega nada):

```bash
pip install cfn-lint
cfn-lint infra/template.yaml
```

Regenerar el diagrama principal:

```bash
python docs/architecture/build_diagram.py
```

Probar el backend:

```bash
cd backend && npm ci && npm test
```

## Validación prevista tras el despliegue

Requisitos: proyecto AWS en Free plan con alerta de Budgets, team members invitados y usuarios de prueba de los cuatro roles.

| Escenario | Pruebas | Resultado esperado |
|---|---|---|
| Catálogo público | T01 | 200, sin borradores |
| Autenticación en el PEP | T02, T11 | 401 sin token, con token alterado o con ID token |
| Rol y propietario | T03, T09, T12 | 403 o 404, sin filtrar datos |
| Validación e idempotencia | T04–T07 | 400, 201, mismo resultado y 409 |
| Concurrencia | T08 | 10 solicitudes paralelas, un solo incremento |
| Mínimo privilegio | T10 | `AccessDenied` en la función de listado |
| Revocación | T13 | Aceptado hasta expirar; rechazado después |
| MFA | T14 | Sin segundo factor no hay tokens |

Contrato: [contracts/api.yaml](./contracts/api.yaml). Datos: [data-model.md](./data-model.md).

## Limpieza

Vaciar los buckets de la SPA y de CloudTrail, ejecutar `sam delete` y comprobar en Resource Explorer que no queden recursos.
