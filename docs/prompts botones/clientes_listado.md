# Especificación de Pantalla: Mascotas y Clientes -> Listado de Clientes (`/clientes`)

Actuá como un Senior Full-Stack Engineer y respetá estrictamente las reglas de:
- `.cursor/rules/home.mdc`
- `.cursor/rules/tech-stack.mdc`
- `.cursor/rules/database-types.mdc`
- `.cursor/rules/rbac-security.mdc`
- `.cursor/rules/ui-layout.mdc`

Además, mantené la misma forma de trabajo y nomenclatura ya implementada en el módulo:
- `Admin -> Usuarios` (`/admin/usuarios`)

---

## 1. Objetivo de esta iteración

Implementar el módulo de acceso y pantalla base de **Listado de Clientes** desde el menú:
- `Mascotas y Clientes -> Listado de Clientes`

Con estos cambios obligatorios:
1. Eliminar del sidebar la opción `Nuevo Cliente`.
2. Dejar como único punto de entrada al alta el botón `+ Nuevo Cliente` dentro de `/clientes`.
3. Replicar exactamente el patrón de UX y permisos utilizado en `Admin -> Usuarios`.

---

## 2. Definición de Cliente (`es_cliente`)

No existe tabla `cliente`. Un **cliente** es una fila de `core.persona` con:

```text
es_cliente = true
```

### Columna `core.persona.es_cliente`
- Tipo: `boolean NOT NULL`
- Default en base de datos: **`true`** (lo más típico al dar de alta dueños).
- Significado: indica si la persona es cliente/dueño de la clínica.
- El listado y `GET /api/clientes` **solo** incluyen personas con `es_cliente = true`.

### Regla de alta de usuarios/empleados (crítica)
Al crear un usuario del sistema (`POST /api/usuarios` / Admin → Usuarios), la `persona`
asociada **debe** persistirse con **`es_cliente = false`**. Si no, el empleado aparecería
en el listado de clientes por el default `true`.

### Empleado que también es dueño
La misma `core.persona` puede:
- tener fila en `auth.usuario` (acceso al sistema), **y**
- tener `es_cliente = true` (aparece en Listado de Clientes).

`es_cliente` y `auth.usuario` son independientes. No filtrar clientes por “persona sin usuario”.

### Alta de cliente y check “Crear usuario”
- El alta vive en `/clientes/nuevo` (spec: [`clientes_crear.md`](./clientes_crear.md)).
- La persona se crea con `es_cliente = true`.
- Check UI **“Crear usuario”**: opcionalmente crea también `auth.usuario` con rol fijo
  `CLIENTE` sobre la misma persona (detalle y contrato en la spec de alta).

---

## 3. Reglas funcionales y de permisos

### Acceso a pantalla
- La ruta `/clientes` requiere permiso `clientes:ver_listado` (o wildcard `*`).
- Si no tiene permiso, renderizar estado visual de acceso denegado, consistente con `usuarios-page.tsx`.

### Botón de alta
- En `/clientes`, renderizar botón primario `+ Nuevo Cliente` exactamente con el patrón visual y de comportamiento de `+ Nuevo Usuario`.
- Este botón requiere permiso `clientes:crear` (o wildcard `*`).
- Navega a `/clientes/nuevo`.

### Acciones por fila
| Acción | Ícono | Permiso | Ruta |
|--------|-------|---------|------|
| Editar | lápiz (`Pencil`) | `clientes:editar` o `*` | `/clientes/{id}/editar` |
| Ver Mascotas | mascota (`PawPrint`) | `clientes:ver_listado` o `*` | `/mascotas?cliente_id={id}` |
| Ver Detalle | ojo (`Eye`) | `clientes:ver_listado` o `*` | `/clientes/{id}` |

Las pantallas de destino pueden ser stubs mínimos en esta iteración; las rutas deben existir para no romper la navegación.

### Importante sobre alta de cliente
- La validación de DNI duplicado (`409 DNI_DUPLICADO`) se implementa en el alta
  (`POST /api/clientes`); ver [`clientes_crear.md`](./clientes_crear.md).
- El unique `UQ_Persona_DNI` en Postgres sigue existiendo a nivel DB.

### Buscador
- Filtrado en frontend (mismo patrón que Usuarios) por **nombre**, **apellido** o **DNI**
  (coincidencia no sensible a mayúsculas/minúsculas).

### Edad
- Campo `edad` en el DTO, calculado en **backend**.
- Años **truncados** desde `fecha_nacimiento` (ej.: 36,9 años → **36**; todavía no cumplió 37).

---

## 4. Cambios de navegación requeridos

### Sidebar
- En la sección `Mascotas y Clientes`:
  - Quitar ítem: `Nuevo Cliente` (permiso `clientes:crear`).
  - Mantener ítem: `Listado de Clientes` (permiso `clientes:ver_listado`).

### Router frontend
- Rutas protegidas:
  - `/clientes` (listado)
  - `/clientes/nuevo` (alta real; ver `clientes_crear.md`)
  - `/clientes/:id` (stub detalle)
  - `/clientes/:id/editar` (stub edición)
  - `/mascotas` (stub; acepta query `cliente_id`)

La eliminación del ítem de sidebar no debe romper la navegación a `/clientes/nuevo` desde el botón del listado.

