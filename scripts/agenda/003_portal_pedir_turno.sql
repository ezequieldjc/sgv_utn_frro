-- =============================================================================
-- 003_portal_pedir_turno.sql — El cliente pide y cancela turnos desde el portal
-- Ejecutar como DBA (owner de la base), NUNCA como fastapi_app.
--
-- Solo datos (INSERT / UPDATE): no cambia la estructura. Se puede correr más de una vez.
--
-- Reglas (backend/app/services/portal_service.py):
--   - El cliente pide turnos solo para sus mascotas y solo de los tipos del parámetro
--     TIPOS_TURNO_PORTAL. El turno nace 'solicitado' con canal_origen 'portal'; lo confirma la
--     clínica (agenda:editar_turno).
--   - El cliente solo puede cancelar un turno suyo que siga 'solicitado'. Uno confirmado se
--     cancela llamando a la clínica.
--   - El cliente no da de alta mascotas: se registran en el mostrador.
--
-- Este script:
--   1. Crea el permiso portal:pedir_turno y se lo asigna al rol CLIENTE.
--   2. Crea el parámetro TIPOS_TURNO_PORTAL (AGENDA) con los ids de Consulta, Control y
--      Vacunación. Los busca por nombre, sin importar mayúsculas ni tildes. Cirugía queda afuera:
--      la indica el veterinario.
--   3. Invalida las sesiones de los usuarios CLIENTE (cambiaron sus permisos).
--
-- Historial:
--   - pendiente de aplicar en Neon.
-- =============================================================================

BEGIN;

-- 0. Tienen que existir los tres tipos de turno activos. Si no, se cancela todo. -------------
DO $$
DECLARE
    encontrados integer;
BEGIN
    SELECT count(*) INTO encontrados
    FROM agenda.tipo_turno
    WHERE activo
      AND (nombre ILIKE 'consulta' OR nombre ILIKE 'control' OR nombre ILIKE 'vacunaci%');

    IF encontrados <> 3 THEN
        RAISE EXCEPTION
            'Se esperaban los tipos de turno activos Consulta, Control y Vacunación (encontrados: %)',
            encontrados;
    END IF;
END $$;

-- 1. Permiso portal:pedir_turno para CLIENTE ------------------------------------------------
INSERT INTO auth.permiso (nombre, descripcion)
SELECT 'portal:pedir_turno',
       'Permite al cliente pedir turnos para sus mascotas y cancelar los que siguen solicitados'
WHERE NOT EXISTS (SELECT 1 FROM auth.permiso WHERE nombre = 'portal:pedir_turno');

INSERT INTO auth.rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM auth.rol r, auth.permiso p
WHERE r.nombre = 'CLIENTE' AND p.nombre = 'portal:pedir_turno'
ON CONFLICT DO NOTHING;

-- 2. Parámetro TIPOS_TURNO_PORTAL (config 4, AGENDA) ----------------------------------------
INSERT INTO sys.config (config_id, config_nombre, parametro_id, parametro_nombre, parametro_valor)
SELECT
    4,
    'AGENDA',
    (SELECT COALESCE(MAX(parametro_id), 0) + 1 FROM sys.config WHERE config_id = 4),
    'TIPOS_TURNO_PORTAL',
    (SELECT string_agg(id::text, ',' ORDER BY id)
     FROM agenda.tipo_turno
     WHERE activo
       AND (nombre ILIKE 'consulta' OR nombre ILIKE 'control' OR nombre ILIKE 'vacunaci%'))
WHERE NOT EXISTS (SELECT 1 FROM sys.config WHERE parametro_nombre = 'TIPOS_TURNO_PORTAL');

-- 3. Invalidación de sesiones (regla de version_token) ---------------------------------------
UPDATE auth.usuario SET version_token = version_token + 1
WHERE rol_id = (SELECT id FROM auth.rol WHERE nombre = 'CLIENTE');

COMMIT;

-- Verificación:
-- SELECT r.nombre AS rol, p.nombre AS permiso
-- FROM auth.rol_permiso rp
-- JOIN auth.rol r ON r.id = rp.rol_id
-- JOIN auth.permiso p ON p.id = rp.permiso_id
-- WHERE r.nombre = 'CLIENTE';
--
-- SELECT c.parametro_id, c.parametro_nombre, c.parametro_valor
-- FROM sys.config c WHERE c.parametro_nombre = 'TIPOS_TURNO_PORTAL';
--
-- SELECT id, nombre FROM agenda.tipo_turno ORDER BY id;
