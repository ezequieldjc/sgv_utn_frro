---
applyTo: "backend/app/models/**,backend/app/schemas/**,backend/app/services/**,frontend/src/types/**,docs/modelo_datos*.md"
description: "Mapeo de datos entre PostgreSQL, SQLModel, Pydantic y TypeScript: schemas, nombres, tipos, JSONB y sys.config. Espejo de .cursor/rules/database-types.mdc."
---

# Mapeo de datos Postgres → backend → API → frontend

## PostgreSQL multi-schema

No todo vive en `public`. Schemas actuales:

- `core` (persona, domicilio)
- `catalogo` (estado_reproductivo, habitat, tamanio, pelaje, temperamento, mascota_estado,
  rubro; todos con `activo` para baja lógica)
- `clinica` (especie, raza, mascota, historial_peso, patologia, patologia_predisposicion)
- `auth` (usuario, rol, permiso, rol_permiso, historial_contrasena, login)
- `sys` (config)
- `agenda` (tipo_turno, turno)
- `stock` (producto, movimiento_stock)
- `comercial` (venta, detalle_venta)

Cada modelo SQLModel declara su schema explícitamente: `__table_args__ = {"schema": "clinica"}`.
Nunca asumas `public`.

`core.persona` incluye `fecha_nacimiento`, `domicilio_id` (FK a `core.domicilio`) y
`es_cliente`; `dni`, `sexo`, `fecha_nacimiento`, `mail` y `domicilio_id` admiten NULL. `dni`
no es unique. El diccionario canónico es `docs/modelo_datos_v1.md`.

## Fuente única de verdad

- PostgreSQL (el DBA) define la estructura. Los modelos en `models/<schema>/` la reflejan
  exactamente. Los contratos de la API viven en `schemas/` como clases Pydantic.
- Los tipos TypeScript del frontend se van a generar desde el OpenAPI de FastAPI con
  `openapi-typescript` hacia `@/types/api.ts`. Ese pipeline todavía no existe: hasta entonces,
  escribí los tipos TS a mano reflejando exactamente el schema Pydantic y poné
  `// TODO: reemplazar por tipo generado desde OpenAPI` arriba de cada uno.

## Nombres

- Tablas y columnas en snake_case y en singular (`mascota`, `fecha_nacimiento`).
- Interfaces/types de TypeScript en PascalCase (`Mascota`, `HistorialPeso`), pero con las
  propiedades en snake_case, porque así viaja el JSON. No inventes un mapeo a camelCase.

## No inventes campos

Nunca agregues una propiedad que no esté en PostgreSQL ni en el diccionario. Si hace falta un
campo nuevo, se pide al DBA (ver `dba-first.instructions.md`). Campos reales que suelen
reinventarse mal:

| Usá | No uses |
|-----|---------|
| `mascota.ultimo_peso` | `mascota.peso_actual` |
| `mascota.mascota_estado_id` | un campo libre `mascota.estado` |
| `historial_peso.peso_kg` | `peso` |
| `persona.mail` | `usuario.email` (el mail vive en `persona`) |
| `usuario.habilitado` | `usuario.activo` |

## Tipos de columna

Respetá el tipo del diccionario: `decimal(5,2)` → `Decimal` con `max_digits=5,
decimal_places=2` (nunca `float`); `timestamp` → `datetime`; `inet` → `IPvAnyAddress`.

## Campos dinámicos (JSONB)

Los campos de historia clínica sin estructura fija (ej. hallazgos según especie) son columnas
JSONB, no columnas nuevas por campo. En SQLModel: `sa_column=Column(JSONB)` de
`sqlalchemy.dialects.postgresql`. En Pydantic: `dict[str, Any]` o un modelo anidado si la
estructura se conoce. Nunca serialices JSON a mano en una columna TEXT.

## Configuración dinámica (`sys.config`)

Almacén clave-valor agrupado (`config_nombre` + `parametro_nombre` + `parametro_valor`) para
parámetros de negocio ajustables sin redeploy. Nunca como constantes en código ni en `.env`.

- Todo acceso pasa por `services/config_service.py`, con cache en memoria; nunca un SELECT
  suelto por request.
- Después de cualquier UPDATE de `parametro_valor`, llamá **siempre** a
  `clear_config_cache()`.
- Nombres canónicos (no reinventar): `ACCESS_TOKEN_EXPIRACION`, `REFRESH_TOKEN_EXPIRACION`,
  `RAZON_SOCIAL`, `PERSONA_ID_TUTOR_EVENTUAL`, `RAZA_NOMBRE_DEFAULT`. Permisos de la pantalla:
  `parametros:ver` / `parametros:editar`. Admin de parámetros solo edita `parametro_valor`
  (sin POST/DELETE de filas).
- Un `config_nombre`/`parametro_nombre` nuevo (dato, no DDL) se documenta en el diccionario
  o en un script SQL del DBA.

## Alembic

No se usa para crear tablas ni columnas en la DB de la app. Una revisión puede existir solo
como historial de `models/`, si el DBA lo pide. Nunca `alembic upgrade` con `fastapi_app`.
