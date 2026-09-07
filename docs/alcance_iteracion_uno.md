# Alcance — Iteración 1 (Bases: Login + Home + RBAC)

## Qué se construye ahora

- Arquitectura general (frontend, backend, base de datos) según
  `.cursor/rules/tech-stack.mdc` y `.cursor/rules/database-types.mdc`.
- Pantalla de login (`docs/prompts-front/login.md` + `docs/prompts-back/login.md`).
- Home autenticada: sidebar + topbar + área central vacía (`docs/prompts-front/sidebar.md`).
- Modelo de datos mínimo para sostener lo anterior: `core.persona` (sin `domicilio_id`),
  `auth.usuario`, `auth.rol`, `auth.permiso`, `auth.rol_permiso`, `auth.historial_contrasena`,
  `auth.login`, `sys.config` — ver `docs/modelo_datos_v1.md`.

## Qué NO se construye todavía (app)

- Historia Clínica Digital, dictado por voz / NLP, UI completa de asistencia diagnóstica por
  IA, inventario unificado, automatización de turnos, recordatorios por WhatsApp, recetas
  electrónicas.
- Pantallas/API del módulo Mascotas (alta, listado real, pesos, patologías sugeridas). Las
  tablas de `clinica.*` y `catalogo.*` **ya existen en PostgreSQL** y están documentadas en
  `docs/modelo_datos_v1.md` y `docs/modelo_datos_cambios_mascota_20260907.md`; el cableado
  de la aplicación queda para una iteración posterior.

## Nota sobre el diccionario de datos

El alcance de *código* de esta iteración no incluye el módulo Mascotas, pero el diccionario
canónico (`docs/modelo_datos_v1.md`) refleja el estado real de la BD (incluidos catálogos y
mascota). No uses el viejo campo libre `mascota.estado`.

## Por qué existe este archivo

`docs/contexto.md` describe la visión completa del proyecto; este archivo acota qué parte de
esa visión se implementa en la corrida actual. Cuando cambie el alcance de la iteración,
actualizá este archivo — no el prompt maestro ni `contexto.md`.
