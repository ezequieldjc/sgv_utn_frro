INSERT INTO auth.permiso (nombre, descripcion) VALUES
-- 1. Consultas
('consultas:crear', 'Permite registrar una nueva consulta médica'),
('consultas:ver_historial', 'Permite ver el historial general de consultas'),
('consultas:ver_historia_clinica', 'Permite consultar la historia clínica del paciente'),
('consultas:editar_historia_clinica', 'Permite modificar registros de la historia clínica'),

-- 2. Recetas
('recetas:crear', 'Permite emitir una nueva receta médica'),
('recetas:ver_historial', 'Permite consultar el historial de recetas emitidas'),

-- 3. Agenda
('agenda:ver', 'Permite visualizar la agenda y calendario de turnos'),
('agenda:crear_turno', 'Permite agendar un nuevo turno'),
('agenda:editar_turno', 'Permite modificar datos de un turno agendado'),
('agenda:cancelar_turno', 'Permite cancelar un turno existente'),

-- 4. Mascotas
('mascotas:ver_listado', 'Permite ver el listado general de mascotas'),
('mascotas:crear', 'Permite registrar una nueva mascota'),
('mascotas:editar', 'Permite actualizar la información de una mascota'),
('mascotas:eliminar', 'Permite dar de baja o eliminar una mascota'),

-- 4. Clientes (Dueños)
('clientes:ver_listado', 'Permite ver el listado general de clientes/dueños'),
('clientes:crear', 'Permite registrar un nuevo cliente/dueño'),
('clientes:editar', 'Permite actualizar información de un cliente/dueño'),
('clientes:eliminar', 'Permite dar de baja o eliminar a un cliente/dueño'),

-- 5. Stock e Insumos
('stock:crear_insumo', 'Permite dar de alta nuevos insumos o productos'),
('stock:editar_insumo', 'Permite modificar datos de insumos existentes'),
('stock:registrar_movimiento', 'Permite ingresar, egresar o ajustar stock de insumos'),
('stock:ver_movimientos', 'Permite ver el historial de movimientos de stock'),
('stock:ver_analisis', 'Permite consultar reportes y análisis del estado de stock'),

-- 10. Administración (Admin)
('usuarios:ver', 'Permite ver el listado de usuarios del sistema'),
('usuarios:crear', 'Permite dar de alta a un nuevo usuario del sistema'),
('usuarios:editar', 'Permite modificar datos y permisos asignados a un usuario'),
('usuarios:eliminar', 'Permite desactivar o eliminar a un usuario'),
('roles:ver', 'Permite consultar el listado de roles y sus permisos'),
('roles:crear', 'Permite crear nuevos roles en el sistema'),
('roles:editar', 'Permite modificar asignaciones de permisos a roles existentes'),
('roles:eliminar', 'Permite eliminar roles del sistema'),
('parametros:ver', 'Permite consultar la configuración global del sistema'),
('parametros:editar', 'Permite modificar parámetros generales del sistema'),
('auditoria:ver', 'Permite consultar el registro de eventos y auditoría del sistema')

ON CONFLICT (nombre) DO NOTHING;