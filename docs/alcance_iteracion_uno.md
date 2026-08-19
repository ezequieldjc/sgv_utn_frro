# Alcance — Iteración 1 (Bases: Login + Home + RBAC)

## Qué se construye ahora

- Arquitectura general (frontend, backend, base de datos) según
  `.cursor/rules/tech-stack.mdc` y `.cursor/rules/database-types.mdc`.
- Login autenticado (`docs/login.md`) y cambio obligatorio de contraseña cuando
  `auth.historial_contrasena.debe_cambiar` es `true` (`docs/login_cambio_pwd.md`).
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
- Recuperación de contraseña (olvidé mi clave). El cambio obligatorio en el login ya
  está en alcance: si el historial vigente tiene `debe_cambiar`, el acceso se bloquea
  hasta actualizar la clave.

## Por qué existe este archivo

`docs/contexto.md` describe la visión completa del proyecto; este archivo acota qué parte de
esa visión se implementa en la corrida actual. Cuando cambie el alcance de la iteración,
actualizá este archivo — no el prompt maestro ni `contexto.md`.
