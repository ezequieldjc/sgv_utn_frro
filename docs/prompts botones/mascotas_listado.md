# Especificación: Mascotas y Clientes → Listado de Mascotas (`/mascotas`)

Actuá como Senior Full-Stack (FastAPI + SQLModel, React + Vite + Shadcn) y respetá:
`.cursor/rules/home.mdc`, `tech-stack.mdc`, `database-types.mdc`, `rbac-security.mdc`,
`ui-layout.mdc`.

Replicá el patrón UX/permisos de **Listado de Clientes** / **Usuarios** (página de listado +
página de alta, validación manual, Dialog/errores inline; **sin** Sheet/RHF/Zod/toasts).

Estado: **implementado** (no reimplementar desde cero; esta spec describe el as-built).

---

## 0. Mapa de archivos (ya existen)

| Capa | Archivo |
|------|---------|
| API | `backend/app/api/mascotas.py` |
| Service | `backend/app/services/mascota_service.py` |
| Schemas | `backend/app/schemas/mascotas.py` |
| Router | registrado en `backend/app/main.py` |
| Tests API | `backend/tests/test_mascotas.py` |
| Listado UI | `frontend/src/pages/mascotas/mascotas-page.tsx` |
| Alta UI | `frontend/src/pages/mascotas/mascota-form-page.tsx` |
| Tests form | `frontend/src/pages/mascotas/mascota-form-page.test.tsx` |
| Types | `frontend/src/types/mascotas.ts` |
| Typeahead selects | `frontend/src/lib/select-typeahead.ts` + `frontend/src/hooks/use-select-typeahead.ts` |
| Tests typeahead | `frontend/src/lib/select-typeahead.test.ts` |
| Rutas | `frontend/src/App.tsx` → `/mascotas`, `/mascotas/nuevo` (stub removido) |
| Seed raza default | `scripts/base/raza_sin_raza_definida.sql` (DBA ya ejecutado) |
| **Sesión DB** | `backend/app/db/session.py` → `get_session` **debe** ser generator `yield` + close |

---

## 1. Objetivo

- Pantalla **Listado de Mascotas** desde Sidebar → Mascotas y Clientes → Listado de Mascotas.
- Flujo de **alta rápida** (recepción) desde el botón del listado.
- Entrada opcional desde clientes: `/mascotas?cliente_id={id}` (filtra listado y preselecciona tutor en alta).

---

## 2. Permisos (RBAC) — nomenclatura del seed

| Acción | Permiso |
|--------|---------|
| Ver listado `/mascotas` | `mascotas:ver_listado` o `*` |
| Botón / alta Nueva Mascota | `mascotas:crear` o `*` |
| Botón Editar (UI stub) | `mascotas:editar` o `*` |

No usar `mascotas:create` / `mascotas:update`.

---

## 3. Listado — UI (as-built)

### Rutas
| Ruta | Descripción |
|------|-------------|
| `/mascotas` | Listado paginado |
| `/mascotas/nuevo` | Alta rápida (página, como `/clientes/nuevo`) |
| `/mascotas?cliente_id={id}` | Listado filtrado por tutor; el alta puede preseleccionar ese tutor |

### Layout de controles (fila única)
En **una misma fila horizontal** (responsive: stack en mobile):

1. Buscador
2. Tres filtros **mismo ancho** (`grid sm:grid-cols-3`)
3. Botón **+ Nueva Mascota** (NO va en el header del título)

### Defaults de filtros
| Filtro | Default UI | Notas |
|--------|------------|--------|
| Especie | **Canina** (match `/^canin[oa]$/i` sobre `clinica.especie.nombre`) | Si no hay `especie_id` en URL, aplicar default al cargar catálogo. Opción “Todas las especies” disponible. |
| Raza | Todas las razas | Depende de especie; se limpia al cambiar especie |
| Estado | **ACTIVA** (`mascota_estado_id = 1`) | Primera opción del select: **“Todos los estados”** (`value=""`). Default seleccionado sigue siendo ACTIVA. |

### Typeahead por teclado en selects
- Con el `<select>` enfocado (Tab), tipiar una letra salta a la **primera opción cuyo label empiece con esa letra** (sin abrir el menú).
- Misma letra repetida → cicla coincidencias.
- Buffer multi-carácter (ej. `si` → Siames) con reset ~700 ms.
- Ignora acentos al comparar (`normalize NFD`).
- Prioriza opciones con `value !== ""` sobre placeholders (“Todas…”, “Seleccionar…”).
- Implementación: `useSelectTypeahead` en listado y en alta (especie/raza/sexo/estado).

### Tabla
Nombre, Especie, Raza, Tutor, DNI Tutor, Acciones.

### Editar
Solo UI → `console.log("TODO: Editar")` si tiene `mascotas:editar`. Sin pantalla de edición.

