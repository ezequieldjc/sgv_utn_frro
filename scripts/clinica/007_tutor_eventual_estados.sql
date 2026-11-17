-- =============================================================================
-- 007_tutor_eventual_estados.sql — Estados permitidos para las mascotas del tutor eventual
-- Ejecutar como DBA (owner de la base), NUNCA como fastapi_app.
--
-- Solo datos (INSERT / UPDATE): no cambia la estructura. Se puede correr más de una vez.
--
-- Regla (backend/app/services/mascota_service.py):
--   - Una mascota con el tutor eventual (PERSONA_ID_TUTOR_EVENTUAL) solo puede estar en uno
--     de los estados del parámetro ESTADOS_MASCOTA_TUTOR_EVENTUAL. Por defecto, el primero.
--   - Al asignarle un dueño pasa a ACTIVA (salvo que se elija otro estado).
--   - Esos estados también se pueden atender: la agenda les da turnos y aparecen en el buscador.
--
-- Este script:
--   1. Crea el parámetro con los ids de "En Tránsito / Rescate" (el de por defecto) y
--      "Extraviado". Los busca por nombre, sin importar mayúsculas ni tildes del catálogo.
--   2. Pasa a "En Tránsito / Rescate" las mascotas del tutor eventual que hoy están en otro
--      estado (las que se cargaron antes de la regla quedaron ACTIVAS).
--
-- Hasta que se corra, la app se comporta como antes: el tutor eventual no tiene restricción.
--
-- ORDEN: correrlo DESPUÉS de desplegar el código de la rama feature/tutor-eventual-estados.
-- El código anterior solo da turnos a mascotas ACTIVAS: con este script aplicado y el código
-- viejo, las mascotas del tutor eventual no aparecerían en la agenda ni en el buscador.
--
-- Historial:
--   - pendiente de aplicar en main (Neon).
-- =============================================================================

BEGIN;

-- 0. Tienen que existir los dos estados (activos) en el catálogo. Si no, se cancela todo.
DO $$
DECLARE
    rescate    integer;
    extraviado integer;
BEGIN
    SELECT count(*) INTO rescate
    FROM catalogo.mascota_estado
    WHERE activo AND nombre ILIKE '%rescate%';

    SELECT count(*) INTO extraviado
    FROM catalogo.mascota_estado
    WHERE activo AND nombre ILIKE 'extraviad%';

    IF rescate <> 1 OR extraviado <> 1 THEN
        RAISE EXCEPTION
            'Se esperaba un estado activo "En Tránsito / Rescate" y uno "Extraviado" en catalogo.mascota_estado (encontrados: % y %)',
            rescate, extraviado;
    END IF;
END $$;

-- 1. Parámetro: primero Rescate (el de por defecto), después Extraviado ------------------
INSERT INTO sys.config (config_id, config_nombre, parametro_id, parametro_nombre, parametro_valor)
SELECT
    3,
    'SISTEMA',
    (SELECT COALESCE(MAX(parametro_id), 0) + 1 FROM sys.config WHERE config_id = 3),
    'ESTADOS_MASCOTA_TUTOR_EVENTUAL',
    (SELECT id FROM catalogo.mascota_estado WHERE activo AND nombre ILIKE '%rescate%')::text
        || ','
        || (SELECT id FROM catalogo.mascota_estado WHERE activo AND nombre ILIKE 'extraviad%')::text
WHERE NOT EXISTS (
    SELECT 1 FROM sys.config WHERE parametro_nombre = 'ESTADOS_MASCOTA_TUTOR_EVENTUAL'
);

-- 2. Mascotas del tutor eventual en otro estado → En Tránsito / Rescate ------------------
UPDATE clinica.mascota m
SET mascota_estado_id = (
    SELECT id FROM catalogo.mascota_estado WHERE activo AND nombre ILIKE '%rescate%'
)
WHERE m.persona_id = (
        SELECT parametro_valor::integer
        FROM sys.config
        WHERE parametro_nombre = 'PERSONA_ID_TUTOR_EVENTUAL'
    )
  AND m.mascota_estado_id NOT IN (
        SELECT id
        FROM catalogo.mascota_estado
        WHERE activo AND (nombre ILIKE '%rescate%' OR nombre ILIKE 'extraviad%')
    );

COMMIT;

-- Verificación:
-- SELECT config_id, parametro_id, parametro_nombre, parametro_valor
-- FROM sys.config
-- WHERE parametro_nombre IN ('PERSONA_ID_TUTOR_EVENTUAL', 'ESTADOS_MASCOTA_TUTOR_EVENTUAL');
--
-- SELECT m.id, m.nombre, e.nombre AS estado
-- FROM clinica.mascota m
-- JOIN catalogo.mascota_estado e ON e.id = m.mascota_estado_id
-- WHERE m.persona_id = (
--     SELECT parametro_valor::integer FROM sys.config
--     WHERE parametro_nombre = 'PERSONA_ID_TUTOR_EVENTUAL'
-- )
-- ORDER BY m.nombre;
