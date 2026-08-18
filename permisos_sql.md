# Permisos de FastAPI y Alembic sobre la base de datos

Para evitar que Cursor cree tablas y columnas raras, le vamos a dar un usuario sin permisos para  crear/modificar/borrar tablas ni columnas. 

De esta forma, vamos a ser nosotros quienes le vamos a decir: cree tal columna en tal tabla que sirve para tal o cual cosa. 
Hace que esta funcionalisepdad nueva use esa columna para tal o cual cosa. 

# Flujo de trabaja ante una nueva feature

Ejemplo: si queremos que ahora el sistema guarde todos los intentos de inicio de sesion: 

    - Vamos a crear la tabla auth.login
        
        - con todas las columnas tal cual necesitamos

    - Vamos a darle un prompt a cursor con la tabla y las columnas que creamos. Los tipso de datos de cada una de las columnas. Pidiendole que actualice el modelo de datos con alembic (model.py), y que cursor sepa que hay en la base datos.

    - ver archivo database-permission.mdc


# Sentencias ejecutadas en SQL

```sql
CREATE ROLE fastapi_app WITH LOGIN PASSWORD 'PWD_fastapi_app';

-- ==========================================
-- 1. ESQUEMA: auth
-- ==========================================
GRANT USAGE ON SCHEMA auth TO fastapi_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA auth TO fastapi_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA auth TO fastapi_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA auth 
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO fastapi_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA auth 
GRANT USAGE, SELECT ON SEQUENCES TO fastapi_app;

-- ==========================================
-- 2. ESQUEMA: clinica
-- ==========================================
GRANT USAGE ON SCHEMA clinica TO fastapi_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA clinica TO fastapi_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA clinica TO fastapi_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA clinica 
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO fastapi_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA clinica 
GRANT USAGE, SELECT ON SEQUENCES TO fastapi_app;

-- ==========================================
-- 3. ESQUEMA: core
-- ==========================================
GRANT USAGE ON SCHEMA core TO fastapi_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA core TO fastapi_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA core TO fastapi_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA core 
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO fastapi_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA core 
GRANT USAGE, SELECT ON SEQUENCES TO fastapi_app;

-- ==========================================
-- 4. ESQUEMA: sys
-- ==========================================
GRANT USAGE ON SCHEMA sys TO fastapi_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA sys TO fastapi_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA sys TO fastapi_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA sys 
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO fastapi_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA sys 
GRANT USAGE, SELECT ON SEQUENCES TO fastapi_app;
'''''