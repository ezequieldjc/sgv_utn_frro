# Especificación de Pantalla: Admin -> Catálogos (`/admin/catalogos`)

Gestión administrativa de las tablas paramétricas del schema `catalogo` (y lectura de
`clinica.especie` solo como referencia para filtros/combos).

Seguí los patrones de layout, permisos y tablas ya usados en `admin_usuarios.md` /
`clientes_listado.md` (header + barra de controles + tabla Shadcn + AccessDenied).

Estado: **implementado** (primera iteración). Ajustes de UX posteriores se documentan acá
antes de codear.

---

## 1. Objetivo

Permitir a usuarios autorizados:

- Ver el contenido de cada tabla de `catalogo`.
- Crear registros.
- Editar registros.
- Dar **baja lógica** (y reactivar) sin borrar filas físicas.

Caso típico: agregar un hábitat asociado a la especie “Canino”, ver en el listado a qué
especie pertenece, filtrar por especie, editar nombre/descripción, inactivar un valor
obsoleto.

---

## 2. Tablas en alcance

| Clave UI (slug) | Tabla Postgres | ¿Depende de especie? | Notas |
|-----------------|----------------|----------------------|-------|
| `estado-reproductivo` | `catalogo.estado_reproductivo` | Sí (`especie_id`) | |
| `habitat` | `catalogo.habitat` | Sí (`especie_id`) | |
| `tamanio` | `catalogo.tamanio` | Sí (`especie_id`) | |
| `pelaje` | `catalogo.pelaje` | Sí (`especie_id`) | |
| `temperamento` | `catalogo.temperamento` | Sí (`especie_id`) | |
| `mascota-estado` | `catalogo.mascota_estado` | **No** (global) | Estado operativo de mascota |

Fuera de alcance de esta pantalla (por ahora):

- CRUD de `clinica.especie` / `clinica.raza` (solo se **leen** especies para filtros y selects).
- Cualquier tabla de `clinica` que no sea catálogo paramétrico.

---

## 3. Prerrequisito de datos (DBA)

Para soportar **baja lógica** de forma uniforme, ejecutar el script:

`scripts/base/catalogo_add_activo.sql`

(equivale a `ADD COLUMN activo boolean NOT NULL DEFAULT true` en las 6 tablas de
`catalogo` listadas arriba).

Opcional recomendado: FK formal de `especie_id` → `clinica.especie(id)` donde aún no exista.

El diccionario canónico ya documenta `activo` en `docs/modelo_datos_v1.md` (módulo Catalogo).

---

## 4. Permisos (RBAC)

Convención `recurso:accion`. Wildcard `*` implica todos.

| Permiso | Uso |
|---------|-----|
| `catalogos:ver` | Ver pantalla `/admin/catalogos`, listar registros, ver detalle/readonly |
| `catalogos:crear` | Botón “+ Nuevo” y alta |
| `catalogos:editar` | Editar campos; también **reactivar** (`activo=true`) |
| `catalogos:eliminar` | Baja lógica (`activo=false`) |

### Seed propuesto (DBA / `scripts/rol_permiso.sql`)

```sql
INSERT INTO auth.permiso (nombre, descripcion) VALUES
('catalogos:ver', 'Permite consultar catálogos paramétricos (schema catalogo)'),
('catalogos:crear', 'Permite crear registros en catálogos paramétricos'),
('catalogos:editar', 'Permite modificar registros de catálogos paramétricos'),
('catalogos:eliminar', 'Permite dar de baja lógica registros de catálogos')
ON CONFLICT (nombre) DO NOTHING;
```

La asignación a roles (ej. ADMIN) vive en `auth.rol_permiso`; no hardcodear en frontend.

### Reglas de UI por permiso

- Sin `catalogos:ver` (ni `*`): AccessDenied (mismo patrón visual que Usuarios/Clientes).
- `+ Nuevo …`: solo con `catalogos:crear`.
- Acción Editar: solo con `catalogos:editar`.
- Acción “Dar de baja”: solo con `catalogos:eliminar` y si `activo=true`.
- Acción “Reactivar”: solo con `catalogos:editar` y si `activo=false`.

---

## 5. Rutas

| Ruta | Descripción |
|------|-------------|
| `/admin/catalogos` | Hub + listado del catálogo seleccionado |
| `/admin/catalogos?tipo=<slug>` | Mismo hub con catálogo preseleccionado (deep-link) |

No hace falta una ruta por tabla al inicio. Alta/edición se resuelven con **Dialog** (modal)
sobre el listado, para mantener una sola pantalla admin (como muchas ABM de parámetros).

