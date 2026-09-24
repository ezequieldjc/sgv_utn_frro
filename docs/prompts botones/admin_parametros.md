# Especificación de Pantalla: Admin -> Parámetros (`/admin/parametros`)

Gestión administrativa de variables globales en `sys.config` (solo lectura de metadatos +
edición de `parametro_valor`).

Seguí los patrones de layout, permisos y feedback ya usados en `admin_catalogos.md` /
`admin_RolesYPermisos.md` / `admin_usuarios.md` (header Admin + AccessDenied + mensajes
inline; sin alta/baja de filas).

Referencias de reglas: `.cursor/rules/home.mdc`, `tech-stack.mdc`, `database-types.mdc`,
`rbac-security.mdc`, `docs/modelo_datos_v1.md`, `docs/sidebar.md`.

Estado: **implementado** (primera iteración).

---

## 1. Objetivo

Permitir a usuarios autorizados:

- Ver **todas** las filas de `sys.config` existentes en la base.
- Agruparlas visualmente por `config_nombre` (JWT, BRANDING, SISTEMA, u otros que el DBA
  agregue).
- Editar únicamente `parametro_valor` de cada fila.
- Guardar solo los cambios pendientes (filas dirty).

Caso típico: cambiar `RAZON_SOCIAL` o los minutos de `ACCESS_TOKEN_EXPIRACION` sin tocar
nombres ni IDs de configuración.

---

## 2. Alcance / modelo

Tabla ya existente (sin DDL desde la app):

| Tabla | Uso |
|-------|-----|
| `sys.config` | Listar todas las filas; PATCH solo de `parametro_valor` |

Campos (diccionario `docs/modelo_datos_v1.md`):

| Campo | Editable en UI |
|-------|----------------|
| `id` | No (PK; clave del PATCH) |
| `config_id` | No (solo lectura) |
| `config_nombre` | No (agrupa secciones) |
| `parametro_id` | No (solo lectura) |
| `parametro_nombre` | No (label del campo) |
| `parametro_valor` | **Sí** (único editable; varchar 255, no nulo, no vacío) |

### Dentro de alcance (v1)

- Pantalla `/admin/parametros`.
- Listado dinámico de **todas** las filas (no un set hardcodeado).
- Edición de `parametro_valor` con validación FE + BE.
- Invalidar cache de `config_service` tras cada PATCH exitoso.

### Fuera de alcance (v1)

- POST / DELETE de filas de `sys.config`.
- Editar `config_nombre`, `parametro_nombre`, `config_id`, `parametro_id`.
- UI para crear grupos/parámetros nuevos.
- Introducir Zod u otras libs de validación no usadas en el proyecto.
- Cambiar el contrato de `GET /api/config/public`.

---

## 3. Prerrequisito de datos (DBA)

Sin DDL. Las filas viven en Postgres; la app solo hace DML.

Seeds documentados en el diccionario (mínimo esperado):

| config_nombre | parametro_nombre | Tipo lógico |
|---------------|------------------|-------------|
| JWT | `ACCESS_TOKEN_EXPIRACION` | Entero positivo (minutos) |
| JWT | `REFRESH_TOKEN_EXPIRACION` | Entero positivo (minutos) |
| BRANDING | `RAZON_SOCIAL` | Texto no vacío |

También pueden existir (código/SQL de negocio, no siempre en el diccionario seed):

| config_nombre | parametro_nombre | Tipo lógico |
|---------------|------------------|-------------|
| SISTEMA | `PERSONA_ID_TUTOR_EVENTUAL` | Entero positivo (id de persona) |
| SISTEMA | `RAZA_NOMBRE_DEFAULT` | Texto no vacío |

La pantalla **no asume** que solo existen estos: si el DBA agrega otra fila, debe aparecer
agrupada bajo su `config_nombre` y validarse como texto no vacío salvo que entre en la
tabla de validación canónica (sección 4).

Nota: `backend/scripts/seed_admin.py` puede tener nombres legados (`system` /
`razon_social`); **no** usarlos como canónicos. La fuente de verdad de nombres es el
diccionario + seeds SQL / datos reales en Postgres.

Acceso en runtime: siempre vía `config_service` (cache). Tras editar desde Admin, hay que
llamar `clear_config_cache()`.

---

## 4. Permisos (RBAC)

