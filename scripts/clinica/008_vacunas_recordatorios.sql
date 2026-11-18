-- =============================================================================
-- 008_vacunas_recordatorios.sql — Vacunas/desparasitaciones y recordatorios
-- Ejecutar como DBA (owner de la base), NUNCA como fastapi_app.
-- Requiere 005 (consulta), agenda/002 (turno) y stock/001 (producto y venta).
--
-- Se puede correr más de una vez: si las tablas ya existen, solo completa lo que falte.
-- Si algo falla, no queda nada aplicado (una sola transacción).
--
--   1. clinica.tratamiento_preventivo: cada vacuna o desparasitación aplicada. Si se
--      aplicó en la clínica apunta al producto del stock (y a la venta si se cobró); si es
--      una dosis anterior (libreta, otra veterinaria) solo guarda el nombre.
--      fecha_proxima_dosis es la "fecha_vencimiento" de la 3ra entrega: cuándo vence la
--      protección. refuerzo_de_id dice qué dosis anterior completa esta aplicación, así la
--      anterior deja de generar recordatorios.
--   2. agenda.recordatorio: cada recordatorio enviado (de turno o de dosis). En el
--      prototipo el envío lo hace la recepción con WhatsApp (link wa.me) y acá queda el
--      registro; la Fase 2 suma el envío automático con los estados 'pendiente' y 'error'.
--   3. Permisos vacunas:ver, vacunas:registrar y recordatorios:enviar.
--   4. Parámetros del grupo PREVENTIVA (días de refuerzo y de aviso).
--   5. Código, talla y peso de referencia del Shar Pei para el motor simulado
--      (datos de demostración: Felipe y Simón).
--
-- ORDEN: se puede correr antes o después de desplegar el código. El código viejo no usa
-- nada de esto, y el nuevo necesita el script para vacunas y recordatorios (la receta en
-- PDF no depende de él).
--
-- Historial:
--   - pendiente de aplicar en Neon.
-- =============================================================================

BEGIN;

-- 1. Vacunas y desparasitaciones aplicadas ------------------------------------
CREATE TABLE IF NOT EXISTS clinica.tratamiento_preventivo (
    id                   SERIAL PRIMARY KEY,
    mascota_id           INTEGER      NOT NULL REFERENCES clinica.mascota(id),
    tipo                 VARCHAR(20)  NOT NULL,
    producto_id          INTEGER      REFERENCES stock.producto(id),
    nombre_producto      VARCHAR(100) NOT NULL,
    fecha_aplicacion     DATE         NOT NULL,
    fecha_proxima_dosis  DATE,
    lote                 VARCHAR(50),
    peso_kg              NUMERIC(5,2),
    refuerzo_de_id       INTEGER      REFERENCES clinica.tratamiento_preventivo(id),
    consulta_id          INTEGER      REFERENCES clinica.consulta(id),
    turno_id             INTEGER      REFERENCES agenda.turno(id),
    venta_id             INTEGER      REFERENCES comercial.venta(id),
    usuario_id           INTEGER      NOT NULL REFERENCES auth.usuario(id),
    observaciones        VARCHAR(255),
    fecha_registro       TIMESTAMPTZ  NOT NULL DEFAULT now(),
    CONSTRAINT "CK_TratPreventivo_Tipo"     CHECK (tipo IN ('vacunacion','desparasitacion')),
    CONSTRAINT "CK_TratPreventivo_Proxima"  CHECK (fecha_proxima_dosis IS NULL
                                                   OR fecha_proxima_dosis > fecha_aplicacion),
    CONSTRAINT "CK_TratPreventivo_Peso"     CHECK (peso_kg IS NULL OR (peso_kg > 0 AND peso_kg <= 150)),
    CONSTRAINT "CK_TratPreventivo_Venta"    CHECK (venta_id IS NULL OR producto_id IS NOT NULL),
    CONSTRAINT "CK_TratPreventivo_Refuerzo" CHECK (refuerzo_de_id IS NULL OR refuerzo_de_id <> id)
);

