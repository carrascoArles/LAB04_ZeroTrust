<!--
Informe de impacto de sincronización
Cambio de versión: plantilla -> 1.0.0 (ratificación inicial)
Principios añadidos: I a VII.
Secciones añadidas: Restricciones del proyecto; Flujo de desarrollo.
Plantillas revisadas: plan-template.md, spec-template.md y tasks-template.md son
  compatibles; la verificación de constitución se aplica en plan.md.
Pendientes: ratificación por parte del equipo en la revisión del avance.
-->

# Constitución de AQP-SOLIDARIA

## Principios fundamentales

### I. Zero Trust como modelo de seguridad
Ninguna solicitud es confiable por su origen de red. Cada solicitud protegida DEBE
autenticarse y autorizarse por recurso. Los controles DEBEN poder rastrearse hasta los
siete principios de NIST SP 800-207 y los componentes PE, PA y PEP. Toda limitación
frente al modelo DEBE declararse explícitamente; nada se presenta como Zero Trust si no
se demuestra con una prueba o una evidencia.

### II. Backend autoritativo
Permisos, importes, propietarios y transiciones de estado DEBEN validarse solo en el
servidor. La identidad (`sub`) y los roles (`cognito:groups`) DEBEN leerse únicamente de
claims verificados. La interfaz puede ocultar opciones para mejorar la experiencia, pero
eso NO cuenta como control de seguridad.

### III. Privilegio mínimo
Cada función Lambda DEBE tener su propio rol IAM, limitado a las acciones y tablas que
necesita. Se prohíben `Action: "*"` y `Resource: "*"` sin justificación escrita. No DEBEN
existir credenciales AWS persistentes en el código, en CI ni en el navegador. Nadie
trabaja con el usuario root.

### IV. Integridad de las donaciones simuladas
Los montos DEBEN representarse como enteros en céntimos de PEN; nunca como `float`. La
idempotencia y las transiciones DEBEN aplicarse con `TransactWriteItems` condicionado:
una confirmación se contabiliza una sola vez, incluso con solicitudes concurrentes. La
plataforma NO DEBE solicitar ni almacenar tarjetas, CVV, cuentas bancarias ni DNI, y NO
DEBE procesar pagos reales.

### V. Las pruebas negativas demuestran los controles (NO NEGOCIABLE)
Las pruebas de autorización, idempotencia y transiciones DEBEN escribirse antes de la
implementación de cada historia y fallar primero. Los casos T01–T14 DEBEN ejecutarse con
evidencia, y DEBE demostrarse con llamadas directas al API que la seguridad no depende de
la interfaz.

### VI. Trazabilidad y observabilidad sin secretos
Cada historia, criterio (HU/CA/RNF-HU) y decisión DEBE poder rastrearse hasta una prueba y
el informe. Los logs DEBEN ser JSON con `requestId`, acción, resultado, código HTTP y
duración, con retención máxima de 14 días. Tokens, claves y datos personales NO DEBEN
aparecer en logs ni en el repositorio.

### VII. Simplicidad, costo controlado y reproducibilidad
La arquitectura DEBE ser serverless modular en un solo repositorio, sin microservicios ni
SSR innecesarios. Toda la infraestructura DEBE estar en AWS SAM y poder eliminarse con
`sam delete`. Solo se usan servicios del AWS Free plan, en una sola región y con alerta de
AWS Budgets.

## Restricciones del proyecto

- Frontend: React con Vite y Tailwind CSS; Bootstrap está prohibido.
- Backend: TypeScript sobre Node.js 24 en AWS Lambda, con módulos `projects`, `donations`,
  `authz` y `audit`.
- Identidad: Amazon Cognito con Authorization Code + PKCE, access token de 15 minutos como
  máximo y MFA TOTP para GESTOR y AUDITOR. No se admite un login ficticio ni JWT
  autoemitidos.
- Datos: identidades y proyectos ficticios; solo correo de prueba y `sub`.
- Tokens en memoria del navegador, nunca en `localStorage`.

## Flujo de desarrollo

- El trabajo sigue el ciclo SDD: `constitution`, `specify`, `clarify`, `plan`, `tasks`,
  `analyze` e `implement`. La especificación se actualiza antes que el código.
- `main` está protegida. Todo cambio entra por Pull Request revisado por otro integrante,
  con CI en verde (lint, typecheck, tests y build).
- El código generado con IA sigue las mismas reglas: revisión humana, declaración en
  `AI_USAGE.md` y sin acceso de los agentes a credenciales. Ningún agente despliega sobre la
  cuenta AWS sin supervisión.

## Gobernanza

Esta constitución prevalece sobre otras prácticas del proyecto. Cada Pull Request DEBE
verificar su cumplimiento, y cada excepción DEBE justificarse en la sección de complejidad
de `plan.md`. Las enmiendas requieren acuerdo del equipo y un cambio de versión semántica:
MAJOR si se elimina o redefine un principio, MINOR si se añade, PATCH si se aclara.

**Versión**: 1.0.0 | **Ratificada**: pendiente de revisión del equipo | **Última enmienda**: 2026-11-09
