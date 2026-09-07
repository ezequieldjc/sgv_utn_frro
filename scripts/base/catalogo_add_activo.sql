-- Catálogos: baja lógica
-- Agrega columna `activo` (NOT NULL, default true) en todas las tablas de catalogo
-- usadas por Admin -> Catálogos.
-- Ejecutar como DBA contra la base de la app.

BEGIN;

ALTER TABLE catalogo.estado_reproductivo
  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;

ALTER TABLE catalogo.habitat
  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;

ALTER TABLE catalogo.tamanio
  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;

ALTER TABLE catalogo.pelaje
  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;

ALTER TABLE catalogo.temperamento
  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;

ALTER TABLE catalogo.mascota_estado
  ADD COLUMN IF NOT EXISTS activo boolean NOT NULL DEFAULT true;

COMMIT;

-- Verificación rápida:
-- SELECT table_name, column_name, data_type, column_default, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'catalogo' AND column_name = 'activo'
-- ORDER BY table_name;
