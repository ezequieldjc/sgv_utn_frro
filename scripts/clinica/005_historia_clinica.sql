-- =============================================================================
-- 005_historia_clinica.sql — Consulta, dictado, signos y diagnósticos
-- Ejecutar como DBA (owner de la base), NUNCA como fastapi_app.
-- Requiere 001 (patologia) y 004 (sintoma).
--
-- La consulta nace en borrador y la firma la cierra.
-- Una consulta puede tener varios dictados (uno por grabación).
-- Solo se guardan los diagnósticos que el veterinario acepta: uno principal
-- y los secundarios que quiera conservar.
--
-- Historial:
--   - main (Neon): aplicado el 14/11/2026. Reglas verificadas con una prueba
--     de 25 casos dentro de una transacción que se deshizo.
-- =============================================================================

BEGIN;

-- 1. Consulta
CREATE TABLE clinica.consulta (
    id                  SERIAL PRIMARY KEY,
    mascota_id          INTEGER      NOT NULL REFERENCES clinica.mascota(id),
    veterinario_id      INTEGER      NOT NULL REFERENCES auth.usuario(id),
    turno_id            INTEGER      REFERENCES agenda.turno(id),
    fecha_hora          TIMESTAMPTZ  NOT NULL,
    motivo              TEXT,
    anamnesis           TEXT,
    examen_fisico       TEXT,
    peso_kg             NUMERIC(5,2),
    temperatura_c       NUMERIC(4,1),
    tratamiento         TEXT,
    observaciones       TEXT,
    estado              VARCHAR(20)  NOT NULL DEFAULT 'borrador',
    consulta_padre_id   INTEGER      REFERENCES clinica.consulta(id),
    fecha_firma         TIMESTAMPTZ,
    fecha_creacion      TIMESTAMPTZ  DEFAULT now(),
    fecha_modificacion  TIMESTAMPTZ,
    CONSTRAINT "UQ_Consulta_Turno"       UNIQUE (turno_id),
    CONSTRAINT "CK_Consulta_Estado"      CHECK (estado IN ('borrador','firmada')),
    CONSTRAINT "CK_Consulta_Firma"       CHECK ((estado = 'firmada') = (fecha_firma IS NOT NULL)),
    CONSTRAINT "CK_Consulta_Peso"        CHECK (peso_kg IS NULL OR (peso_kg > 0 AND peso_kg <= 150)),
    CONSTRAINT "CK_Consulta_Temperatura" CHECK (temperatura_c IS NULL OR temperatura_c BETWEEN 30 AND 45)
);

CREATE INDEX "IX_Consulta_MascotaFecha" ON clinica.consulta (mascota_id, fecha_hora DESC);
CREATE INDEX "IX_Consulta_Veterinario"  ON clinica.consulta (veterinario_id);

