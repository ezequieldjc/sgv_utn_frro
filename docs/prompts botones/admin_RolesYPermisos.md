# Especificación de Pantalla: Admin -> Roles y Permisos (`/admin/roles`)

Gestión administrativa de roles y de la asignación de permisos (`auth.rol` ↔
`auth.rol_permiso` ↔ `auth.permiso`).

Seguí los patrones de layout, permisos y hub ya usados en `admin_catalogos.md` /
`admin_usuarios.md` / `clientes_listado.md` (header Admin + barra de controles +
AccessDenied + Dialogs Shadcn).

Referencias de reglas: `.cursor/rules/home.mdc`, `tech-stack.mdc`, `database-types.mdc`,
`rbac-security.mdc`, `docs/modelo_datos_v1.md`, `docs/sidebar.md`, `docs/contexto.md`.

Estado: **implementado** (primera iteración).

---

## 1. Objetivo

Permitir a usuarios autorizados:

- Ver el listado de roles del sistema.
- Ver, por cada rol, qué permisos tiene asignados.
- **Crear** roles nuevos (ej. `CEO`) con nombre y descripción opcional.
- **Configurar** (asignar / quitar) permisos de un rol no-ADMIN, usando el catálogo
  existente de `auth.permiso` (checks por permiso atómico `recurso:accion`).

Caso típico: crear el rol `CEO`, marcar `mascotas:ver_listado` y `clientes:ver_listado`,
guardar; o quitar `mascotas:crear` del rol `CLIENTE`.

---

## 2. Alcance / modelo

Tablas ya existentes (sin DDL desde la app):

| Tabla | Uso en esta pantalla |
|-------|----------------------|
| `auth.rol` | Listar / crear roles (`id`, `nombre` UQ, `descripcion`) |
| `auth.permiso` | Catálogo de permisos (**solo lectura** en UI) |
| `auth.rol_permiso` | Matriz M:N a sincronizar al guardar |
| `auth.usuario` | Al mutar permisos de un rol → bumpear `version_token` de usuarios con ese `rol_id` |

### Dentro de alcance (v1)

- Hub `/admin/roles` + deep-link `/admin/roles/:id`.
- Crear rol (`roles:crear`).
- Ver y editar mapeo rol ↔ permisos (`roles:ver` / `roles:editar`).
- Rol **ADMIN** solo lectura (ver sección 6).

### Fuera de alcance (v1)

- Crear / editar / eliminar filas de `auth.permiso` desde la UI.
- Editar `nombre` / `descripcion` de un rol ya existente.
- Eliminar roles (`roles:eliminar` existe en seed pero **no se usa** en esta iteración).
- Asignar rol a usuarios (eso vive en Admin → Usuarios).
- Hardcodear matrices de permisos por nombre de rol en frontend (salvo la regla de
  protección del rol ADMIN documentada abajo).

---

## 3. Prerrequisito de datos (DBA)

Las tablas ya existen. No se pide DDL estructural.

### 3.1 Catálogo de permisos

Ya sembrado en `scripts/rol_permiso.sql` (códigos `recurso:accion`, incl. `roles:ver`,
`roles:crear`, `roles:editar`, `roles:eliminar`).

### 3.2 Comodín `*` para ADMIN (dato, no DDL)

El motor de autorización ya trata `*` como acceso total (`has_permission`).

**Pedido al DBA (si aún no está en Postgres):**

1. Insertar el permiso comodín (si falta):

```sql
INSERT INTO auth.permiso (nombre, descripcion) VALUES
('*', 'Acceso total al sistema (comodín)')
ON CONFLICT (nombre) DO NOTHING;
```

2. Asegurar que el rol cuyo `nombre` es `ADMIN` (case-insensitive) tenga ese permiso en
   `auth.rol_permiso` (y no haga falta listar uno por uno para que el runtime le dé acceso
   total).

3. Confirmar que existe al menos un `auth.rol` con `nombre = 'ADMIN'` (o el casing que ya
   use el entorno; la app detecta por igualdad case-insensitive).

No hardcodear en frontend qué permisos “debería” tener ADMIN más allá de la UI de solo
lectura y del indicador de acceso total.

---

## 4. Permisos (RBAC)

Convención `recurso:accion`. Wildcard `*` implica todos.

| Permiso | Uso |
|---------|-----|
| `roles:ver` | Ver pantalla `/admin/roles`, listar roles, ver matriz (incl. ADMIN en solo lectura) |
| `roles:crear` | Botón `+ Nuevo Rol` y alta de rol |
| `roles:editar` | Guardar cambios de asignación en `auth.rol_permiso` (roles ≠ ADMIN) |
| `roles:eliminar` | **No usado en v1** (queda en seed para una iteración futura) |

