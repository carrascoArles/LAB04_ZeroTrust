# AQP-SOLIDARIA: Plataforma de Donaciones Seguras

Laboratorio 4 de Tópicos Avanzados (EPIS, UNSA). Aplicación serverless con modelo de seguridad Zero Trust (NIST SP 800-207). **Prototipo académico: las donaciones son simuladas, no se realiza ningún cobro** y un despliegue real exigiría evaluación legal (Ley N.º 29733), privacidad y retención.

## Estado

| Etapa | Estado |
|---|---|
| Constitución, especificación, clarificación | Hecho |
| Plan técnico y arquitectura | Hecho |
| Tareas (`tasks.md`) | Hecho para el backend |
| Backend | Implementado, con 119 pruebas locales |
| Frontend | Pendiente: rol disponible |
| Despliegue y pruebas en AWS | Pendiente |

## Dónde está cada cosa

```text
.specify/                       Spec Kit: constitución, plantillas y scripts
.github/skills/                 Comandos de Spec Kit para el agente
specs/001-secure-donations-core/ Especificación, plan, modelo de datos y contrato
infra/template.yaml             Arquitectura como código (AWS SAM)
docs/architecture/              Diagramas y su código fuente
docs/api.yaml                   Contrato OpenAPI 3.1
docs/threat-model.md            STRIDE, mapeo NIST y limitaciones
backend/                        API en Lambda y pruebas
frontend/                       SPA (por implementar)
policies/                       Cedar (extensión HU-12)
evidence/                       Evidencias sanitizadas
requirements.md  design.md      Caso de estudio
AI_USAGE.md                     Declaración de uso de IA
```

Empieza por [la arquitectura](docs/architecture/README.md).

## Equipo

| Rol | Responsable |
|---|---|
| Líder técnico; backend y AWS | Carrasco Choque, Arles Melvin |
| Frontend; SPA y publicación | Disponible |
| QA, evidencias e informe | Disponible |
| Identidad, MFA y seguridad | Disponible |

## Validar la plantilla sin desplegar

```bash
pip install cfn-lint
```

```bash
cfn-lint infra/template.yaml
```

## Cuenta y región

Proyecto AWS con la nueva experiencia, Free plan, selected Region `us-east-2`. Los integrantes se invitan como team members desde AWS Settings.

## Limpieza

Vaciar los buckets de la SPA y de CloudTrail, ejecutar `sam delete` y verificar en Resource Explorer que no queden recursos.