### Paginación
- `page_size = 50` (fijo en v1).
- Response: `items`, `total`, `page`, `page_size`.
- Sync de filtros a querystring (`q`, `especie_id`, `raza_id`, `mascota_estado_id`, `cliente_id`, `page`).

AccessDenied si falta `mascotas:ver_listado` (mismo patrón visual que clientes).

---

## 4. Alta rápida — UI (`/mascotas/nuevo`)

### Obligatorios
- **Tutor:** búsqueda por DNI o nombre (**solo** `es_cliente = true`). Checkbox
  **“Mascota sin tutor registrado (Tutor Eventual)”**: deshabilita selector y usa persona
  comodín de config.
- **Nombre**
- **Especie** (`clinica.especie`)
- **Raza** (dependiente de especie). Default: nombre de
  `sys.config.parametro_nombre = 'RAZA_NOMBRE_DEFAULT'` → valor `Sin raza definida`
  (una fila por especie; script `scripts/base/raza_sin_raza_definida.sql`).

### Opcionales
- Sexo: `M` / `H` / `U`
- **Fecha de nacimiento** (opcional), con dos modos de carga:
  1. **Default — Mes/Año:** `input type="month"` (`YYYY-MM`). Al submit el front
     agrega día **01** → `YYYY-MM-01`.
  2. **Día exacto:** Checkbox *“Conozco el día exacto de nacimiento”* → `input type="date"`
     (`YYYY-MM-DD`) y se envía tal cual.
  - Sin RHF/Zod (validación manual del módulo). No hay Calendar shadcn instalado; se usan
    inputs nativos month/date.
  - Backend: `MascotaCreate.fecha_nacimiento: date | None` (sin cambio de modelo/BD).
- Peso inicial (kg, decimal)
- Microchip
- Alertas médicas

### Búsqueda de tutor (comportamiento cerrado)
- Debounce ~400 ms; mínimo 2 caracteres.
- Endpoint: `GET /api/mascotas/tutores?q=`.
- Match por `nombre`, `apellido`, `dni` (ILIKE) y DNI sin formato (quita `.`, `-`, espacios)
  para que `40111222` encuentre `40.111.222`.
- **No aparecen usuarios del sistema** (`es_cliente = false`). Si buscás “Ezequiel” y es el
  admin, no hay resultado: es correcto.
- UI debe mostrar:
  - “Buscando…”
  - Error de API (no silenciar)
  - Sin resultados: mensaje *“No hay clientes con ese DNI o nombre. Solo aparecen personas
    registradas como cliente (no usuarios del sistema).”*
- **Layout del mensaje:** el texto hace wrap (`break-words` / varias líneas). El formulario
  tiene `max-w-3xl` + `min-w-0` para que el mensaje **no ensanche** ni “baile” el ancho
  al aparecer/desaparecer.

### Preselección tutor
- `?cliente_id=` → `GET /api/mascotas/tutores/{persona_id}`.

Cancelar → `navigate(-1)` o `/mascotas`.  
Éxito → Dialog + volver al listado (patrón clientes).  
Validación: `validateForm` / `buildMascotaPayload` exportados (tests Vitest).

---

## 5. API (as-built)

### `GET /api/mascotas`
Permiso: `mascotas:ver_listado`.

Query params:
- `q` (opcional): nombre mascota ILIKE / dni tutor / microchip
- `especie_id`, `raza_id` (opcionales)
- `mascota_estado_id` (opcional): **si falta → no filtra por estado (todos)**.
  La UI es quien manda `1` por default.
- `cliente_id` (opcional): filtra por tutor
- `page` (default 1), `page_size` (default 50)

### `POST /api/mascotas`
Permiso: `mascotas:crear`. Body `MascotaCreate`:

```json
{
  "persona_id": 12,
  "tutor_eventual": false,
  "nombre": "Firulais",
  "especie_id": 1,
  "raza_id": 101,
  "sexo": "M",
  "fecha_nacimiento": "2020-01-15",
  "peso_inicial_kg": 12.5,
  "microchip": null,
  "alertas_medicas": null
}
```

Reglas:
1. Si `tutor_eventual = true` (o sin `persona_id`): leer
   `sys.config` `PERSONA_ID_TUTOR_EVENTUAL` y usar ese `persona_id`. Si falta config/persona →
   error controlado.
2. Validar que `raza_id` pertenece a `especie_id`.
3. Setear **siempre** `mascota_estado_id = 1` (ACTIVA). No pedirlo al cliente.
4. **No** setear `ultimo_peso` en el INSERT de mascota (lo actualiza el trigger).
5. Si viene `peso_inicial_kg`: luego del insert de mascota, `INSERT` en
   `clinica.historial_peso` (`mascota_id`, `fecha = NOW()`, `peso_kg`).
6. Campos opcionales del form → columnas nullable de `clinica.mascota`.