La asignación de estos permisos a cada rol vive en `auth.rol_permiso`; no hardcodear en
frontend.

### Reglas de UI por permiso

- Sin `roles:ver` (ni `*`): AccessDenied (mismo patrón visual que Usuarios / Catálogos /
  Clientes: `ShieldOff`).
- `+ Nuevo Rol`: solo con `roles:crear`.
- Checks de la matriz + botón Guardar: solo con `roles:editar`, y solo si el rol
  seleccionado **no** es ADMIN.
- Rol ADMIN: siempre matriz / indicador de solo lectura (aunque el usuario tenga
  `roles:editar`).

### Excepción documentada (protección de rol de sistema)

La autorización del **usuario logueado** sigue siendo por permiso (`roles:*`), nunca por
nombre de su rol.

La única comparación por nombre de rol permitida en esta pantalla es para **proteger el
rol de sistema ADMIN** (inmutable): si el rol *seleccionado / objetivo de la mutación*
tiene `nombre` igual a `ADMIN` (case-insensitive), la UI y el backend bloquean cualquier
cambio de `rol_permiso` (y de alta que intente crear otro `ADMIN`).

---

## 5. Rutas

| Ruta | Descripción |
|------|-------------|
| `/admin/roles` | Hub: lista de roles + matriz del rol seleccionado |
| `/admin/roles/:id` | Mismo hub con rol preseleccionado (deep-link desde Admin → Usuarios) |

Al cargar `/admin/roles/:id`:

1. Validar que el `id` exista; si no → empty/error recuperable (o redirigir a `/admin/roles`
   con mensaje).
2. Seleccionar ese rol en el nav / Select.
3. Cargar su matriz de permisos.

Al elegir otro rol en el nav, actualizar la URL a `/admin/roles/:id` (replace o navigate)
para que el deep-link y el breadcrumb sigan coherentes.

Sidebar: ítem **Roles y Permisos** bajo Admin → `/admin/roles` con permiso `roles:ver`
(ya documentado en `docs/sidebar.md` y cableado en `app-shell.tsx`).

Breadcrumb: label `Roles y Permisos` para el segmento `roles` (ya presente en el shell).

---

## 6. Layout propuesto (importante)

### Idea general: hub tipo Catálogos (selector de rol + matriz)

Una sola pantalla con dos zonas claras:

```
┌─────────────────────────────────────────────────────────────┐
│  Admin                                                      │
│  Roles y Permisos                                           │
│  Asignación de permisos a cada rol del sistema.             │
├──────────────┬──────────────────────────────────────────────┤
│ Roles (nav)  │  [Buscar permiso…]     [Guardar] [+ Nuevo Rol]│
│ • ADMIN 🔒   │──────────────────────────────────────────────│
│ • CLIENTE    │  Dominio: Mascotas                           │
│ • CEO        │  ☑ mascotas:ver_listado                      │
│ • …          │  ☐ mascotas:crear                            │
│              │  …                                           │
│              │  Dominio: Clientes                           │
│              │  …                                           │
└──────────────┴──────────────────────────────────────────────┘
```

**Alineación (desktop):** el tope del nav de roles y el tope de la barra de controles
(buscador + acciones) en la misma línea base — mismo cuidado que Catálogos (no usar
`space-y-*` en un wrapper que también contenga el Select mobile `lg:hidden`).

### A. Header

- Eyebrow: `Admin` (+ ícono Lucide coherente, ej. `Shield` / `KeyRound`).
- Título: `Roles y Permisos`.
- Subtítulo muted: `Asignación de permisos a cada rol del sistema.`

### B. Nav vertical de roles

**Desktop:** nav vertical a la izquierda con los roles ordenados por `nombre` ascendente.

**Mobile:** `Select` arriba (“Rol: CLIENTE ▾”).

Cada ítem muestra:

- Nombre del rol.
- Si es ADMIN: badge o candado “Solo lectura”.

Al elegir un rol:

1. Se actualiza la ruta a `/admin/roles/:id`.
2. Se carga / muestra la matriz de ese rol.
3. Se limpia el buscador de permisos (si había filtro local).

### C. Zona de matriz (derecha)

#### Controles superiores

1. **Buscador** (`Input` + `Search`): filtra permisos por `nombre` o `descripcion`
   (filtro local en frontend sobre el catálogo ya cargado).
2. **Botón Guardar** (permiso `roles:editar`, oculto/deshabilitado en ADMIN o sin
   cambios pendientes).
