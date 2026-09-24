# Especificación: Editar Mascota (`/mascotas/:id/editar`)

Actuá como Senior Full-Stack (FastAPI + SQLModel, React + Vite + Shadcn) y respetá:
`.cursor/rules/home.mdc`, `tech-stack.mdc`, `database-types.mdc`, `rbac-security.mdc`,
`ui-layout.mdc`.

Replicá el patrón UX del **alta de mascota** (página dedicada + validación manual + Dialog;
**sin** Sheet/RHF/Zod/toasts/React Query).

Estado: **implementado** (as-built; no reimplementar desde cero).

---

## 0. Mapa de archivos

| Capa | Archivo |
|------|---------|
| API | `backend/app/api/mascotas.py` — `GET`/`PATCH /{id}` + catálogos clínicos |
| Service | `backend/app/services/mascota_service.py` — `get_mascota`, `update_mascota` |
| Schemas | `backend/app/schemas/mascotas.py` — `MascotaDetail`, `MascotaUpdate`, `CatalogoClinicoOpcion` |
| Tests API | `backend/tests/test_mascotas.py` |
| Edit UI | `frontend/src/pages/mascotas/mascota-edit-page.tsx` |
| Tests form | `frontend/src/pages/mascotas/mascota-edit-page.test.tsx` |
| Listado link | `frontend/src/pages/mascotas/mascotas-page.tsx` — lápiz → `/mascotas/:id/editar` |
| Types | `frontend/src/types/mascotas.ts` |
| Rutas | `frontend/src/App.tsx` → `/mascotas/:id/editar` |

Depende del listado/alta ya existentes (`mascotas_listado.md`).

---

## 1. Objetivo

Editar una mascota existente desde el listado, precargando datos con `GET` y persistiendo con `PATCH`.

---

## 2. Permisos (RBAC)

| Acción | Permiso |
|--------|---------|
| Ver botón Editar en listado | `mascotas:editar` o `*` |
| `GET /api/mascotas/{id}` | `mascotas:editar` |
| `PATCH /api/mascotas/{id}` | `mascotas:editar` |
| Catálogos clínicos auxiliares bajo `/api/mascotas/catalogos/*` | `mascotas:editar` |

No usar `mascotas:update`.

---

## 3. Backend

### Endpoints

| Método | Ruta | Permiso |
|--------|------|---------|
| `GET` | `/api/mascotas/{id}` | `mascotas:editar` |
| `PATCH` | `/api/mascotas/{id}` | `mascotas:editar` |
| `GET` | `/api/mascotas/catalogos/pelajes?especie_id=` | `mascotas:editar` |
| `GET` | `/api/mascotas/catalogos/tamanios?especie_id=` | `mascotas:editar` |
| `GET` | `/api/mascotas/catalogos/habitats?especie_id=` | `mascotas:editar` |
| `GET` | `/api/mascotas/catalogos/estados-reproductivos?especie_id=` | `mascotas:editar` |
| `GET` | `/api/mascotas/catalogos/temperamentos?especie_id=` | `mascotas:editar` |

Reutilizados del alta: `GET /api/mascotas/estados`, `GET /api/mascotas/razas?especie_id=`, tutores.

### `MascotaDetail` (respuesta GET/PATCH)

IDs clínicos, tutor (nombre/apellido/dni), especie (vía raza), raza, estado, sexo, fecha_nacimiento, microchip, alertas. **Sin peso / `ultimo_peso`.**

### `MascotaUpdate` (PATCH body)

Opcionales: `nombre`, `persona_id`, `raza_id`, `mascota_estado_id`, `sexo`, `fecha_nacimiento`, `microchip`, `alertas_medicas`, `pelaje_id`, `tamanio_id`, `habitat_id`, `estado_reproductivo_id`, `temperamento_id`. Procesar con `exclude_unset=True`.

### Reglas de negocio

1. No se acepta cambio de especie (no hay campo `especie_id` en update).
2. `raza_id` debe pertenecer a la especie actual de la mascota.
3. Catálogos clínicos: activos y de esa especie.
4. `persona_id` debe ser cliente (`es_cliente=true`). Si el tutor actual **no** es el eventual de config (`PERSONA_ID_TUTOR_EVENTUAL`), rechazar setear el eventual → `400 TUTOR_EVENTUAL_NO_PERMITIDO`. Sí se puede cambiar a otro cliente real; si ya es eventual, sí se puede asignar cliente real.
5. Microchip duplicado → `409`. No tocar `ultimo_peso`.

---

## 4. Frontend (as-built)

### Ruta

`/mascotas/:id/editar` — página dedicada (misma línea visual del alta).

### Secciones (cards)

| Sección | Campos |
|---------|--------|
| Identidad | Nombre editable; especie **disabled**; raza; estado |
| Tutor | Búsqueda typeahead; **sin** checkbox tutor eventual |
| Fecha | Toggle mes/año vs día exacto (como alta) |
| Clínicos | Sexo, microchip, alertas + 5 catálogos filtrados por `especie_id` |

Sin campo de peso.

### Flujo

1. Montaje: `GET /api/mascotas/{id}` + carga de razas/estados/catálogos por especie.
2. Guardar: validación manual → `PATCH` → Dialog de éxito → volver al listado.
3. Listado: ícono lápiz (si `mascotas:editar`) navega a `/mascotas/${id}/editar`.

---

## 5. Tests

- Pytest: GET/PATCH 401/403/404; update ok; raza inválida; rechazo tutor eventual; pelaje de otra especie; listado catálogo filtrado.
- Vitest: `validateEditForm` / `buildUpdatePayload` / fecha mes-año vs exacta.