### Auxiliares
| Método | Permiso | Uso |
|--------|---------|-----|
| `GET /api/mascotas/especies` | `ver_listado` | Filtros / alta |
| `GET /api/mascotas/razas?especie_id=` | `ver_listado` | Filtros / alta |
| `GET /api/mascotas/estados` | `ver_listado` | Filtro estado |
| `GET /api/mascotas/tutores?q=` | `crear` | Autocomplete tutor |
| `GET /api/mascotas/tutores/{persona_id}` | `crear` | Preselect `cliente_id` |
| `GET /api/mascotas/config/raza-default` | `crear` | Nombre raza default |

---

## 6. Datos / config (DBA — ya aplicados)

| Concepto | Valor |
|----------|--------|
| Estado ACTIVA | `catalogo.mascota_estado.id = 1` (nombre suele ser `ACTIVA`) |
| Especie default UI | Nombre en seed: **Canina** (`scripts/base/especies.sql`) |
| Tutor eventual | `sys.config` `PERSONA_ID_TUTOR_EVENTUAL` |
| Raza default | `Sin raza definida` por especie + `RAZA_NOMBRE_DEFAULT` |
| Script seed razas | `scripts/base/raza_sin_raza_definida.sql` |

---

## 7. Decisiones cerradas

1. Permisos: `ver_listado` / `crear` / `editar` (seed actual).
2. Tutor eventual y ACTIVA (`id=1`) ya en BD.
3. Default raza: `Sin raza definida` por especie + `RAZA_NOMBRE_DEFAULT`.
4. Búsqueda de tutor: **solo** clientes (`es_cliente=true`).
5. `cliente_id` en query filtra listado y preselecciona en alta.
6. Alta en **página** `/mascotas/nuevo` (no Sheet).
7. Errores/éxito: Dialog / mensajes inline (como clientes), no toasts.
8. Validación manual (como clientes), sin RHF/Zod obligatorio.
9. Paginación 50; UI default estado ACTIVA + especie Canina; “Todos los estados” como primera opción.
10. Ignorar `alcance_iteracion_uno.md` para este módulo.
11. Botón Nueva Mascota en la misma fila que buscador/filtros; filtros mismo ancho.
12. Typeahead por teclado en selects (ver §3).
14. Fecha de nacimiento: default mes/año → día 1; toggle “conozco el día exacto” → date
    completo. Backend ya recibe `date`.

---

## 8. Pitfalls resueltos (NO reintroducir)

### 8.1 Leak de sesiones → API congelada
**Problema:** `get_session()` devolvía `Session(...)` sin cerrar → el pool de Postgres se agotaba;
al buscar tutores (muchos requests) el resto de la API se trababa (ej. select de Especie).

**Fix obligatorio** en `backend/app/db/session.py`:

```python
def get_session() -> Generator[Session, None, None]:
    with Session(get_engine()) as session:
        yield session
```

Nunca volver a `return Session(get_engine())` sin `yield`/`close`.

### 8.2 Búsqueda de tutor “vacía” / silenciosa
- No tragar errores HTTP en el front: mostrar mensaje.
- DNI con puntos vs dígitos: normalizar en service.
- Usuarios admin no son tutores: filtrar `es_cliente=true` (esperado).

### 8.3 Estado en API
- Backend: sin `mascota_estado_id` → **todos** los estados.
- Frontend: default `1` (ACTIVA). No volver a forzar ACTIVA en el service cuando el param es `None`.

---

## 9. Criterios de aceptación

1. Sidebar → Listado de Mascotas con `mascotas:ver_listado`.
2. Listado paginado (50); default especie Canina + estado ACTIVA; “Todos los estados” disponible;
   filtros mismo ancho; Nueva Mascota en la misma fila; typeahead por letra en selects.
3. `?cliente_id=` filtra por tutor.
4. Alta con tutor o tutor eventual; raza default “Sin raza definida”; estado ACTIVA interno.
5. Peso inicial genera fila en `historial_peso` sin tocar `ultimo_peso` en el insert.
6. Editar visible solo con `mascotas:editar`, stub TODO.
7. Búsqueda tutor: encuentra por nombre/DNI (con/sin formato); no ensancha el form con el
   mensaje vacío; no congela la API (sesiones cerradas).
8. Tests backend (`test_mascotas.py`): 401/403, listado/filtros, create tutor / eventual / peso,
   raza inválida, tutores por DNI, exclusión no-clientes, get tutor 404.
9. Tests frontend: validación/payload alta; typeahead (`select-typeahead.test.ts`).

---

## 10. Qué NO hacer (si otra IA retoma esto)

- No recrear el módulo ni el stub `MascotasStubPage`.
- No inventar DDL ni correr Alembic contra la app (DBA-first).
- No cambiar permisos a `create`/`update`.
- No usar Sheet/RHF/Zod/toasts para este flujo.
- No “arreglar” la búsqueda incluyendo usuarios `es_cliente=false` salvo pedido explícito.
- No reabrir `get_session` sin `yield` (rompe producción bajo carga de autocomplete).