3. **Botón `+ Nuevo Rol`** (permiso `roles:crear`).

#### Matriz de permisos

- Listar **todos** los permisos del catálogo (`auth.permiso`), **excepto** ocultar el
  comodín `*` en la lista editable de roles no-ADMIN (el `*` no se asigna manualmente
  desde checks; es exclusivo del modelo ADMIN / acceso total).
- Agrupar por dominio = prefijo antes de `:` (`mascotas`, `clientes`, `usuarios`,
  `roles`, `catalogos`, `consultas`, `agenda`, `stock`, `recetas`, `parametros`,
  `auditoria`, …). Orden de grupos alfabético; dentro del grupo, por `nombre` ascendente.
- Cada fila: checkbox + `nombre` del permiso + `descripcion` (muted / tooltip si es larga).
- Checkbox marcado ⇔ existe fila en `auth.rol_permiso` para ese rol + permiso.

#### Vista especial: rol ADMIN

- Badge “Solo lectura” / “Acceso total”.
- Texto de ayuda: el rol ADMIN tiene acceso total al sistema (comodín `*` / todos los
  permisos) y **no se puede modificar** desde esta pantalla.
- No mostrar checks editables. Opciones de presentación (elegir una y ser consistente):

  1. **Preferida:** indicador de acceso total + lista de dominios/permisos en estado
     “otorgado” visual (checks checked + `disabled`), sin botón Guardar; **o**
  2. Solo el indicador de acceso total + mensaje, sin lista de checks.

  Decisión cerrada: usar la opción **1** (lista completa checked + disabled) para que el
  operador vea el catálogo de capacidades del sistema, dejando claro que ADMIN las cubre
  todas vía `*`.

#### Empty / loading / error

- Loading: skeleton del nav + de la matriz.
- Sin roles: “No hay roles cargados.” + CTA `+ Nuevo Rol` si tiene `roles:crear`.
- Rol sin permisos (no-ADMIN): matriz con todos los checks en off (válido).
- Error recuperable: mismo patrón visual que Usuarios / Catálogos.
- Sin `roles:ver`: AccessDenied.

#### Cambios sin guardar

Si el usuario modifica checks y cambia de rol o navega lejos: Dialog de confirmación
(“Hay cambios sin guardar. ¿Descartarlos?”) — mismo criterio UX que formularios Admin
cuando ya exista el patrón; si no, implementar este confirm acá.

---

## 7. Alta de rol (Dialog)

Permiso: `roles:crear`.

### Campos

| Campo | Regla |
|-------|--------|
| `nombre` | Obligatorio, varchar(50), unique. Normalizar trim; validar no vacío. |
| `descripcion` | Opcional, varchar(255). |

No se asignan permisos en el Dialog de alta: el rol nace **sin** filas en
`auth.rol_permiso`. Tras el `201`, seleccionar el rol nuevo en el hub y mapear permisos
en la matriz.

### Validaciones / errores

- Nombre vacío → 422 / validación de form (borde `border-destructive`, foco al primer
  error — mismo patrón que Usuarios/Clientes).
- Nombre duplicado → `409` con código de negocio claro (ej. `ROL_NOMBRE_DUPLICADO`).
- Intentar crear `ADMIN` (cualquier casing) → `400` / `409` `ROL_RESERVADO` (el rol de
  sistema no se recrea desde la UI).

### Post-alta

- Toast / mensaje de éxito breve.
- Cerrar Dialog.
- Refrescar lista de roles.
- Navegar a `/admin/roles/{nuevo_id}` y dejar la matriz lista para editar (si tiene
  `roles:editar`).

---

## 8. Guardado de mapeo de permisos

Permiso: `roles:editar`.

### Comportamiento

1. El frontend envía el **set completo** de `permiso_id` deseados para el rol (reemplazo
   total de la matriz), no diffs parciales ambiguos.
2. Backend:
   - Rechaza si el rol es ADMIN → `403` / `400` `ROL_ADMIN_INMUTABLE`.
   - Rechaza ids de permiso inexistentes → `404` / `400`.
   - Rechaza incluir el permiso `*` en el set de un rol no-ADMIN → `400`
     `COMODIN_NO_PERMITIDO` (el comodín no se asigna manualmente a roles operativos).
   - Sincroniza `auth.rol_permiso` (borrar los que sobran, insertar los faltantes) en una
     transacción.
   - Incrementa `version_token` en **todos** los `auth.usuario` con ese `rol_id`
     (invalidación de sesiones — `rbac-security.mdc`).
