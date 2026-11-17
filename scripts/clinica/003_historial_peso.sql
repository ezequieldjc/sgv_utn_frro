-- =============================================================================
-- 003_historial_peso.sql — Se elimina historial_peso, su trigger y su función
-- Ejecutar como DBA (owner de la base), NUNCA como fastapi_app.
--
-- El historial de peso pasa a ser la serie de consulta.peso_kg (005).
-- mascota.ultimo_peso se conserva con su último valor; ya no lo actualiza un trigger.
-- REQUIERE actualizar el backend (alta de mascota y /mascotas/{id}/pesos).
--
-- Historial:
--   - main (Neon): aplicado el 14/11/2026 (se perdió 1 fila de historial_peso;
--     su valor quedó en mascota.ultimo_peso).
-- =============================================================================

BEGIN;

-- 1. La tabla (borra también el trigger trg_actualizar_ultimo_peso)
DROP TABLE clinica.historial_peso;

-- 2. La función que usaba el trigger
DROP FUNCTION clinica.fn_actualizar_ultimo_peso();

COMMIT;

-- Verificación:
-- SELECT to_regclass('clinica.historial_peso');                        -- NULL
-- SELECT to_regprocedure('clinica.fn_actualizar_ultimo_peso()');       -- NULL
