-- =============================================================================
-- 004_sintoma.sql — Catálogo de signos (NLP, veterinario y motor)
-- Ejecutar como DBA (owner de la base), NUNCA como fastapi_app.
--
-- codigo no cambia nunca: lo usan el NLP y el motor.
-- sistema: lista cerrada de 13 valores; confirmar contra catalogo_signos.csv al cargar.
-- La carga de datos va en un script aparte (pendiente).
--
-- Historial:
--   - main (Neon): aplicado el 14/11/2026.
-- =============================================================================

BEGIN;

-- 1. Tabla
CREATE TABLE clinica.sintoma (
    id         SERIAL PRIMARY KEY,
    codigo     VARCHAR(40) NOT NULL,
    nombre_es  VARCHAR(80) NOT NULL,
    sistema    VARCHAR(20) NOT NULL,
    tipo       VARCHAR(12) NOT NULL,
    activo     BOOLEAN     NOT NULL DEFAULT TRUE,
    CONSTRAINT "UQ_Sintoma_Codigo"  UNIQUE (codigo),
    CONSTRAINT "CK_Sintoma_Tipo"    CHECK (tipo IN ('observable','examen')),
    CONSTRAINT "CK_Sintoma_Sistema" CHECK (sistema IN (
        'general','piel','oido','ojo','boca','respiratorio','cardiovascular',
        'digestivo','urinario','reproductor','musculoesqueletico','neurologico','conducta'))
);

-- 2. Permisos para fastapi_app
GRANT SELECT, INSERT, UPDATE, DELETE ON clinica.sintoma TO fastapi_app;
GRANT USAGE, SELECT ON SEQUENCE clinica.sintoma_id_seq TO fastapi_app;

COMMIT;

-- Verificación:
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
-- WHERE conrelid = 'clinica.sintoma'::regclass;
