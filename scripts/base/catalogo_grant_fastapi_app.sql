-- Permisos DML para el usuario de la app sobre schema catalogo
-- Ejecutar como DBA (owner / rol con GRANT OPTION).
-- El rol fastapi_app solo debe tener DML, no DDL.

BEGIN;

GRANT USAGE ON SCHEMA catalogo TO fastapi_app;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA catalogo TO fastapi_app;

-- Por si hay sequences (SERIAL/IDENTITY) en tablas de catálogo:
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA catalogo TO fastapi_app;

-- Asegurar que tablas/sequences futuras del schema hereden los mismos grants:
ALTER DEFAULT PRIVILEGES IN SCHEMA catalogo
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO fastapi_app;

ALTER DEFAULT PRIVILEGES IN SCHEMA catalogo
  GRANT USAGE, SELECT ON SEQUENCES TO fastapi_app;

COMMIT;

-- Verificación (como fastapi_app o con SET ROLE):
-- SELECT has_schema_privilege('fastapi_app', 'catalogo', 'USAGE');
-- SELECT * FROM catalogo.habitat LIMIT 1;
