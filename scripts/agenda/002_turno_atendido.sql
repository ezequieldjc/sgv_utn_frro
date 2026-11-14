-- =============================================================================
-- 002_turno_atendido.sql — Estado 'atendido' del turno; se elimina 'realizado'
-- Ejecutar como DBA (owner de la base), NUNCA como fastapi_app.
--
-- Al firmar la consulta, el backend pasa el turno a 'atendido'.
-- Los turnos en 'realizado' se convierten a 'atendido'.
-- Un turno atendido sigue ocupando su franja.
-- REQUIERE actualizar el backend y el frontend de agenda (usan 'realizado').
--
-- Historial:
--   - main (Neon): aplicado el 14/11/2026 (no había turnos en 'realizado').
-- =============================================================================

BEGIN;

-- 1. Se quitan las restricciones que mencionan 'realizado'
ALTER TABLE agenda.turno DROP CONSTRAINT "CK_Turno_Estado";
ALTER TABLE agenda.turno DROP CONSTRAINT "EX_Turno_SinSuperposicion";
ALTER TABLE agenda.turno DROP CONSTRAINT "EX_Turno_MascotaSinSuperposicion";

-- 2. Datos existentes
UPDATE agenda.turno SET estado = 'atendido' WHERE estado = 'realizado';

-- 3. Estados permitidos
ALTER TABLE agenda.turno ADD CONSTRAINT "CK_Turno_Estado"
    CHECK (estado IN ('solicitado','confirmado','atendido','cancelado','no_asistio'));

-- 4. Sin superposición por veterinario
ALTER TABLE agenda.turno ADD CONSTRAINT "EX_Turno_SinSuperposicion"
    EXCLUDE USING gist (
        veterinario_id WITH =,
        tstzrange(fecha_hora_inicio, fecha_hora_fin, '[)') WITH &&
    ) WHERE (estado IN ('solicitado','confirmado','atendido'));

-- 5. Sin superposición por mascota
ALTER TABLE agenda.turno ADD CONSTRAINT "EX_Turno_MascotaSinSuperposicion"
    EXCLUDE USING gist (
        mascota_id WITH =,
        tstzrange(fecha_hora_inicio, fecha_hora_fin, '[)') WITH &&
    ) WHERE (estado IN ('solicitado','confirmado','atendido'));

COMMIT;

-- Verificación:
-- SELECT estado, count(*) FROM agenda.turno GROUP BY estado;
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
-- WHERE conrelid = 'agenda.turno'::regclass AND contype IN ('c','x');
