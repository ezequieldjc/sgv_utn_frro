# Resumen de Arquitectura y Modelo de Datos - Módulo Mascotas

> **Estado:** cambios de BD del 2026-09-07.
> El **diccionario canónico** (entidades/columnas/FKs) vive en [`modelo_datos_v1.md`](./modelo_datos_v1.md)
> (módulos `Catalogo` + `Clinica`). Este archivo conserva el resumen de nomenclatura,
> impacto de API y notas de validación contra la BD.

Este documento resume la estructura de la base de datos (PostgreSQL), reglas de negocio e impacto en la API para el módulo de gestión de pacientes veterinarios y el motor de predicción de patologías.

---

## 1. Reglas de Nomenclatura Aplicadas

* **Nombres de Tablas:** Siempre en **singular** (ej. `catalogo.pelaje`, `clinica.mascota`, `catalogo.habitat`).
* **Claves Primarias (PK):** Se nombran simplemente `id` (`SERIAL PRIMARY KEY`) en todas las tablas.
* **Claves Foráneas (FK):** Utilizan la convención `[entidad]_id` (ej. `pelaje_id`, `especie_id`, `persona_id`).

> Excepción actual en BD: `clinica.patologia_predisposicion` usa PK `predisposicion_id` (pendiente renombrar a `id` para alinear nomenclatura).

---

## 2. Esquema `catalogo` (Tablas Paramétricas)

Contiene las tablas de referencia para alimentar desplegables dinámicos. Las tablas específicas de especie incluyen la columna `especie_id` para permitir filtrados en el frontend.

### Tablas del Esquema
* `catalogo.estado_reproductivo` (`id`, `especie_id`, `nombre`, `descripcion`)
* `catalogo.habitat` (`id`, `especie_id`, `nombre`, `descripcion`)
* `catalogo.tamanio` (`id`, `especie_id`, `nombre`, `descripcion`)
* `catalogo.pelaje` (`id`, `especie_id`, `nombre`, `descripcion`)
* `catalogo.temperamento` (`id`, `especie_id`, `nombre`, `descripcion`)
* `catalogo.mascota_estado` (`id`, `nombre`, `descripcion`) *(Global)*

---

## 3. Esquema `clinica` (Entidades Principales y Diagnósticas)

### Tabla: `clinica.mascota`
Entidad principal del paciente. Se eliminó la columna libre `estado` y se agregaron campos médicos/legales clave.

* **PK:** `id` (`SERIAL`)
* **Atributos de Datos:**
  * `nombre` (`VARCHAR(50)`)
  * `fecha_nacimiento` (`DATE`)
  * `ultimo_peso` (`NUMERIC(5,2)`)
  * `sexo` (`CHAR(1)`) -> Restricción: `'M'`, `'H'`, `'U'`
  * `microchip` (`VARCHAR(15) UNIQUE`)
  * `alertas_medicas` (`TEXT`)
  * `fecha_alta` (`TIMESTAMP`)
* **Claves Foráneas (FK):**
  * `persona_id` -> `core.persona(id)`
  * `raza_id` -> `clinica.raza(id)`
  * `pelaje_id` -> `catalogo.pelaje(id)`
  * `tamanio_id` -> `catalogo.tamanio(id)`
  * `habitat_id` -> `catalogo.habitat(id)`
  * `estado_reproductivo_id` -> `catalogo.estado_reproductivo(id)`
  * `temperamento_id` -> `catalogo.temperamento(id)`
  * `mascota_estado_id` (`NOT NULL`) -> `catalogo.mascota_estado(id)`

### Tabla: `clinica.historial_peso`
Tabla transaccional para auditar la evolución ponderal del paciente.

* **PK:** `id` (`SERIAL`)
* **Atributos:**
  * `mascota_id` (`INTEGER NOT NULL`) → `clinica.mascota(id)`
  * `fecha` (`TIMESTAMP NOT NULL`)
  * `peso_kg` (`NUMERIC(5,2) NOT NULL`)
* **Unique:** `UQ_HP_MascotaFecha` sobre (`mascota_id`, `fecha`)
* **Automatización:** Trigger `trg_actualizar_ultimo_peso` (`AFTER INSERT`) ejecuta `clinica.fn_actualizar_ultimo_peso()` y actualiza `clinica.mascota.ultimo_peso` con `NEW.peso_kg`.

### Motor Predictivo de Patologías

#### `clinica.patologia`
* **PK:** `id` (`SERIAL`)
* **Atributos:** `nombre`, `descripcion`, `nivel_gravedad`
* **CHECK** en `nivel_gravedad`: `'Baja' | 'Moderada' | 'Alta' | 'Crítica'`

#### `clinica.patologia_predisposicion`
Matriz lógica que cruza variables demográficas para sugerir riesgos médicos (sugerencia estadística; no reemplaza criterio veterinario).

* **PK:** `predisposicion_id` (`SERIAL`) — *excepción de nomenclatura; idealmente `id`*
* **Atributos / FKs:**
  * `patologia_id` (`NOT NULL`) → `clinica.patologia(id)`
  * `especie_id` (nullable) — *columna presente; hoy sin FK formal a `clinica.especie`*
  * `raza_id` (nullable) → `clinica.raza(id)`
  * `estado_reproductivo_id` (nullable) → `catalogo.estado_reproductivo(id)`
  * `habitat_id` (nullable) → `catalogo.habitat(id)`
  * `tamanio_id` (nullable) → `catalogo.tamanio(id)`
  * `rango_edad_meses_min` (`INTEGER`, nullable)
  * `rango_edad_meses_max` (`INTEGER`, nullable)

---

## 4. Impacto en la API (Endpoints Backend)

### Catálogos
Endpoints de filtrado por especie para poblar el frontend:
* `GET /api/v1/catalogos/especies/{especie_id}/pelajes`
* `GET /api/v1/catalogos/especies/{especie_id}/tamanios`
* `GET /api/v1/catalogos/especies/{especie_id}/habitats`
* `GET /api/v1/catalogos/especies/{especie_id}/estados-reproductivos`
* `GET /api/v1/catalogos/especies/{especie_id}/temperamentos`
* `GET /api/v1/catalogos/mascota-estados`

### Gestión de Mascotas
* `POST /api/v1/mascotas` y `PUT /api/v1/mascotas/{id}`
  * **DTO de Entrada:** enviar las FKs (`pelaje_id`, `tamanio_id`, `habitat_id`, `estado_reproductivo_id`, `temperamento_id`, `mascota_estado_id`), `sexo`, `microchip` y `alertas_medicas`. Removido el campo de texto `estado`.
* `GET /api/v1/mascotas/{id}`
  * **DTO de Salida:** Incluir datos propios del paciente y los nombres/descripciones de las tablas de catálogo relacionadas.

### Historial y Motor Predictivo
* `POST /api/v1/mascotas/{id}/pesos`: Inserción de pesaje (`peso_kg`, `fecha`). El trigger sincroniza `ultimo_peso`.
* `GET /api/v1/mascotas/{id}/pesos`: Listado histórico de pesos para gráficas de evolución.
* `GET /api/v1/mascotas/{id}/patologias-sugeridas`: Evalúa la edad calculada, raza, tamaño, hábitat y estado reproductivo de la mascota contra `clinica.patologia_predisposicion` y retorna sugerencias estadísticas.
