-- =============================================================================
-- 002_portal_crear_mascota.sql — El cliente da de alta sus mascotas desde el portal
-- Ejecutar como DBA (owner de la base), NUNCA como fastapi_app.
--
-- Solo datos (INSERT / UPDATE): no cambia la estructura. Se puede correr más de una vez.
--
-- Reglas (backend/app/services/portal_service.py):
--   - El cliente carga nombre, especie, raza, sexo y fecha de nacimiento. El dueño es siempre la
--     persona de la sesión y la mascota nace ACTIVA. Peso, microchip, alertas médicas y estado los
--     carga la clínica.
--   - Reemplaza la regla anterior "el cliente no da de alta mascotas" (decisión del equipo,
--     18/11/2026).
--
-- Este script:
--   1. Crea el permiso portal:crear_mascota y se lo asigna al rol CLIENTE.
--   2. Invalida las sesiones de los usuarios CLIENTE (cambiaron sus permisos).
--
-- Historial:
--   - pendiente de aplicar en Neon.
-- =============================================================================

BEGIN;

-- 1. Permiso, asignado a CLIENTE ------------------------------------------------------------
INSERT INTO auth.permiso (nombre, descripcion)
SELECT 'portal:crear_mascota', 'Permite al cliente dar de alta sus mascotas desde el portal'
WHERE NOT EXISTS (SELECT 1 FROM auth.permiso WHERE nombre = 'portal:crear_mascota');

INSERT INTO auth.rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id FROM auth.rol r, auth.permiso p
WHERE r.nombre = 'CLIENTE' AND p.nombre = 'portal:crear_mascota'
ON CONFLICT DO NOTHING;

-- 2. Invalidación de sesiones ------------------------------------------------------------------
UPDATE auth.usuario SET version_token = version_token + 1
WHERE rol_id IN (SELECT id FROM auth.rol WHERE nombre = 'CLIENTE');

COMMIT;