Opcional futuro (fuera de esta spec): `/admin/catalogos/:tipo/nuevo` si el form crece.

Sidebar: ítem **Catálogos** bajo Admin → `/admin/catalogos` con permiso `catalogos:ver`
(ver `docs/sidebar.md`).

---

## 6. Layout propuesto (importante)

### Idea general: hub de un solo lugar + “selector de catálogo”

Una sola pantalla con dos zonas claras:

```
┌─────────────────────────────────────────────────────────────┐
│  Admin / Catálogos                                          │
│  Parámetros clínicos usados en altas de mascota, etc.       │
├──────────────┬──────────────────────────────────────────────┤
│ Catálogos    │  [Buscar] [Estado] [Especie?]  [+ Nuevo Xxx] │  ← misma línea base
│ (nav)        ├──────────────────────────────────────────────┤
│ • Hábitats   │  Tabla de registros                          │
│ • Tamaños    │                                              │
│ • Pelajes    │                                              │
│ • …          │                                              │
│ • Estados    │                                              │
│   mascota    │                                              │
└──────────────┴──────────────────────────────────────────────┘
```

**Alineación (desktop):** el tope del contenedor del nav (Hábitats, Tamaños, …) y el tope
de la barra de controles (buscador + filtro de estado + especie + `+ Nuevo`) deben coincidir
en la misma línea base. El nav ocupa la columna izquierda a lo alto (span sobre controles +
tabla); no debe “flotar” más arriba ni más abajo que esa barra.

Cuidado de implementación: no usar `space-y-*` en un wrapper que también contenga el
`Select` mobile (`lg:hidden`). El margen de `space-y` se aplica al hermano siguiente aunque
el mobile esté oculto y baja la barra de filtros respecto al nav.

### A. Nav vertical de tipos (decidido)

**Desktop:** nav vertical a la izquierda con los catálogos actuales.

**Mobile:** `Select` arriba (“Catálogo: Hábitat ▾”) — el nav vertical no escala bien en
pantallas chicas.

**Si mañana hay muchos catálogos** (escala del nav):

1. Mantener nav vertical (no pasar a un mega-menú plano sin estructura).
2. Agregar **buscador dentro del nav** (“Filtrar catálogos…”).
3. Opcional: **agrupar** por dominio (ej. “Atributos de mascota”, “Estados”, etc.).
4. Si supera ~15–20 ítems, considerar subrutas `/admin/catalogos/:grupo` o un segundo nivel
   colapsable — sin abandonar el patrón de hub + listado.

Al elegir un ítem del nav:

1. Se actualiza el query `?tipo=<slug>`.
2. Se recarga el listado de esa tabla.
3. Cambian columnas según si es “por especie” o “global”.
4. **Se conservan** los filtros de Estado y Especie; se limpia el buscador de nombre.

### B. Zona de listado (derecha)

#### Controles superiores (siempre)

1. **Buscador** (`Input` + `Search`): filtra por `nombre` (y opcionalmente `descripcion`) en
   frontend o con query param `q` en API.
2. **Select de estado** (`activo`):
   - `Activos` (default)
   - `Inactivos`
   - `Todos`
   - **Color semántico (igual que badges de la tabla / Admin → Usuarios):**
     - `Activos` → verde
     - `Inactivos` → rojo / destructive
     - `Todos` → color neutro (sin semántica de estado)
   - El control **cerrado** refleja el color del valor seleccionado (lectura rápida).
   - Si el browser permite, colorear también las opciones del desplegable; si no (limitación
     de `<select>` nativo), alcanza con el trigger coloreado. Si más adelante se usa
     Shadcn `Select`, colorear `SelectItem` de Activos/Inactivos.
3. **Botón `+ Nuevo`** (permiso `catalogos:crear`), label dinámico con **sustantivo en
   mayúscula inicial**:
   - ej. `+ Nuevo Hábitat`, `+ Nuevo Tamaño`, `+ Nuevo Estado reproductivo`, …

#### Controles extra solo si el catálogo depende de especie

4. **Filtro `Especie`** (`Select`):
   - Opción “Todas las especies” (default).
   - Opciones = **todas** las filas de `clinica.especie` (activas e inactivas), **ordenadas
     por `id` ascendente** (las más frecuentes suelen tener id más bajo). En el label se
     puede indicar visualmente si está inactiva (ej. `Canino (inactiva)`), pero **no** se
     ocultan.
   - Al cambiar de catálogo en el nav (ej. Hábitats → Tamaños), **se conservan** el filtro
     de especie y el de estado (Activos/Inactivos/Todos). Solo se limpia el buscador de
     nombre (y el filtro de especie se oculta —sin resetearse— en catálogos globales).