Convención `recurso:accion`. Wildcard `*` implica todos.

| Permiso | Uso |
|---------|-----|
| `parametros:ver` | Ver pantalla `/admin/parametros` y `GET /api/config` |
| `parametros:editar` | Inputs editables + botón Guardar + `PATCH /api/config/{id}` |

Ya sembrados en `scripts/rol_permiso.sql`. **No** usar `admin:config:update` ni otros
códigos inventados.

### Reglas de UI por permiso

- Sin `parametros:ver` (ni `*`): AccessDenied (`ShieldOff`, mismo patrón que Roles/Catálogos).
- Con `parametros:ver` y sin `parametros:editar`: pantalla en **solo lectura** (inputs
  `disabled` / `readOnly`; sin botón Guardar).
- Botón **Guardar cambios**: solo con `parametros:editar`, y solo si hay dirty fields.

---

## 5. Rutas

| Ruta | Descripción |
|------|-------------|
| `/admin/parametros` | Hub de parámetros del sistema |

Sidebar: ítem **Parámetros** bajo Admin → `/admin/parametros` con permiso `parametros:ver`
(ya en `docs/sidebar.md` y `app-shell.tsx`). Al implementar: registrar la ruta en
`App.tsx` (hoy el destino está vacío).

Breadcrumb: label `Parámetros` para el segmento `parametros` (agregar al mapa del shell si
falta).

---

## 6. Layout propuesto

### Header

- Eyebrow: `Admin` (+ ícono Lucide, ej. `SlidersHorizontal` / `Settings2`).
- Título: `Parámetros`.
- Subtítulo muted: `Configuración global del sistema (sys.config).`

### Barra de acciones

Misma línea base (desktop):

1. Texto muted opcional: “Solo se puede editar el valor de cada parámetro.”
2. Botón primario **Guardar cambios** (`parametros:editar`):
   - Deshabilitado si no hay cambios locales o mientras guarda.
   - Loading con spinner en el botón.

### Cuerpo: secciones por `config_nombre`

```
┌─────────────────────────────────────────────────────────────┐
│  Admin / Parámetros                    [Guardar cambios]    │
├─────────────────────────────────────────────────────────────┤
│  JWT                                                        │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ ACCESS_TOKEN_EXPIRACION     [ 15              ]       │  │
│  │ REFRESH_TOKEN_EXPIRACION    [ 1440            ]       │  │
│  └───────────────────────────────────────────────────────┘  │
│  BRANDING                                                   │
│  ┌───────────────────────────────────────────────────────┐  │
│  │ RAZON_SOCIAL                [ Yacanvet        ]       │  │
│  └───────────────────────────────────────────────────────┘  │
│  SISTEMA (si existe en DB)                                  │
│  …                                                          │
└─────────────────────────────────────────────────────────────┘
```

Reglas:

- Orden de secciones: `config_nombre` ascendente (locale `es`).
- Dentro de cada sección: orden por `parametro_id` ascendente (estable); si hay empate,
  por `parametro_nombre`.
- Cada fila: label = `parametro_nombre` (+ `descripcion` no aplica; no hay columna).
  Opcional muted: `config_id` / `parametro_id` en texto chico solo si aporta depuración;
  **no** es requisito de v1.
- Input controlado bound a `parametro_valor` (string).
- Contenedor por grupo: card `rounded-2xl border` (mismo lenguaje visual Admin).

### Dirty state

- Al cargar, baseline = valores del GET.
- Dirty = valor local trimmeable distinto del baseline (comparar string tal cual el usuario
  ve; al guardar se envía `trim()`).
- Si hay dirty y el usuario intenta navegar fuera: Dialog de confirmación
  (“Hay cambios sin guardar. ¿Descartarlos?”) — mismo criterio que Roles.

### Empty / loading / error

- Loading: skeleton de 2–3 cards.
- Vacío: “No hay parámetros cargados en sys.config.”
- Error recuperable: banner destructive (mismo patrón Roles).
- Éxito tras guardar: banner verde breve (“Parámetros actualizados.”).

### Solo lectura

Con `parametros:ver` sin `parametros:editar`: mismos grupos e inputs deshabilitados; sin
Guardar.

---

## 7. Validación de `parametro_valor`

**Sin Zod.** Validar en frontend (antes de enviar) y en backend (antes de persistir) con la
misma tabla canónica por `parametro_nombre`.