-- 2. Dictado: una fila por grabación, nunca se edita. Una consulta puede tener varios.
CREATE TABLE clinica.dictado (
    id                SERIAL PRIMARY KEY,
    consulta_id       INTEGER      NOT NULL REFERENCES clinica.consulta(id) ON DELETE CASCADE,
    transcripcion     TEXT         NOT NULL,
    extraccion_json   JSONB        NOT NULL,
    modelo_stt        VARCHAR(60)  NOT NULL,
    modelo_llm        VARCHAR(60),
    version_prompt    VARCHAR(20),
    duracion_audio_s  NUMERIC(6,1),
    latencia_stt_ms   INTEGER,
    latencia_llm_ms   INTEGER,
    fecha_creacion    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX "IX_Dictado_Consulta" ON clinica.dictado (consulta_id, fecha_creacion);

-- 3. Signos de la consulta, presentes o negados
CREATE TABLE clinica.consulta_sintoma (
    id              SERIAL PRIMARY KEY,
    consulta_id     INTEGER      NOT NULL REFERENCES clinica.consulta(id) ON DELETE CASCADE,
    sintoma_id      INTEGER      REFERENCES clinica.sintoma(id),
    dictado_id      INTEGER      REFERENCES clinica.dictado(id) ON DELETE SET NULL,
    texto_original  VARCHAR(255) NOT NULL,
    presente        BOOLEAN      NOT NULL DEFAULT TRUE,
    origen          VARCHAR(10)  NOT NULL DEFAULT 'nlp',
    confirmado      BOOLEAN      NOT NULL DEFAULT FALSE,
    fecha_creacion  TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT "CK_ConsultaSintoma_Origen" CHECK (origen IN ('nlp','manual'))
);

-- Una fila por signo con código; los textos sin mapear pueden ser varios
CREATE UNIQUE INDEX "UQ_ConsultaSintoma_Sintoma" ON clinica.consulta_sintoma (consulta_id, sintoma_id)
    WHERE sintoma_id IS NOT NULL;
CREATE INDEX "IX_ConsultaSintoma_Dictado" ON clinica.consulta_sintoma (dictado_id);

-- 4. Diagnósticos aceptados por el veterinario: uno principal y secundarios.
--    Sin ON DELETE CASCADE hacia consulta: una consulta con diagnósticos no se borra.
CREATE TABLE clinica.consulta_diagnostico (
    id                         SERIAL PRIMARY KEY,
    consulta_id                INTEGER      NOT NULL REFERENCES clinica.consulta(id),
    patologia_id               INTEGER      REFERENCES clinica.patologia(id),
    descripcion_libre          VARCHAR(255),
    tipo_diagnostico           VARCHAR(20)  NOT NULL DEFAULT 'secundario',
    origen                     VARCHAR(20)  NOT NULL DEFAULT 'manual',
    ranking                    SMALLINT,
    probabilidad_pct           NUMERIC(5,2),
    explicacion                JSONB,
    version_motor              VARCHAR(20),
    confirmado_por_usuario_id  INTEGER      NOT NULL REFERENCES auth.usuario(id),
    fecha_creacion             TIMESTAMPTZ  DEFAULT now(),
    CONSTRAINT "CK_ConsultaDx_Tipo"      CHECK (tipo_diagnostico IN ('principal','secundario')),
    CONSTRAINT "CK_ConsultaDx_Origen"    CHECK (origen IN ('manual','sugerido_ia')),
    CONSTRAINT "CK_ConsultaDx_Ranking"   CHECK (ranking IS NULL OR ranking BETWEEN 1 AND 3),
    CONSTRAINT "CK_ConsultaDx_Pct"       CHECK (probabilidad_pct IS NULL OR probabilidad_pct BETWEEN 0 AND 100),
    CONSTRAINT "CK_ConsultaDx_Contenido" CHECK (patologia_id IS NOT NULL OR descripcion_libre IS NOT NULL),
    -- Una sugerencia de la IA trae patología, ranking y porcentaje
    CONSTRAINT "CK_ConsultaDx_IA"        CHECK (origen <> 'sugerido_ia'
                                                OR (patologia_id IS NOT NULL AND ranking IS NOT NULL
                                                    AND probabilidad_pct IS NOT NULL)),
    -- Un diagnóstico manual no tiene datos del motor
    CONSTRAINT "CK_ConsultaDx_Manual"    CHECK (origen <> 'manual'
                                                OR (ranking IS NULL AND probabilidad_pct IS NULL
                                                    AND explicacion IS NULL AND version_motor IS NULL))
);

-- Un solo principal por consulta
CREATE UNIQUE INDEX "UQ_ConsultaDx_Principal" ON clinica.consulta_diagnostico (consulta_id)
    WHERE tipo_diagnostico = 'principal';
-- La misma patología no se repite en una consulta
CREATE UNIQUE INDEX "UQ_ConsultaDx_Patologia" ON clinica.consulta_diagnostico (consulta_id, patologia_id)
    WHERE patologia_id IS NOT NULL;
-- Un solo diagnóstico por puesto del top 3
CREATE UNIQUE INDEX "UQ_ConsultaDx_Ranking"   ON clinica.consulta_diagnostico (consulta_id, ranking)
    WHERE ranking IS NOT NULL;

-- 5. Permiso para firmar (pendiente: asignarlo a roles en auth.rol_permiso)
INSERT INTO auth.permiso (nombre, descripcion) VALUES
('consultas:firmar', 'Permite firmar una consulta y cerrarla en solo lectura')
ON CONFLICT (nombre) DO NOTHING;

-- 6. Permisos para fastapi_app
GRANT SELECT, INSERT, UPDATE, DELETE ON
    clinica.consulta, clinica.dictado, clinica.consulta_sintoma, clinica.consulta_diagnostico
    TO fastapi_app;
GRANT USAGE, SELECT ON SEQUENCE
    clinica.consulta_id_seq, clinica.dictado_id_seq,
    clinica.consulta_sintoma_id_seq, clinica.consulta_diagnostico_id_seq
    TO fastapi_app;

COMMIT;

-- Verificación:
-- SELECT table_name FROM information_schema.tables
-- WHERE table_schema = 'clinica' ORDER BY 1;
-- SELECT conname, pg_get_constraintdef(oid) FROM pg_constraint
-- WHERE conrelid = 'clinica.consulta_diagnostico'::regclass ORDER BY 1;
-- SELECT * FROM auth.permiso WHERE nombre = 'consultas:firmar';
