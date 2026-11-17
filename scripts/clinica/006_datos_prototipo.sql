-- =============================================================================
-- 006_datos_prototipo.sql — Datos mínimos para el prototipo de la consulta
-- Ejecutar como DBA (owner de la base), NUNCA como fastapi_app.
--
-- Solo datos (INSERT / UPDATE): no cambia la estructura. Se puede correr más de una vez.
-- Prepara lo que necesita la consulta con dictado y diagnóstico SIMULADOS:
--   1. Permisos de consultas para el rol VETERINARIO (hoy no los tiene ningún rol).
--   2. Código, talla y peso de referencia de las razas del prototipo.
--   3. Catálogo de 20 signos.
--   4. Cinco patologías.
-- Los códigos coinciden con backend/app/services/nlp_simulado.py y motor_simulado.py.
-- Si se cambia un código acá, hay que cambiarlo también allá (y al revés).
--
-- Historial:
--   - pendiente de aplicar en main (Neon).
-- =============================================================================

BEGIN;

-- 1. Permisos de consultas para VETERINARIO -----------------------------------
INSERT INTO auth.rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
FROM auth.rol r
CROSS JOIN auth.permiso p
WHERE r.nombre = 'VETERINARIO'
  AND p.nombre IN (
      'consultas:crear',
      'consultas:firmar',
      'consultas:ver_historial',
      'consultas:ver_historia_clinica',
      'consultas:editar_historia_clinica'
  )
ON CONFLICT DO NOTHING;

-- Cambiaron los permisos del rol: se invalidan las sesiones abiertas (regla de version_token).
UPDATE auth.usuario
SET version_token = version_token + 1
WHERE rol_id = (SELECT id FROM auth.rol WHERE nombre = 'VETERINARIO');

-- 2. Razas del prototipo --------------------------------------------------------
UPDATE clinica.raza AS r
SET codigo = v.codigo,
    talla = v.talla,
    peso_referencia_kg = v.peso_referencia_kg
FROM (VALUES
    ('Labrador Retriever',    'labrador-retriever',  'grande',  30.00),
    ('Pastor Alemán',         'german-shepherd-dog', 'grande',  32.00),
    ('Bulldog Francés',       'french-bulldog',      'chica',   11.00),
    ('Caniche Standard',      'poodle-standard',     'mediana', 25.00),
    ('Caniche Toy',           'poodle-toy',          'chica',    3.00),
    ('Cocker Spaniel Inglés', 'cocker-spaniel',      'mediana', 13.00)
) AS v (nombre, codigo, talla, peso_referencia_kg)
WHERE r.nombre = v.nombre
  AND r.especie_id = (SELECT id FROM clinica.especie WHERE nombre = 'Canina');

-- 3. Catálogo de signos ---------------------------------------------------------
INSERT INTO clinica.sintoma (codigo, nombre_es, sistema, tipo) VALUES
    ('estertor_ronquido',      'Ronquido / estertor',          'respiratorio',       'observable'),
    ('intolerancia_ejercicio', 'Intolerancia al ejercicio',    'general',            'observable'),
    ('disnea',                 'Dificultad respiratoria',      'respiratorio',       'examen'),
    ('cianosis',               'Cianosis',                     'respiratorio',       'examen'),
    ('sincope',                'Síncope (desmayo)',            'cardiovascular',     'observable'),
    ('regurgitacion',          'Regurgitación',                'digestivo',          'observable'),
    ('tos',                    'Tos',                          'respiratorio',       'observable'),
    ('vomito',                 'Vómitos',                      'digestivo',          'observable'),
    ('diarrea',                'Diarrea',                      'digestivo',          'observable'),
    ('decaimiento',            'Decaimiento',                  'general',            'observable'),
    ('inapetencia',            'Inapetencia',                  'digestivo',          'observable'),
    ('fiebre',                 'Fiebre',                       'general',            'examen'),
    ('dolor_abdominal',        'Dolor abdominal',              'digestivo',          'examen'),
    ('claudicacion',           'Claudicación (renguera)',      'musculoesqueletico', 'observable'),
    ('dolor_cadera',           'Dolor de cadera',              'musculoesqueletico', 'examen'),
    ('dificultad_levantarse',  'Dificultad para levantarse',   'musculoesqueletico', 'observable'),
    ('prurito',                'Prurito (picazón)',            'piel',               'observable'),
    ('lamido_patas',           'Lamido de patas',              'piel',               'observable'),
    ('sacudida_cabeza',        'Sacudida de cabeza',           'oido',               'observable'),
    ('secrecion_otica',        'Secreción en el oído',         'oido',               'examen')
ON CONFLICT (codigo) DO NOTHING;

-- 4. Patologías -----------------------------------------------------------------
INSERT INTO clinica.patologia
    (codigo, nombre, nombre_en, categoria, nivel_gravedad,
     prevalencia, prevalencia_nivel, solo_razas_predispuestas)
VALUES
    ('brachycephalic-obstructive-airway-syndrome', 'Síndrome braquicefálico',
     'Brachycephalic obstructive airway syndrome', 'Respiratorio', 'Alta',
     0.01000, 'baja', TRUE),
    ('acute-gastroenteritis', 'Gastroenteritis aguda',
     'Acute gastroenteritis', 'Digestivo', 'Moderada',
     0.05000, 'alta', FALSE),
    ('hip-dysplasia', 'Displasia de cadera',
     'Hip dysplasia', 'Musculoesquelético', 'Moderada',
     0.02000, 'media', FALSE),
    ('otitis-externa', 'Otitis externa',
     'Otitis externa', 'Oído', 'Baja',
     0.04000, 'media', FALSE),
    ('atopic-dermatitis', 'Dermatitis atópica',
     'Atopic dermatitis', 'Piel', 'Baja',
     0.03000, 'media', FALSE)
ON CONFLICT (codigo) DO NOTHING;

COMMIT;

-- Verificación:
-- SELECT r.nombre, p.nombre FROM auth.rol_permiso rp
--   JOIN auth.rol r ON r.id = rp.rol_id JOIN auth.permiso p ON p.id = rp.permiso_id
--   WHERE p.nombre LIKE 'consultas:%' ORDER BY 1, 2;                    -- 5 filas de VETERINARIO
-- SELECT nombre, codigo, talla, peso_referencia_kg FROM clinica.raza WHERE codigo IS NOT NULL;  -- 6
-- SELECT count(*) FROM clinica.sintoma;                                -- 20
-- SELECT codigo, nombre, prevalencia FROM clinica.patologia ORDER BY 1; -- 5