CREATE INDEX IF NOT EXISTS "IX_TratPreventivo_MascotaFecha"
    ON clinica.tratamiento_preventivo (mascota_id, fecha_aplicacion DESC);
CREATE INDEX IF NOT EXISTS "IX_TratPreventivo_Proxima"
    ON clinica.tratamiento_preventivo (fecha_proxima_dosis)
    WHERE fecha_proxima_dosis IS NOT NULL;
-- Una dosis se completa con un solo refuerzo.
CREATE UNIQUE INDEX IF NOT EXISTS "UQ_TratPreventivo_Refuerzo"
    ON clinica.tratamiento_preventivo (refuerzo_de_id)
    WHERE refuerzo_de_id IS NOT NULL;

-- 2. Recordatorios enviados ------------------------------------------------------
CREATE TABLE IF NOT EXISTS agenda.recordatorio (
    id                         SERIAL PRIMARY KEY,
    tipo                       VARCHAR(20)  NOT NULL,
    turno_id                   INTEGER      REFERENCES agenda.turno(id),
    tratamiento_preventivo_id  INTEGER      REFERENCES clinica.tratamiento_preventivo(id),
    persona_id                 INTEGER      NOT NULL REFERENCES core.persona(id),
    canal                      VARCHAR(20)  NOT NULL DEFAULT 'whatsapp',
    destino                    VARCHAR(30)  NOT NULL,
    mensaje                    TEXT         NOT NULL,
    estado                     VARCHAR(20)  NOT NULL DEFAULT 'enviado',
    fecha_envio                TIMESTAMPTZ  NOT NULL DEFAULT now(),
    usuario_id                 INTEGER      REFERENCES auth.usuario(id),
    CONSTRAINT "CK_Recordatorio_Tipo"   CHECK (tipo IN ('turno','dosis')),
    CONSTRAINT "CK_Recordatorio_Origen" CHECK (
        (tipo = 'turno' AND turno_id IS NOT NULL AND tratamiento_preventivo_id IS NULL)
        OR (tipo = 'dosis' AND tratamiento_preventivo_id IS NOT NULL AND turno_id IS NULL)
    ),
    CONSTRAINT "CK_Recordatorio_Canal"  CHECK (canal IN ('whatsapp')),
    CONSTRAINT "CK_Recordatorio_Estado" CHECK (estado IN ('pendiente','enviado','error'))
);

CREATE INDEX IF NOT EXISTS "IX_Recordatorio_Turno"
    ON agenda.recordatorio (turno_id) WHERE turno_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS "IX_Recordatorio_Dosis"
    ON agenda.recordatorio (tratamiento_preventivo_id) WHERE tratamiento_preventivo_id IS NOT NULL;

-- 3. Permisos ----------------------------------------------------------------------
INSERT INTO auth.permiso (nombre, descripcion) VALUES
('vacunas:ver',          'Permite ver las vacunas y desparasitaciones de una mascota'),
('vacunas:registrar',    'Permite registrar la aplicación de una vacuna o desparasitación'),
('recordatorios:enviar', 'Permite ver los recordatorios pendientes y enviarlos por WhatsApp')
ON CONFLICT (nombre) DO NOTHING;

-- Se asignan según lo que cada rol ya hace, sin depender de los nombres de los roles:
--   - quien atiende consultas (consultas:crear) ve y registra vacunas;
--   - quien agenda turnos (agenda:crear_turno) ve las vacunas y envía los recordatorios.
-- ADMIN ya tiene el comodín '*'. Si un rol recibe un permiso nuevo, sus sesiones abiertas se
-- invalidan (regla de version_token); si el script se corre de nuevo, no cambia nada.
WITH asignaciones (permiso_requerido, permiso_nuevo) AS (
    VALUES
        ('consultas:crear',    'vacunas:ver'),
        ('consultas:crear',    'vacunas:registrar'),
        ('agenda:crear_turno', 'vacunas:ver'),
        ('agenda:crear_turno', 'recordatorios:enviar')
),
nuevos AS (
    INSERT INTO auth.rol_permiso (rol_id, permiso_id)
    SELECT DISTINCT rp.rol_id, pn.id
    FROM asignaciones a
    JOIN auth.permiso pr ON pr.nombre = a.permiso_requerido
    JOIN auth.rol_permiso rp ON rp.permiso_id = pr.id
    JOIN auth.permiso pn ON pn.nombre = a.permiso_nuevo
    ON CONFLICT DO NOTHING
    RETURNING rol_id
)
UPDATE auth.usuario
SET version_token = version_token + 1
WHERE rol_id IN (SELECT rol_id FROM nuevos);