| `parametro_nombre` | Regla |
|--------------------|--------|
| `ACCESS_TOKEN_EXPIRACION` | Entero ≥ 1 (string que parsea a int; sin decimales) |
| `REFRESH_TOKEN_EXPIRACION` | Entero ≥ 1 |
| `PERSONA_ID_TUTOR_EVENTUAL` | Entero ≥ 1 |
| `RAZON_SOCIAL` | Texto no vacío tras trim; max 255 |
| `RAZA_NOMBRE_DEFAULT` | Texto no vacío tras trim; max 255 |
| **Cualquier otro** | Texto no vacío tras trim; max 255 |

Reglas comunes:

- Tras `trim()`, vacío → inválido (nunca null / `""`).
- Longitud máxima 255 (columna).
- Enteros: rechazar `01` opcionalmente normalizable a `1` en backend, o aceptar solo dígitos
  con `int(valor)` y `valor == str(int(valor))` tras trim — decisión cerrada: aceptar
  cualquier string que `int()` parsea sin error y resulta `>= 1`, y **persistir el string
  del entero canónico** (`str(n)`), no el input crudo con espacios.

Errores de validación:

- FE: mensaje bajo el input + borde `border-destructive`; scroll/foco al primero.
- BE: `400` con código `VALOR_INVALIDO` y detalle legible; no persistir.

---

## 8. Guardado

1. Usuario pulsa **Guardar cambios**.
2. Validar en FE todas las filas dirty; si alguna falla, no llamar API.
3. Por cada fila dirty válida: `PATCH /api/config/{id}` con `{ "parametro_valor": "..." }`
   (secuencial o `Promise.all`; si una falla, mostrar error y no marcar esa fila como
   guardada).
4. Tras éxito de cada PATCH: actualizar baseline local de esa fila.
5. Si todas OK: banner de éxito; limpiar dirty.

Alternativa válida al implementar: un único endpoint batch — **fuera de v1**. En v1 se
usan N PATCH (uno por dirty).

---

## 9. Contrato de API

Extender el router existente `prefix="/api/config"` en `backend/app/api/config.py`.
**Mantener** `GET /api/config/public` sin cambios de contrato.

| Método | Ruta | Permiso | Uso |
|--------|------|---------|-----|
| GET | `/api/config/public` | público | Sin cambios (`razon_social`) |
| GET | `/api/config` | `parametros:ver` | Listar **todas** las filas |
| PATCH | `/api/config/{id}` | `parametros:editar` | Actualizar `parametro_valor` |

### `GET /api/config` — response ejemplo

```json
[
  {
    "id": 1,
    "config_id": 1,
    "config_nombre": "JWT",
    "parametro_id": 1,
    "parametro_nombre": "ACCESS_TOKEN_EXPIRACION",
    "parametro_valor": "15"
  },
  {
    "id": 2,
    "config_id": 1,
    "config_nombre": "JWT",
    "parametro_id": 2,
    "parametro_nombre": "REFRESH_TOKEN_EXPIRACION",
    "parametro_valor": "1440"
  },
  {
    "id": 3,
    "config_id": 2,
    "config_nombre": "BRANDING",
    "parametro_id": 1,
    "parametro_nombre": "RAZON_SOCIAL",
    "parametro_valor": "Yacanvet"
  }
]
```

Orden sugerido en API: `config_nombre` asc, luego `parametro_id` asc (el FE puede
reordenar igual).

### `PATCH /api/config/{id}` — body

```json
{
  "parametro_valor": "30"
}
```

Schema Pydantic `ConfigValorUpdate`:

```python
parametro_valor: str = Field(min_length=1, max_length=255)
```

(La validación de tipo lógico por `parametro_nombre` es adicional en el service, no solo
`min_length`.)

Response `200`: el ítem completo actualizado (mismo shape que un elemento del listado).

Tras persistir: **obligatorio** `clear_config_cache()` para que JWT / razón social /
tutor eventual lean el valor nuevo.

### Errores controlados

| HTTP | Código | Cuándo |
|------|--------|--------|
| 401 | (sesión) | Sin cookie / token inválido |
| 403 | `PERMISOS_INSUFICIENTES` | Sin `parametros:ver` / `parametros:editar` |
| 404 | `CONFIG_NO_ENCONTRADA` | `id` inexistente |
| 400 | `VALOR_INVALIDO` | Vacío, no entero cuando corresponde, etc. |
| 422 | validación Pydantic | Body mal formado |

