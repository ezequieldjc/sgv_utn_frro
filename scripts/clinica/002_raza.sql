-- =============================================================================
-- 002_raza.sql — Raza: código, talla y peso de referencia
-- Ejecutar como DBA (owner de la base), NUNCA como fastapi_app.
--
-- Las tres columnas son opcionales: se completan solo para las razas de perro
-- de la base de conocimiento. "Sin raza definida" queda en NULL.
-- talla no tiene CHECK: la lista de valores está pendiente de definir.
--
-- Historial:
--   - main (Neon): aplicado el 14/11/2026.
-- =============================================================================

BEGIN;

ALTER TABLE clinica.raza
    ADD COLUMN codigo             VARCHAR(60),
    ADD COLUMN talla              VARCHAR(10),
    ADD COLUMN peso_referencia_kg NUMERIC(5,2),
    ADD CONSTRAINT "UQ_Raza_Codigo"  UNIQUE (codigo),
    ADD CONSTRAINT "CK_Raza_PesoRef" CHECK (peso_referencia_kg IS NULL OR peso_referencia_kg > 0);

COMMIT;

-- Verificación:
-- SELECT id, nombre, codigo, talla, peso_referencia_kg FROM clinica.raza LIMIT 5;
