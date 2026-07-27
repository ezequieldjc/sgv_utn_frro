-- Script de carga inicial de permisos y relaciones rol_permiso.
-- Ejecutar contra la base de datos `sgv`.

BEGIN;
insert into sgv.auth.rol (nombre, descripcion) values ('ADMIN','super usuario');
insert into sgv.auth.rol (nombre, descripcion) values ('DIRECCION','Usuario Director');
insert into sgv.auth.rol (nombre, descripcion) values ('VETERINARIO','Veterinario');
insert into sgv.auth.rol (nombre, descripcion) values ('RECEPCIONISTA','Recepcionista');
insert into sgv.auth.rol (nombre, descripcion) values ('INVENTARIO','Inventario');

INSERT INTO auth.permiso (nombre, descripcion)
VALUES
    ('pacientes:read', 'Ver pacientes'),
    ('pacientes:create', 'Crear pacientes'),
    ('duenos:read', 'Ver dueños'),
    ('duenos:create', 'Crear dueños'),
    ('turnos:read', 'Ver turnos'),
    ('turnos:create', 'Crear turnos'),
    ('atenciones:read', 'Ver atenciones'),
    ('atenciones:create', 'Crear atenciones'),
    ('stock:read', 'Ver stock e insumos'),
    ('stock:create', 'Crear stock e insumos'),
    ('stock:update', 'Actualizar stock e insumos'),
    ('stock:delete', 'Eliminar stock e insumos'),
    ('configuracion:read', 'Ver configuración del sistema'),
    ('configuracion:update', 'Actualizar configuración del sistema'),
    ('usuarios:read', 'Ver usuarios del sistema'),
    ('usuarios:create', 'Crear usuarios del sistema'),
    ('usuarios:update', 'Actualizar usuarios del sistema'),
    ('usuarios:delete', 'Eliminar usuarios del sistema')
ON CONFLICT (nombre) DO NOTHING;

INSERT INTO auth.rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
FROM auth.rol AS r
JOIN auth.permiso AS p ON p.nombre IN (
    'pacientes:read',
    'pacientes:create',
    'duenos:read',
    'duenos:create',
    'turnos:read',
    'turnos:create',
    'atenciones:read',
    'atenciones:create',
    'stock:read',
    'stock:create',
    'stock:update',
    'stock:delete',
    'configuracion:read',
    'configuracion:update',
    'usuarios:read',
    'usuarios:create',
    'usuarios:update',
    'usuarios:delete'
)
WHERE r.nombre IN ('ADMIN', 'DIRECCION')
ON CONFLICT DO NOTHING;

INSERT INTO auth.rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
FROM auth.rol AS r
JOIN auth.permiso AS p ON p.nombre IN (
    'pacientes:read',
    'pacientes:create',
    'duenos:read',
    'duenos:create',
    'turnos:read',
    'turnos:create',
    'atenciones:read',
    'atenciones:create'
)
WHERE r.nombre IN ('VETERINARIO', 'RECEPCIONISTA')
ON CONFLICT DO NOTHING;

INSERT INTO auth.rol_permiso (rol_id, permiso_id)
SELECT r.id, p.id
FROM auth.rol AS r
JOIN auth.permiso AS p ON p.nombre IN (
    'stock:read',
    'stock:create',
    'stock:update',
    'stock:delete'
)
WHERE r.nombre = 'INVENTARIO'
ON CONFLICT DO NOTHING;

COMMIT;