No hay POST ni DELETE en este recurso admin.

---

## 10. Backend — estructura sugerida

- Extender `schemas/config.py`: `ConfigItem`, `ConfigValorUpdate`.
- Extender `config_service.py`: `list_all_configs`, `update_config_valor` (+ validación por
  nombre + `clear_config_cache`).
- Extender `api/config.py`: rutas GET `` y PATCH `/{id}` con auth RBAC.
- Tipado estricto; solo DML.

---

## 11. Frontend — estructura sugerida

- `frontend/src/pages/admin/parametros-page.tsx` (+ `parametros-page.test.tsx`).
- Ruta en `App.tsx`: `admin/parametros`.
- Tipos en `frontend/src/types/config.ts` (o `parametros.ts`) con
  `// TODO: reemplazar por tipo generado desde OpenAPI`.
- Sin Zod: helpers exportados `validateParametroValor(nombre, valor)` reutilizados en tests.
- Reutilizar Input, Button, Label, Skeleton, Dialog, Badge si aplica — Shadcn.

---

## 12. Tests (obligatorios)

### Backend (Pytest)

1. `GET /api/config` sin auth → 401.
2. Sin `parametros:ver` → 403; con permiso → 200 y lista completa.
3. `PATCH` sin `parametros:editar` → 403.
4. `PATCH` valor vacío / solo espacios → 400 `VALOR_INVALIDO`.
5. `PATCH` `ACCESS_TOKEN_EXPIRACION` con `"abc"` → 400; con `"30"` → 200 y valor `"30"`.
6. Tras PATCH exitoso, `get_config_value` / lectura vía service refleja el nuevo valor
   (cache invalidada).
7. `GET /api/config/public` sigue funcionando (regresión).

### Frontend (Vitest)

- AccessDenied sin `parametros:ver`.
- Sin `parametros:editar`: no hay botón Guardar (o inputs disabled).
- Helper de validación: enteros vs texto.
- (Smoke) agrupa por `config_nombre`.

No testear estilos Tailwind.

---

## 13. Criterios de aceptación (checklist)

1. Sidebar Admin muestra **Parámetros** solo con `parametros:ver` o `*`.
2. Existe ruta SPA `/admin/parametros` con página real.
3. Se listan **todas** las filas de `sys.config`, agrupadas por `config_nombre`.
4. Solo se edita `parametro_valor`; no hay alta ni baja.
5. Valor vacío rechazado en FE y BE.
6. Parámetros enteros canónicos validan número ≥ 1.
7. Guardar envía solo dirty vía `PATCH /api/config/{id}`.
8. Cache de `config_service` se limpia tras PATCH.
9. `GET /api/config/public` intacto.
10. Tests de API cubren 401/403/200/400 y regresión public.
11. Sin Zod; sin DDL desde la app.

---

## 14. Decisiones cerradas

1. **UI dinámica:** todas las filas de DB; no whitelist hardcodeada de grupos.
2. **RBAC:** `parametros:ver` / `parametros:editar` (seed existente).
3. **API base:** `/api/config` (junto a `/public`); no `/api/admin/config`.
4. **Guardado:** botón global; N PATCH por dirty (sin batch en v1).
5. **Validación:** tabla canónica por `parametro_nombre`; resto = texto no vacío; sin Zod.
6. **Enteros:** persistir `str(int(valor))` tras validar `>= 1`.
7. **Cache:** `clear_config_cache()` obligatorio post-PATCH.
8. **Feedback:** banners inline (patrón Roles/Catálogos).

---

## 15. Fuera de alcance / mejoras posteriores

- Endpoint batch `PATCH /api/config` con array de `{id, parametro_valor}`.
- Historial / auditoría de cambios de parámetros.
- Tipado rico por parámetro (boolean, JSON) más allá de entero/texto.
- Alinear/eliminar nombres legados en `seed_admin.py`.
- Documentar en `modelo_datos_v1.md` el grupo SISTEMA (`PERSONA_ID_TUTOR_EVENTUAL`,
  `RAZA_NOMBRE_DEFAULT`) si el DBA lo confirma como canónico.
