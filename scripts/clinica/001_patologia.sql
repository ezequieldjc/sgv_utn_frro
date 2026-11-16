-- =============================================================================
-- 001_patologia.sql — Historia clínica: patología según tablas_antes_despues.pdf
-- Ejecutar como DBA (owner de la base), NUNCA como fastapi_app.
--
-- Se borra patologia_predisposicion (la reemplazará la base de conocimiento) y se
-- amplía patologia. nivel_gravedad se conserva. Ambas tablas estaban vacías.
--
-- Historial:
--   - main (Neon): aplicado el 14/11/2026.
-- =============================================================================

BEGIN;

-- 1. Seguridad: el script asume tablas vacías
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM clinica.patologia)
       OR EXISTS (SELECT 1 FROM clinica.patologia_predisposicion) THEN
        RAISE EXCEPTION 'patologia o patologia_predisposicion tienen datos: revisar antes de seguir';
    END IF;
END $$;

-- 2. Se elimina el modelo anterior de predisposición
DROP TABLE clinica.patologia_predisposicion;

-- 3. Columnas nuevas de patología
ALTER TABLE clinica.patologia
    ALTER COLUMN nombre TYPE VARCHAR(160),
    ADD COLUMN codigo                   VARCHAR(100) NOT NULL,
    ADD COLUMN nombre_en                VARCHAR(160),
    ADD COLUMN categoria                VARCHAR(80),
    ADD COLUMN prevalencia              NUMERIC(6,5) NOT NULL,
    ADD COLUMN prevalencia_nivel        VARCHAR(20)  NOT NULL,
    ADD COLUMN solo_razas_predispuestas BOOLEAN      NOT NULL DEFAULT FALSE,
    ADD COLUMN activo                   BOOLEAN      NOT NULL DEFAULT TRUE,
    ADD CONSTRAINT "UQ_Patologia_Codigo"      UNIQUE (codigo),
    ADD CONSTRAINT "CK_Patologia_Prevalencia" CHECK (prevalencia > 0 AND prevalencia <= 1);

COMMIT;

-- Verificación:
-- SELECT column_name, data_type, character_maximum_length, is_nullable
-- FROM information_schema.columns
-- WHERE table_schema = 'clinica' AND table_name = 'patologia' ORDER BY ordinal_position;
-- SELECT to_regclass('clinica.patologia_predisposicion');  -- NULL