5. La tabla **debe mostrar la columna Especie** (nombre de `clinica.especie`, no el id).

Así el usuario ve de un vistazo: `Interior | Canino | Activo`.

#### Columnas de tabla

**Catálogos con especie** (`habitat`, `tamanio`, `pelaje`, `temperamento`,
`estado_reproductivo`):

| Columna | Origen |
|---------|--------|
| Nombre | `catalogo.*.nombre` |
| Especie | join / embed `especie.nombre` (o `-` si `especie_id` null) |
| Descripción | `descripcion` (truncar con tooltip si es larga) |
| Estado | Badge Activo / Inactivo según `activo` (**mismos colores que Admin → Usuarios**) |
| Acciones | Editar / Baja o Reactivar |

**Catálogo global** (`mascota_estado`):

| Columna | Origen |
|---------|--------|
| Nombre | `nombre` |
| Descripción | `descripcion` |
| Estado | Badge Activo / Inactivo (**mismos colores que Admin → Usuarios**) |
| Acciones | Editar / Baja o Reactivar |

Sin columna Especie ni filtro de especie.

#### Badges de Estado (paridad con Usuarios)

Misma semántica visual que la columna Habilitado/Estado en `admin/usuarios`:

- **Activo:** badge verde (`bg-green-100 text-green-800`, variante dark equivalente).
- **Inactivo:** badge rojo/destructive (`bg-destructive/10 text-destructive`).

No usar `variant="default"` / `secondary` genéricos que no transmitan verde/rojo.

#### Ordenamiento

Click en encabezados: Nombre, Especie (si aplica), Estado. Indicador visual de dirección
(mismo patrón que Usuarios).

#### Empty / loading / error

- Loading: skeleton de tabla.
- Vacío: “No hay registros para este catálogo con los filtros actuales.”
- Error recuperable: bloque visual consistente con Usuarios.

---

## 7. Alta / edición (Dialog)

### Campos comunes

- `nombre` (obligatorio, varchar 50)
- `descripcion` (opcional, varchar 255)
- `activo` en alta: default `true` (no hace falta mostrarlo en el alta; en edición puede
  mostrarse o gestionarse solo con las acciones de baja/reactivación)

### Campo extra si el catálogo es por especie

- `especie_id` (**obligatorio en el formulario** de alta/edición): `Select` con **todas**
  las especies (activas e inactivas; marcar inactivas en el label).

**Aclaración (decisión cerrada):** “obligatorio” no significa que la columna en Postgres sea
`NOT NULL` hoy. Significa que **en esta pantalla**, al crear o editar un hábitat/tamaño/etc.,
el usuario **debe elegir una especie**. No se permite guardar un registro “huérfano” sin
especie desde Admin Catálogos. `mascota_estado` no tiene este campo.

Validaciones:

- Nombre no vacío.
- Si es por especie: especie seleccionada (requerida).
- Backend: 409 o 400 si hay unique de negocio que el DBA defina (ej. mismo nombre + misma
  especie); documentar cuando exista constraint.

### Baja lógica

- Confirmación con Dialog: “¿Dar de baja «{nombre}»?”
- `PATCH`/`PUT` con `activo=false` (o endpoint dedicado). **No** `DELETE` físico.
- Reactivar: confirmación breve → `activo=true`.

Regla de producto: un registro inactivo **no** debe aparecer en combos de alta de mascota
(futuro); en Admin Catálogos sí se puede ver con el filtro “Inactivos” / “Todos”.

---

## 8. Contrato de API (decidido — REST por recurso)

Estándar profesional: **un recurso HTTP por tabla de catálogo**, schemas Pydantic
explícitos y OpenAPI claro. La duplicación se evita en la **capa de servicio** (helper
genérico / base), no escondiendo todo detrás de un único `/{tipo}` opaco.

Base: `/api/catalogos/...` (sin `/v1`).

### Lectura de especies (solo para filtros/combos)

- `GET /api/catalogos/especies-opciones`  
  - Permiso: `catalogos:ver`  
  - Devuelve **todas** las especies: `{ id, nombre, activo }[]`, ordenadas por `id`
    ascendente.
  - No es CRUD de especies.

### Recursos por tabla

Para cada catálogo (ejemplo `habitat`; el resto es análogo):

| Método | Ruta | Permiso |
|--------|------|---------|
| GET | `/api/catalogos/habitats?q=&especie_id=&activo=true\|false\|all` | `catalogos:ver` |
| POST | `/api/catalogos/habitats` | `catalogos:crear` |
| PUT | `/api/catalogos/habitats/{id}` | `catalogos:editar` |
| PATCH | `/api/catalogos/habitats/{id}/activo` | baja: `catalogos:eliminar` / reactivar: `catalogos:editar` |

