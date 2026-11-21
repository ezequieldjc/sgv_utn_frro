# Contexto del proyecto (resumen para continuar en Cursor)

Sistema de gestión veterinaria para la clínica **Yacanvet** (UTN FRRO). Este archivo resume
solo lo relevante para seguir trabajando. El detalle vive en los archivos que se referencian.

## Fuentes de verdad (leer antes de codear)

| Qué | Dónde |
|-----|-------|
| Reglas transversales (stack, DBA-first, RBAC, UI, tests) | `.cursor/rules/*.mdc` |
| Specs por pantalla/botón | `docs/prompts botones/*.md` |
| Diccionario de datos | `docs/modelo_datos_v1.md` |
| Visión del producto | `docs/contexto.md` |
| Sidebar y permisos por ítem | `docs/sidebar.md` |
| Catálogo de permisos sembrado | `scripts/rol_permiso.sql` |
| Cómo correr / cómo mergear | `como correr.md`, `como mergear.md` |

Las specs de pantalla **no** repiten layout, AccessDenied, validación ni RBAC genérico: eso está
en las rules. Una spec nueva solo describe objetivo, permisos del módulo, contrato API y reglas
de negocio de esa feature.

## Forma de trabajo acordada

1. Se analiza el pedido contra lo documentado y se sacan dudas.
2. Se escribe/madura la spec en `docs/prompts botones/<modulo>_<feature>.md`.
3. Se ejecuta la spec (backend + frontend + tests) y se marca `Estado: implementado`.

**DBA-first:** el usuario es el DBA. La app (`fastapi_app`) solo hace DML. Nunca DDL,
`create_all()` ni `alembic upgrade` contra la DB. Si falta una tabla/columna, se le pide al DBA.
Los seeds (permisos, filas de `sys.config`) se piden como INSERT de datos.

## Stack

- **DB:** PostgreSQL multi-schema (`core`, `auth`, `clinica`, `catalogo`, `sys`). Tests backend
  usan SQLite en memoria (`backend/tests/conftest.py`).
- **Back:** Python, FastAPI, Uvicorn, SQLModel, Pydantic, JWT en cookie HttpOnly, bcrypt,
  `APIError` con códigos `SCREAMING_SNAKE` y detalle en español. Tests con Pytest.
- **Front:** React 18 + TypeScript estricto + Vite (SPA, no Next.js), React Router v6, Tailwind,
  Shadcn UI (componentes en `frontend/src/components/ui/`, sobre Radix), Lucide. `apiFetch` en
  `frontend/src/lib/api.ts`. Tests con Vitest + Testing Library.
  - **Sin** React Hook Form, Zod ni toasts: validación manual, Dialogs Shadcn y banners inline.
  - Tipos TS a mano con `// TODO: reemplazar por tipo generado desde OpenAPI`.
- **GitHub:** ramas `feature/*` → `staging` → `main`. CI (`.github/workflows/ci.yml`) corre solo
  `pytest` del backend en PRs a `staging`/`main`. CD: `main` despliega el front en Vercel. No hay
  CI de frontend ni deploy automático del backend en el repo.

## RBAC (resumen)

- Cadena: `auth.usuario` → `auth.rol` → `auth.rol_permiso` → `auth.permiso`.
- Códigos `recurso:accion` del seed (`ver`, `ver_listado`, `crear`, `editar`, `eliminar`), no
  `read`/`create`. Comodín `*` = acceso total.
- UI: `permisos.includes("*") || permisos.includes(required)`. El backend siempre valida.
- Cambiar permisos de un rol o el rol de un usuario → `version_token += 1` de los afectados.
- Rol **ADMIN** (por nombre, case-insensitive) es inmutable en Admin → Roles. Es la única
  excepción permitida a "no comparar nombres de rol".

## Pantallas implementadas

| Pantalla | Ruta | Spec |
|----------|------|------|
| Admin → Usuarios (listado, alta, restablecer contraseña) | `/admin/usuarios` | `admin_usuarios*.md` |
| Admin → Catálogos | `/admin/catalogos` | `admin_catalogos.md` |
| Admin → Roles y Permisos | `/admin/roles`, `/admin/roles/:id` | `admin_RolesYPermisos.md` |
| Admin → Parámetros | `/admin/parametros` | `admin_parametros.md` |
| Clientes (listado, alta) | `/clientes`, `/clientes/nuevo` | `clientes_*.md` |
| Mascotas (listado, alta, edición) | `/mascotas`, `/mascotas/nuevo`, `/mascotas/:id/editar` | `mascotas_*.md` |

Pantallas de referencia para copiar patrones: `mascota-form-page.tsx`, `cliente-form-page.tsx`
(forms) y `catalogos-page.tsx`, `roles-page.tsx` (hubs Admin).

### Roles y Permisos (lo último hecho)

- API: `GET /api/roles` (liviano, también para el combo de Usuarios), `GET /api/roles/{id}`,
  `POST /api/roles`, `PUT /api/roles/{id}/permisos` (reemplazo total), `GET /api/permisos`.
- Se pueden crear roles; **no** se crean permisos desde la UI.
- ADMIN se muestra solo lectura con todo marcado. `*` no se asigna a roles operativos.
- Archivos: `backend/app/api/roles.py`, `api/permisos.py`, `services/rol_service.py`,
  `frontend/src/pages/admin/roles-page.tsx`.

### Parámetros (lo último hecho)

- API: `GET /api/config` (`parametros:ver`), `PATCH /api/config/{id}` (`parametros:editar`).
  `GET /api/config/public` no cambió.
- Muestra todas las filas de `sys.config` agrupadas por `config_nombre`. Solo se edita
  `parametro_valor` (sin alta ni baja).
- Enteros ≥ 1: `ACCESS_TOKEN_EXPIRACION`, `REFRESH_TOKEN_EXPIRACION`,
  `PERSONA_ID_TUTOR_EVENTUAL`. El resto: texto no vacío.
- Tras cada PATCH se llama `clear_config_cache()` (obligatorio).

## Pendientes para el DBA

- Insertar el permiso `*` (ya está en `scripts/rol_permiso.sql`) y vincularlo al rol `ADMIN`.
- Asignar `roles:*` y `parametros:*` al rol con el que se administra.
- Documentar en `docs/modelo_datos_v1.md` el grupo `SISTEMA` de `sys.config`
  (`PERSONA_ID_TUTOR_EVENTUAL`, `RAZA_NOMBRE_DEFAULT`).

## Deuda conocida

- `backend/scripts/seed_admin.py` usa nombres viejos de config (`system`, `razon_social`).
- Los tests backend corren sobre SQLite, no sobre Postgres.
- No existe pipeline de tipos TS generados desde OpenAPI.

## Si se movió la carpeta del proyecto

- Git no se pierde (todo está en `.git`).
- Recrear `backend/.venv` (guarda rutas absolutas) y actualizar las rutas de `como correr.md`.