-- 4. Parámetros (grupo PREVENTIVA) --------------------------------------------------
--   DIAS_REFUERZO_VACUNA / DIAS_REFUERZO_DESPARASITACION: próxima dosis que se propone.
--   DIAS_AVISO_DOSIS: cuántos días antes del vencimiento aparece el recordatorio.
--   DIAS_AVISO_DOSIS_VENCIDA: hasta cuántos días después de vencida se sigue recordando.
DO $$
DECLARE
    v_config_id INTEGER;
BEGIN
    SELECT config_id INTO v_config_id
    FROM sys.config
    WHERE config_nombre = 'PREVENTIVA'
    LIMIT 1;

    IF v_config_id IS NULL THEN
        SELECT COALESCE(MAX(config_id), 0) + 1 INTO v_config_id FROM sys.config;
    END IF;

    INSERT INTO sys.config (config_id, config_nombre, parametro_id, parametro_nombre, parametro_valor)
    SELECT
        v_config_id,
        'PREVENTIVA',
        (SELECT COALESCE(MAX(parametro_id), 0) FROM sys.config WHERE config_id = v_config_id)
            + ROW_NUMBER() OVER (ORDER BY v.orden),
        v.nombre,
        v.valor
    FROM (VALUES
        (1, 'DIAS_REFUERZO_VACUNA',          '365'),
        (2, 'DIAS_REFUERZO_DESPARASITACION', '90'),
        (3, 'DIAS_AVISO_DOSIS',              '7'),
        (4, 'DIAS_AVISO_DOSIS_VENCIDA',      '30')
    ) AS v (orden, nombre, valor)
    WHERE NOT EXISTS (SELECT 1 FROM sys.config c WHERE c.parametro_nombre = v.nombre);
END $$;

-- 5. Shar Pei en el motor simulado (solo si todavía no tiene código) --------------------
UPDATE clinica.raza
SET codigo = 'chinese-shar-pei',
    talla = 'mediana',
    peso_referencia_kg = 22.00
WHERE nombre = 'Shar Pei'
  AND codigo IS NULL
  AND especie_id = (SELECT id FROM clinica.especie WHERE nombre = 'Canina');

-- 6. Permisos para fastapi_app ------------------------------------------------------
GRANT SELECT, INSERT, UPDATE, DELETE ON
    clinica.tratamiento_preventivo, agenda.recordatorio
    TO fastapi_app;
GRANT USAGE, SELECT ON SEQUENCE
    clinica.tratamiento_preventivo_id_seq, agenda.recordatorio_id_seq
    TO fastapi_app;

COMMIT;

-- Verificación:
-- SELECT table_schema, table_name FROM information_schema.tables
--   WHERE table_name IN ('tratamiento_preventivo', 'recordatorio');                   -- 2 filas
-- SELECT r.nombre, p.nombre FROM auth.rol_permiso rp
--   JOIN auth.rol r ON r.id = rp.rol_id JOIN auth.permiso p ON p.id = rp.permiso_id
--   WHERE p.nombre LIKE 'vacunas:%' OR p.nombre = 'recordatorios:enviar' ORDER BY 1, 2;
-- SELECT config_id, parametro_id, parametro_nombre, parametro_valor
--   FROM sys.config WHERE config_nombre = 'PREVENTIVA' ORDER BY parametro_id;          -- 4 filas
-- SELECT nombre, codigo, talla, peso_referencia_kg FROM clinica.raza WHERE nombre = 'Shar Pei';