Misma forma para:

- `/api/catalogos/estados-reproductivos`
- `/api/catalogos/tamanios`
- `/api/catalogos/pelajes`
- `/api/catalogos/temperamentos`
- `/api/catalogos/mascota-estados` (sin query `especie_id`)

#### Response item (ejemplo hábitat)

```json
{
  "id": 1,
  "nombre": "Interior",
  "descripcion": null,
  "activo": true,
  "especie_id": 2,
  "especie_nombre": "Canino"
}
```

`mascota-estados`: sin `especie_id` / `especie_nombre`.

#### Body alta/edición (ejemplo hábitat)

```json
{
  "nombre": "Interior",
  "descripcion": null,
  "especie_id": 2
}
```

#### Body activo

```json
{ "activo": false }
```

Errores estándar: 401, 403, 404, 409 (si aplica), 422.

### Implementación backend (cuando se codee)

- Un router FastAPI por recurso **o** un factory que registre las 6 rutas con el mismo
  patrón (válido si el OpenAPI resultante sigue mostrando paths explícitos).
- Schemas Pydantic separados (o generados desde un base model + campos de especie).
- Service compartido para list/create/update/set_activo parametrizado por modelo SQLModel.
- Tests: al menos un catálogo con especie (ej. habitat) y el global (`mascota-estado`)
  cubriendo 401/403/201/200 y baja lógica.

---

## 9. Frontend — estructura sugerida (cuando se codee)

- Ruta en `App.tsx`: `admin/catalogos` → página dedicada
  (ej. `src/pages/admin/catalogos-page.tsx`).
- Sidebar: ítem Catálogos (`catalogos:ver`).
- Tipos TS a mano con `// TODO: reemplazar por tipo generado desde OpenAPI`.
- Reutilizar Table / Dialog / Badge / AccessDenied como en Usuarios.

---

## 10. Criterios de aceptación (checklist)

1. Sidebar Admin muestra **Catálogos** solo con `catalogos:ver` o `*`.
2. Existen (o están documentados para seed) los 4 permisos `catalogos:*`.
3. La pantalla permite elegir entre las 6 tablas de `catalogo` con **nav vertical** (Select en mobile).
4. En catálogos con `especie_id`, el listado muestra **nombre de especie** y se puede
   filtrar por especie (lista de especies = todas, activas e inactivas).
5. En `mascota_estado` no aparece filtro/columna de especie.
6. Alta/edición de catálogos por especie **exigen** `especie_id` en el form.
7. Baja es lógica vía `activo=false`; no hay delete físico en API.
8. Sin permiso de ver → AccessDenied; botones de mutación respetan crear/editar/eliminar.
9. Columna `activo` aplicada en BD (`scripts/base/catalogo_add_activo.sql`) y documentada.
10. API REST con paths explícitos por catálogo (no un único `/{tipo}` genérico como contrato público).

---

## 11. Decisiones cerradas

1. **`especie_id` en el form:** obligatorio al crear/editar catálogos que dependen de
   especie. No aplica a `mascota_estado`. (La BD puede seguir nullable por legado.)
2. **Nav:** vertical en desktop; Select en mobile; con plan de escala (buscador/grupos).
3. **API:** REST por recurso (`/habitats`, `/tamanios`, …) + capa service compartida.
4. **Especies en filtros/combos:** mostrar **todas** (activas e inactivas), sin ocultar;
   orden por `id` ascendente.
5. **Badges Estado:** verdes/rojos idénticos a Admin → Usuarios.
6. **Label `+ Nuevo`:** entidad con mayúscula inicial (`Nuevo Hábitat`, no `Nuevo hábitat`).
7. **Alineación desktop:** tope del nav de catálogos = tope de la barra de controles.
8. **Filtro Activos/Inactivos/Todos:** color semántico verde/rojo/neutro alineado a los
   badges (al menos en el control cerrado).
9. **Persistencia de filtros al cambiar de catálogo:** se mantienen Especie y Estado; se
   limpia solo el buscador de nombre.
10. **Chevron de selects de filtro:** flecha con padding derecho holgado (no pegada al borde).

## 12. Ajustes UX post-v1 (checklist)

- [x] Badges Estado = verdes/rojos como Usuarios.
- [x] `+ Nuevo Xxx` con mayúscula en la entidad.
- [x] Nav y barra de filtros alineados en la misma línea base (desktop).
- [x] Select de estado con color semántico según valor.
