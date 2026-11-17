-- =============================================================================
-- 001_agenda_turno.sql — Módulo Agenda (turnos)
-- Ejecutar como DBA (owner de la base), NUNCA como fastapi_app.
-- fastapi_app solo recibe DML (ver sección 5).
--
-- Historial:
--   - dev-agenda (Neon): secciones 1 a 5 ya aplicadas (script original + ALTER
--     que quitó observaciones/creado_por_id/fecha_creacion y agregó la exclusión
--     por mascota). En esa rama solo falta correr la sección 6.
--   - main: correr el script completo al mergear feature/agenda.
-- =============================================================================

BEGIN;

-- 1. Extensión necesaria para las exclusiones (integer = junto con rango &&)
CREATE EXTENSION IF NOT EXISTS btree_gist;

CREATE SCHEMA IF NOT EXISTS agenda;

-- 2. Tipos de turno y su duración (múltiplos de 30 = módulos de agenda)
CREATE TABLE agenda.tipo_turno (
    id            SERIAL PRIMARY KEY,
    nombre        VARCHAR(50)  NOT NULL,
    duracion_min  INTEGER      NOT NULL,
    activo        BOOLEAN      NOT NULL DEFAULT TRUE,
    CONSTRAINT "UQ_TipoTurno_Nombre" UNIQUE (nombre),
    CONSTRAINT "CK_TipoTurno_Duracion" CHECK (duracion_min > 0 AND duracion_min % 30 = 0)
);

-- 3. Turnos
CREATE TABLE agenda.turno (
    id                 SERIAL PRIMARY KEY,
    mascota_id         INTEGER     NOT NULL REFERENCES clinica.mascota(id),
    veterinario_id     INTEGER     NOT NULL REFERENCES auth.usuario(id),
    tipo_turno_id      INTEGER     NOT NULL REFERENCES agenda.tipo_turno(id),
    fecha_hora_inicio  TIMESTAMPTZ NOT NULL,
    fecha_hora_fin     TIMESTAMPTZ NOT NULL,
    estado             VARCHAR(20) NOT NULL DEFAULT 'solicitado',
    canal_origen       VARCHAR(20) NOT NULL DEFAULT 'mostrador',
    CONSTRAINT "CK_Turno_Estado" CHECK (estado IN ('solicitado','confirmado','realizado','cancelado','no_asistio')),
    CONSTRAINT "CK_Turno_Canal"  CHECK (canal_origen IN ('mostrador','telefono','whatsapp','portal')),
    CONSTRAINT "CK_Turno_Rango"  CHECK (fecha_hora_fin > fecha_hora_inicio),
    -- Un veterinario no puede tener dos turnos activos que se pisen.
    -- cancelado y no_asistio liberan el horario.
    CONSTRAINT "EX_Turno_SinSuperposicion" EXCLUDE USING gist (
        veterinario_id WITH =,
        tstzrange(fecha_hora_inicio, fecha_hora_fin, '[)') WITH &&
    ) WHERE (estado IN ('solicitado','confirmado','realizado')),
    -- Una mascota no puede tener dos turnos activos que se pisen.
    CONSTRAINT "EX_Turno_MascotaSinSuperposicion" EXCLUDE USING gist (
        mascota_id WITH =,
        tstzrange(fecha_hora_inicio, fecha_hora_fin, '[)') WITH &&
    ) WHERE (estado IN ('solicitado','confirmado','realizado'))
);

CREATE INDEX "IX_Turno_FechaInicio" ON agenda.turno (fecha_hora_inicio);
CREATE INDEX "IX_Turno_Mascota"     ON agenda.turno (mascota_id);

-- 4. Datos iniciales
INSERT INTO auth.permiso (nombre, descripcion) VALUES
('agenda:atender', 'Permite ser asignado como veterinario en la agenda de turnos')
ON CONFLICT (nombre) DO NOTHING;

-- Tipos de turno de ejemplo (ajustar cuando la clínica defina los reales)
INSERT INTO agenda.tipo_turno (nombre, duracion_min) VALUES
('Consulta', 30), ('Control', 30), ('Vacunación', 30), ('Cirugía', 90)
ON CONFLICT (nombre) DO NOTHING;

-- 5. Grants DML para fastapi_app (mismo patrón que scripts/base/catalogo_grant_fastapi_app.sql)
GRANT USAGE ON SCHEMA agenda TO fastapi_app;
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA agenda TO fastapi_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA agenda TO fastapi_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA agenda GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO fastapi_app;
ALTER DEFAULT PRIVILEGES IN SCHEMA agenda GRANT USAGE, SELECT ON SEQUENCES TO fastapi_app;

COMMIT;

-- =============================================================================
-- 6. Parámetros de agenda en sys.config (config_id = 4, AGENDA)
--    Formato de horario: franjas "HH:MM-HH:MM" separadas por coma.
--    Día sin parámetro = cerrado (domingo).
-- =============================================================================
BEGIN;

INSERT INTO sys.config (config_id, config_nombre, parametro_id, parametro_nombre, parametro_valor) VALUES
(4, 'AGENDA', 1, 'HORARIO_LUNES_A_VIERNES', '08:00-12:00,15:00-20:00'),
(4, 'AGENDA', 2, 'HORARIO_SABADO',          '08:00-12:00'),
(4, 'AGENDA', 3, 'DURACION_MODULO_MIN',     '30'),
(4, 'AGENDA', 4, 'ZONA_HORARIA',            'America/Argentina/Buenos_Aires')
ON CONFLICT (config_id, parametro_id) DO NOTHING;

COMMIT;

-- Verificación:
-- SELECT has_schema_privilege('fastapi_app', 'agenda', 'USAGE');
-- SELECT * FROM agenda.tipo_turno;
-- SELECT * FROM sys.config WHERE config_id = 4 ORDER BY parametro_id;
