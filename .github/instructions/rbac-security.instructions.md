---
applyTo: "backend/**/*.py,frontend/src/**/*.ts,frontend/src/**/*.tsx"
description: "RBAC por permisos, autorización en backend, version_token, contraseñas y auditoría de login. Espejo de .cursor/rules/rbac-security.mdc."
---

# RBAC, seguridad y auditoría

## Modelo de roles y permisos

Vive en el schema `auth`. `auth.usuario.rol_id` → `auth.rol`. Los permisos están en
`auth.permiso` y se conectan con `auth.rol_permiso` (many-to-many). Para saber si un usuario
puede hacer algo se resuelve siempre usuario → rol → rol_permiso → permiso.

## Permission-First

- Nunca compares el nombre del rol (`rol.nombre == "VETERINARIO"`) para autorizar ni para
  mostrar/ocultar UI. Usá códigos de `auth.permiso.nombre` con formato `recurso:accion`.
- Acciones en el español ya sembrado en `scripts/rol_permiso.sql`: `ver`, `ver_listado`,
  `crear`, `editar`, `eliminar`, etc. (`mascotas:ver_listado`, `roles:editar`,
  `parametros:ver`, `catalogos:crear`). No inventes variantes en inglés (`read`, `create`).
- `*` = acceso total, en UI y en backend vía `has_permission`. El catálogo de permisos lo
  siembra el DBA; la UI de Roles no da de alta permisos nuevos.
- Excepción documentada: en Admin → Roles y Permisos se puede detectar el rol *objetivo*
  `ADMIN` (case-insensitive) para hacerlo inmutable (solo lectura, sin editar `rol_permiso`,
  sin recrearlo). Nunca para autorizar al usuario logueado. El `*` no se asigna a roles
  operativos desde la UI/API.

## Sesión y frontend

- Al iniciar sesión el backend carga usuario, rol y permisos, los mete en el JWT (cookie
  HttpOnly) y además los devuelve como JSON en el login y en `GET /api/auth/me`. El frontend
  no lee el JWT.
- El sidebar se dibuja con esos permisos, sin matrices de rol hardcodeadas.
- Ocultá ítems de menú sin permiso de lectura; con `*` se ven todos. Deshabilitá u ocultá
  botones de crear/editar/eliminar sin el permiso específico. Helper:
  `permisos.includes("*") || permisos.includes(required)`.

## Enforcement en backend

Ocultar en la UI es solo UX. Todo endpoint protegido valida el permiso en backend con
`require_permission` (o `get_current_authenticated_session` + `has_permission`) **antes** de
cualquier lógica. Nunca confíes en que el frontend ya filtró.

## Invalidación de sesiones (`version_token`)

Contador en `auth.usuario` incluido en el JWT. Sumale 1 cuando cambian los permisos
efectivos o el acceso: cambio de `rol_id`; sync de `auth.rol_permiso` de un rol (a todos los
usuarios con ese `rol_id`); cambio o restablecimiento de contraseña; inhabilitar usuario. En
cada request autenticado se compara JWT vs DB y, si difieren, 401 aunque el token no haya
vencido.

## Errores de autorización

`APIError` con códigos estables (`PERMISOS_INSUFICIENTES`, `ROL_ADMIN_INMUTABLE`,
`COMODIN_NO_PERMITIDO`) y detalle en español. No inventes middleware paralelo.

## Contraseñas (`auth.historial_contrasena`)

Nunca sobrescribas el hash: cada cambio inserta un registro nuevo (bcrypt/argon2). Si el
vigente tiene `debe_cambiar=true`, el login responde `403 DEBE_CAMBIAR_CONTRASENA` sin JWT; el
cambio se hace en `POST /api/auth/cambiar-contrasena-obligatorio` (público, sin auto-login).

## Auditoría de login (`auth.login`)

Todo intento, exitoso o fallido, se registra con `username_ingresado`, `ip`, `exito` y
`razon_fallo`: `USUARIO_INEXISTENTE`, `USUARIO_DESHABILITADO`, `CLAVE_INCORRECTA`,
`SIN_HISTORIAL_CONTRASENA`, `DEBE_CAMBIAR_CONTRASENA`. `USUARIO_DESHABILITADO` y
`DEBE_CAMBIAR_CONTRASENA` → 403; el resto → 401 genérico. La granularidad es solo para
auditoría interna.

## Auditoría sensible

Las acciones sobre historia clínica, recetas electrónicas y datos personales del cliente
(`core.persona`) quedan trazadas: quién, qué y cuándo.
