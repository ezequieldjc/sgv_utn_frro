# Alcance — Iteración 1 (Bases: Login + Home + RBAC)

## Qué se construye ahora

- Arquitectura general (frontend, backend, base de datos) según
  `.cursor/rules/tech-stack.mdc` y `.cursor/rules/database-types.mdc`.
- Pantalla de login (`docs/prompts-front/login.md` + `docs/prompts-back/login.md`).
- Home autenticada: sidebar + topbar + área central vacía (`docs/prompts-front/sidebar.md`).
- Modelo de datos mínimo para sostener lo anterior: `core.persona` (sin `domicilio_id`),
  `auth.usuario`, `auth.rol`, `auth.permiso`, `auth.rol_permiso`, `auth.historial_contrasena`,
  `auth.login`, `sys.config` — ver `docs/prompts-data/modelo_datos_v1.md`.

## Qué NO se construye todavía

- `core.domicilio` y la columna `persona.domicilio_id` (se agregan cuando exista un módulo
  real de gestión de personas/dueños que los use).
- Módulo Clínica completo: `clinica.especie`, `clinica.raza`, `clinica.mascota`,
  `clinica.historial_peso`. El diccionario ya está definido para referencia futura, pero no
  se migra ni se crean sus tablas en esta iteración.
- Historia Clínica Digital, dictado por voz / NLP, asistencia diagnóstica por IA, inventario
  unificado, automatización de turnos, recordatorios por WhatsApp, recetas electrónicas.
- Recuperación de contraseña y pantalla de cambio de contraseña. El campo
  `auth.historial_contrasena.debe_cambiar` existe en el modelo, pero su enforcement en el
  login (bloquear el acceso hasta cambiar la clave) queda para cuando exista esa pantalla.

## Por qué existe este archivo

`docs/contexto.md` describe la visión completa del proyecto; este archivo acota qué parte de
esa visión se implementa en la corrida actual. Cuando cambie el alcance de la iteración,
actualizá este archivo — no el prompt maestro ni `contexto.md`.