3. Respuesta `200` con el detalle del rol actualizado (id, nombre, descripcion, permisos).

### UX

- Botón Guardar deshabilitado si no hay cambios locales.
- Loading en el botón mientras persiste.
- Toast de éxito; en error, mensaje recuperable sin perder los checks locales si es
  posible.

---

## 9. Contrato de API

Base: `/api/...` (sin `/v1`). Tipado estricto Pydantic; OpenAPI como fuente de tipos TS.

### Compatibilidad con el listado liviano actual

Hoy existe:

- `GET /api/roles` → `[{ id, nombre }]` autorizado con `usuarios:ver` **o** `usuarios:crear`
  (combo de Admin → Usuarios).

**Mantener** ese endpoint para el combo de usuarios. Ampliaciones de esta spec:

1. Autorizar también con `roles:ver` (OR con los permisos de usuarios ya existentes), para
   que la pantalla de roles pueda reutilizarlo si hace falta.
2. Agregar endpoints de detalle / alta / mapeo debajo (no romper el shape del listado
   liviano).

### Endpoints nuevos / ampliados

| Método | Ruta | Permiso | Uso |
|--------|------|---------|-----|
| GET | `/api/roles` | `usuarios:ver` \| `usuarios:crear` \| `roles:ver` | Listado liviano `{id, nombre}` (combo + nav) |
| GET | `/api/roles/{id}` | `roles:ver` | Detalle: rol + permisos asignados |
| POST | `/api/roles` | `roles:crear` | Alta de rol |
| PUT | `/api/roles/{id}/permisos` | `roles:editar` | Reemplazo total de la matriz |
| GET | `/api/permisos` | `roles:ver` | Catálogo completo de permisos (solo lectura) |

#### `GET /api/roles/{id}` — response ejemplo

```json
{
  "id": 3,
  "nombre": "CLIENTE",
  "descripcion": "Acceso portal cliente",
  "es_admin": false,
  "acceso_total": false,
  "permisos": [
    { "id": 10, "nombre": "mascotas:ver_listado", "descripcion": "…" },
    { "id": 14, "nombre": "clientes:ver_listado", "descripcion": "…" }
  ]
}
```

- `es_admin`: `true` si `nombre` casefold == `admin`.
- `acceso_total`: `true` si el rol tiene el permiso `*` **o** `es_admin` (la UI de ADMIN
  usa esto para el indicador de acceso total).

#### `POST /api/roles` — body

```json
{
  "nombre": "CEO",
  "descripcion": "Dirección"
}
```

Response `201`: mismo shape de detalle con `permisos: []`.

#### `PUT /api/roles/{id}/permisos` — body

```json
{
  "permiso_ids": [10, 11, 14]
}
```

Response `200`: detalle actualizado.

#### `GET /api/permisos` — response ejemplo

```json
[
  {
    "id": 10,
    "nombre": "mascotas:ver_listado",
    "descripcion": "Permite ver el listado general de mascotas"
  }
]
```

Incluir `*` en el catálogo API está bien (el frontend lo excluye de checks editables).

### Errores controlados

| HTTP | Código sugerido | Cuándo |
|------|-----------------|--------|
| 401 | (sesión) | Sin cookie / token inválido |
| 403 | `PERMISOS_INSUFICIENTES` | Sin permiso de la acción |
| 403/400 | `ROL_ADMIN_INMUTABLE` | Mutación sobre ADMIN |
| 400 | `COMODIN_NO_PERMITIDO` | Intento de asignar `*` a rol no-ADMIN |
| 400/409 | `ROL_RESERVADO` | Alta con nombre ADMIN |
| 409 | `ROL_NOMBRE_DUPLICADO` | Unique de `auth.rol.nombre` |
| 404 | `ROL_NO_ENCONTRADO` / `PERMISO_NO_ENCONTRADO` | Id inexistente |
| 422 | validación | Body inválido |

---

## 10. Frontend — estructura sugerida

- Ruta en `App.tsx`:
  - `admin/roles` → página hub.
  - `admin/roles/:id` → misma página (leer param).
- Página: `frontend/src/pages/admin/roles-page.tsx` (y test
  `roles-page.test.tsx` con el mismo estilo que otras pages Admin).
- Tipos TS a mano reflejando schemas Pydantic, con
  `// TODO: reemplazar por tipo generado desde OpenAPI`.
- Reutilizar: Table/lista, Dialog, Checkbox, Badge, Button, Input, AccessDenied,
  tooltips — mismos componentes Shadcn que Usuarios/Catálogos.
