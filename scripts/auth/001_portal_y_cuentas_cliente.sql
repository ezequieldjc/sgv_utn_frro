-- =============================================================================
-- 001_portal_y_cuentas_cliente.sql — Portal del cliente, cuentas por mail y permisos pendientes
-- Ejecutar como DBA (owner de la base), NUNCA como fastapi_app. Se puede correr más de una vez.
--
-- 1. DDL: el usuario de un cliente es su mail (core.persona.mail es varchar(100)), así que
--    auth.usuario.username y auth.login.username_ingresado pasan de 50 a 100.
-- 2. Permiso portal:ver (solo lectura de lo propio) para el rol CLIENTE.
-- 3. Pendientes: ventas:ver para RECEPCIONISTA y agenda:crear_turno para VETERINARIO
--    (este último habilita "Programar control" desde la consulta).
-- 4. Se invalidan las sesiones de los roles cuyos permisos cambiaron (regla de version_token).
--
-- Historial:
--   - 17/11/2026: aplicado en Neon (Facu).
-- =============================================================================
BEGIN;

-- 1. DDL ---------------------------------------------------------------------------
ALTER TABLE auth.usuario ALTER COLUMN username TYPE varchar(100);
ALTER TABLE auth.login   ALTER COLUMN username_ingresado TYPE varchar(100);

-- 2. Permiso del portal, asignado a CLIENTE -----------------------------------------
INSERT INTO auth.permiso (nombre, descripcion)
SELECT 'portal:ver', 'Permite al cliente ver sus mascotas, su historia clínica, sus turnos y sus compras'
WHERE NOT EXISTS (SELECT 1 FROM auth.permiso WHERE nombre = 'portal:ver');

INSERT INTO auth.rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM auth.rol r, auth.permiso p
WHERE r.nombre = 'CLIENTE' AND p.nombre = 'portal:ver'
ON CONFLICT DO NOTHING;

-- 3. Pendientes ----------------------------------------------------------------------
INSERT INTO auth.rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM auth.rol r, auth.permiso p
WHERE (r.nombre = 'RECEPCIONISTA' AND p.nombre = 'ventas:ver')
   OR (r.nombre = 'VETERINARIO'   AND p.nombre = 'agenda:crear_turno')
ON CONFLICT DO NOTHING;

-- 4. Invalidación de sesiones ------------------------------------------------------------
UPDATE auth.usuario SET version_token = version_token + 1
WHERE rol_id IN (SELECT id FROM auth.rol WHERE nombre IN ('CLIENTE', 'RECEPCIONISTA', 'VETERINARIO'));

COMMIT;
