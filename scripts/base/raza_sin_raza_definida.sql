-- Inserta "Sin raza definida" por cada especie de clinica.especie
-- Idempotente: no duplica si ya existe el mismo nombre para esa especie.
-- Ejecutar como DBA o rol con INSERT en clinica.raza.

BEGIN;

INSERT INTO clinica.raza (especie_id, nombre, descripcion, activo)
SELECT
  e.id,
  'Sin raza definida',
  'Raza comodín para altas rápidas cuando no se conoce la raza',
  true
FROM clinica.especie e
WHERE NOT EXISTS (
  SELECT 1
  FROM clinica.raza r
  WHERE r.especie_id = e.id
    AND lower(r.nombre) = lower('Sin raza definida')
);

-- Nombre canónico para el default de raza en alta de mascota
-- (misma familia SISTEMA que PERSONA_ID_TUTOR_EVENTUAL)
INSERT INTO sys.config (config_id, config_nombre, parametro_id, parametro_nombre, parametro_valor)
SELECT
  3,
  'SISTEMA',
  2,
  'RAZA_NOMBRE_DEFAULT',
  'Sin raza definida'
WHERE NOT EXISTS (
  SELECT 1
  FROM sys.config c
  WHERE c.parametro_nombre = 'RAZA_NOMBRE_DEFAULT'
);

COMMIT;

-- Verificación:
-- SELECT e.id, e.nombre AS especie, r.id AS raza_id, r.nombre AS raza
-- FROM clinica.especie e
-- JOIN clinica.raza r ON r.especie_id = e.id
-- WHERE lower(r.nombre) = lower('Sin raza definida')
-- ORDER BY e.id;
--
-- SELECT * FROM sys.config
-- WHERE parametro_nombre = 'RAZA_NOMBRE_DEFAULT';