- El `Link` existente en Usuarios hacia `/admin/roles/${rol_id}` debe quedar funcional
  (destino implementado).

---

## 11. Backend — estructura sugerida

- Extender `backend/app/api/roles.py` + `rol_service.py` + `schemas/roles.py`.
- Nuevo router liviano `permisos` (o endpoints bajo el mismo tag) para
  `GET /api/permisos`.
- Models SQLModel ya existentes (`Rol`, `Permiso`, `RolPermiso`): solo DML.
- Al sincronizar permisos: transacción + bumpeo de `version_token` de usuarios afectados.
- Enforcement real en backend (UI solo UX).

---

## 12. Tests (obligatorios)

### Backend (Pytest + TestClient + DB de pruebas)

1. `GET /api/roles` sin auth → 401.
2. `GET /api/roles/{id}` / `GET /api/permisos` sin `roles:ver` → 403.
3. `GET` con `roles:ver` → 200 y shape correcto.
4. `POST /api/roles` sin `roles:crear` → 403; con permiso → 201; duplicado → 409;
   nombre `ADMIN` → error de reservado.
5. `PUT /api/roles/{id}/permisos` sin `roles:editar` → 403.
6. `PUT` sobre rol no-ADMIN sincroniza `rol_permiso` y bumpea `version_token` de usuarios
   con ese rol.
7. `PUT` sobre ADMIN → `ROL_ADMIN_INMUTABLE`.
8. `PUT` incluyendo permiso `*` en rol no-ADMIN → `COMODIN_NO_PERMITIDO`.
9. Mantener tests existentes del combo `GET /api/roles` con `usuarios:ver` /
   `usuarios:crear`.

### Frontend (Vitest)

- AccessDenied sin `roles:ver`.
- `+ Nuevo Rol` no renderiza sin `roles:crear`.
- Matriz / Guardar no editables en rol ADMIN.
- (Smoke) deep-link `:id` selecciona el rol.

No testear estilos Tailwind ni que React Router “funcione”.

---

## 13. Criterios de aceptación (checklist)

1. Sidebar Admin muestra **Roles y Permisos** solo con `roles:ver` o `*`.
2. Existen rutas `/admin/roles` y `/admin/roles/:id` en el SPA.
3. Hub con nav de roles (Select en mobile) + matriz agrupada por dominio.
4. Se pueden **crear** roles nuevos (Dialog) sin crear permisos nuevos.
5. Se puede **asignar/quitar** permisos de un rol no-ADMIN y persistir en
   `auth.rol_permiso`.
6. Rol ADMIN es **solo lectura**; UI muestra acceso total / catálogo checked+disabled.
7. No hay UI ni API de alta de permisos nuevos.
8. Mutar permisos de un rol invalida sesiones vía `version_token` de usuarios afectados.
9. Deep-link desde Usuarios (`/admin/roles/:id`) abre el rol correcto.
10. Tests de API cubren 401/403/201/200 y reglas ADMIN / comodín.
11. Sin DDL desde la app; permiso `*` documentado como dato DBA si falta.

---

## 14. Decisiones cerradas

1. **Alcance v1:** crear roles + mapear permisos; no CRUD de permisos; no eliminar roles;
   no editar nombre/descripcion de roles existentes.
2. **Layout:** hub tipo Catálogos (nav roles + matriz), no form largo tipo Usuarios.
3. **ADMIN:** inmutable; detección por `nombre` case-insensitive `ADMIN`; UI opción 1
   (lista checked + disabled + badge acceso total).
4. **Comodín `*`:** no asignable manualmente a roles operativos; exclusivo del modelo de
   acceso total / ADMIN.
5. **Alta de rol:** sin permisos iniciales; el mapeo se hace después en la matriz.
6. **API de mapeo:** `PUT` con set completo de `permiso_ids` (reemplazo total).
7. **`GET /api/roles` liviano:** se mantiene para Usuarios; se amplía el OR de permisos con
   `roles:ver`.
8. **Invalidación:** bumpeo de `version_token` en todos los usuarios del rol al guardar
   la matriz.

---

## 15. Fuera de alcance / mejoras posteriores

- Eliminar roles (`roles:eliminar`) y políticas (¿qué pasa si hay usuarios asignados?).
- Editar nombre/descripcion de un rol.
- UI para gestionar el catálogo de permisos (alta de `recurso:accion` nuevos).
- Historial / auditoría de cambios de matriz de permisos.
- Clonar rol (“duplicar permisos de X”).
- Wildcards parciales tipo `mascotas:*` (el motor actual solo entiende `*` total o match
  exacto).
