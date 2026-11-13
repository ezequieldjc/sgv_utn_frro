---
applyTo: "backend/**"
description: "Flujo DBA-First: PostgreSQL es la fuente de verdad y la app solo hace DML. Espejo de .cursor/rules/database-permission.mdc y home.mdc."
---

# DBA-First

El DBA es el único responsable de crear y modificar la estructura de PostgreSQL (tablas,
columnas, relaciones, constraints e índices). La base siempre va un paso adelante del código.

## Reglas estrictas

- Cero DDL en runtime: la app se conecta con el usuario `fastapi_app`, que SOLO tiene DML
  (`SELECT`, `INSERT`, `UPDATE`, `DELETE`). No tiene `CREATE`, `DROP` ni `ALTER`.
- Prohibido `SQLModel.metadata.create_all()` / `Base.metadata.create_all()` en código de la
  app, seeds o scripts de runtime. La única excepción es la fixture de tests en
  `backend/tests/conftest.py`, que arma una SQLite en memoria.
- SQLModel solo mapea lo que el DBA ya creó. Alembic, si se usa, es historial de código
  (`models/`, `docs/modelo_datos_v1.md`). Nunca corras `alembic upgrade` contra la DB de la
  aplicación. El DBA aplica el DDL a mano.
- Respetá si el código del módulo es síncrono o asíncrono y las dependencias que ya existen
  (`get_session` de `app.db.session`).

## Flujo

1. Si el DBA ya creó la estructura en Postgres (ej.: "Creé `clinica.mascota` con los campos
   X, Y, Z"), actualizá únicamente:
   - el modelo SQLModel en `backend/app/models/<schema>/` con `__table_args__ = {"schema": "..."}`;
   - los schemas Pydantic en `backend/app/schemas/`;
   - los endpoints en `backend/app/api/`, solo con DML y `get_session`;
   - el diccionario `docs/modelo_datos_v1.md`, para que coincida con Postgres;
   - Alembic solo si el DBA lo pide, como historial de código.
2. Si te piden una funcionalidad y falta una tabla o columna:
   - **Stop.** No inventes el campo en SQLModel, no escribas DDL, no corras Alembic.
   - Redactá el pedido al DBA: nombre, tipo, nullability, FKs, default y para qué sirve.
     Podés proponer el script SQL en `scripts/<modulo>/` para que el DBA lo revise y lo
     aplique, pero nunca lo ejecutes desde la app.
   - Cuando el DBA confirme que ya existe, seguí el paso 1.
3. Datos faltantes (permisos nuevos, rol `CLIENTE`, filas de `sys.config`) se piden al DBA
   como `INSERT` de datos (ej. en `scripts/rol_permiso.sql`), nunca como DDL desde la app.