---

## 5. Pantalla `/clientes` (estructura base obligatoria)

Construir siguiendo la misma estructura de `usuarios-page.tsx`:

1. Header de módulo:
- Título principal: `Listado de Clientes`
- Subtítulo: `Administración de clientes de la clínica.`

2. Barra superior de control (misma composición que Usuarios):
- Input de búsqueda a la izquierda (componente Shadcn `Input` + ícono `Search`).
- Botón `+ Nuevo Cliente` a la derecha, condicionado por permiso `clientes:crear`.

3. Tabla de clientes:
- Renderizar una tabla visible (`Table` de Shadcn UI), estilo consistente con Usuarios.
- Columnas obligatorias:
  - `Nombre` (`core.persona.nombre`)
  - `Apellido` (`core.persona.apellido`)
  - `DNI` (`core.persona.dni`)
  - `Sexo` (`core.persona.sexo`)
  - `Celular` (`core.persona.celular`)
  - `Fecha Alta` (`core.persona.fecha_alta`)
  - `Ciudad` (`core.domicilio.ciudad`; `-` si no hay domicilio)
  - `Edad` (años truncados desde `fecha_nacimiento`, calculada en backend)
  - `Acciones` (alineada a la izquierda; Editar / Ver Mascotas / Ver Detalle)

4. Estados UI mínimos:
- Loading (skeleton o equivalente, consistente con Usuarios).
- Error recuperable (bloque visual consistente con Usuarios).
- Empty state (sin datos / sin resultados de búsqueda).

---

## 6. Backend/API

### Endpoint
- `GET /api/clientes`

### Seguridad
- Validar permiso `clientes:ver_listado` (o `*`) en backend con el mismo patrón `require_permission` que Usuarios.
- Cookie HttpOnly; no confiar solo en el frontend.

### Filtro de negocio
- `WHERE core.persona.es_cliente = true`
- `LEFT JOIN core.domicilio` vía `persona.domicilio_id` para `ciudad`.
- Orden sugerido: apellido, nombre.

### Respuesta
Arreglo tipado (schema Pydantic), propiedades JSON en `snake_case`. Campos del DTO:

- `id`
- `nombre`
- `apellido`
- `dni`
- `sexo`
- `celular`
- `fecha_alta`
- `ciudad` (`string | null`)
- `edad` (`int`, truncada)

No usar `dict` crudos en request/response.

---

## 7. Convenciones de implementación (obligatorias)

- Mantener patrones de archivos y nomenclatura usados en `usuarios`:
  - `api/`, `services/`, `schemas/`, `types/`, `pages/`.
- Mantener contrato de errores `{ "error": "...", "detalle": "..." }`.
- No usar `any` en TypeScript.
- Mantener propiedades JSON en `snake_case`.
- Reutilizar helpers de permisos existentes (wildcard `*` incluido).
- Documentar `es_cliente` en `docs/modelo_datos_v1.md` y en el modelo SQLModel `Persona`.

---

## 8. Criterios de aceptación

1. El sidebar ya no muestra `Nuevo Cliente`.
2. `Mascotas y Clientes -> Listado de Clientes` navega a `/clientes`.
3. La pantalla `/clientes` muestra header + buscador + tabla + botón `+ Nuevo Cliente`.
4. El botón `+ Nuevo Cliente` respeta `clientes:crear` (o `*`).
5. Si no hay `clientes:ver_listado` ni `*`, la pantalla muestra acceso denegado.
6. Existe protección backend por `clientes:ver_listado` en `GET /api/clientes`.
7. El listado solo incluye personas con `es_cliente = true`.
8. El alta de usuario/empleado setea `es_cliente = false` en la persona creada.
9. La validación de DNI duplicado corresponde al alta (`clientes_crear.md`), no a este listado.
10. Se mantiene consistencia visual y de arquitectura con `Admin -> Usuarios`.
11. La tabla renderiza: Nombre, Apellido, DNI, Sexo, Celular, Fecha Alta, Ciudad, Edad y Acciones.
12. Cada fila ofrece acciones: Editar, Ver Mascotas y Ver Detalle, cableadas a las rutas indicadas.
13. El buscador filtra por nombre, apellido o DNI.
14. La edad es años truncados calculados en backend.

---

## 9. Entregables esperados

- Cambios en sidebar y rutas frontend.
- Nueva pantalla de listado de clientes.
- Endpoint backend `GET /api/clientes` con permiso y filtro `es_cliente`.
- Modelo/docs de `es_cliente` y regla en alta de usuarios.
- Tipos/schemas necesarios.
- Tests mínimos: `GET /api/clientes` (401, 403, 200), exclusión de `es_cliente=false`, edad truncada; assert de `es_cliente=false` en create de usuario.
- Stubs de `/clientes/:id`, `/clientes/:id/editar`, `/mascotas`.
- Alta de cliente documentada en [`clientes_crear.md`](./clientes_crear.md).

---

## 10. Fuera de alcance de esta iteración (listado)

- Edición / detalle de cliente (stubs de navegación).
- Módulo real de mascotas (solo stub de navegación).
- Detalle del formulario de alta: ver [`clientes_crear.md`](./clientes_crear.md).
