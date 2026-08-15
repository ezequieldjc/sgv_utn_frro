@Files [Selecciona el archivo de la tabla de usuarios, el hook/contexto de autenticación y la API de usuarios]

Necesito realizar las siguientes modificaciones en la pantalla de Gestión de Usuarios:

1. Alineación de la columna Acciones:
- Alinea el encabezado y el contenido de la columna "Acciones" a la izquierda (usando `text-left` o la propiedad de alineación del data table), evitando que quede pegado al borde derecho.

2. Estado Habilitar/Inhabilitar con control de permisos:
- Verifica si el usuario logueado cuenta con el permiso `usuarios:editar` (tabla `auth.permiso`). Si no lo tiene, deshabilita u oculta la acción de cambio de estado.
- Lógica según el estado del usuario objetivo (`auth.persona.habilitado`):
  * Si `habilitado` es `true`: Muestra la opción de "Inhabilitar". Al presionar, despliega un modal pidiendo confirmación. Si confirma, actualiza el backend pasando `habilitado` a `false`.
  * Si `habilitado` es `false`: Muestra la opción de "Habilitar". Al presionar, despliega un modal pidiendo confirmación. Si confirma, actualiza el backend pasando `habilitado` a `true`.
- Refresca el listado o actualiza el estado local tras completar la acción con éxito.

3. Ordenamiento en encabezados de la tabla:
- Habilita el ordenamiento ascendente/descendente al hacer clic en los encabezados de:
  * [Nombre y Apellido]
  * [Nombre de Usuario]
  * [Último Inicio de Sesión]
  * [Estado]
  * [Rol]
- Agrega un indicador visual (ícono de flecha) en los encabezados para señalar la columna activa y la dirección del orden.