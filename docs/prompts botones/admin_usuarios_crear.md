@Codebase
Necesito construir la pantalla completa de alta de usuario en la ruta `/admin/usuarios/nuevo`. Esta vista se debe estructurar para ser reutilizada en los modos 'Crear', 'Editar' y 'Ver Detalle'.

Sigue estrictamente los patrones arquitectónicos, servicios, manejo de rutas e interceptores existentes en el proyecto (`@Codebase`).

1. Control de Permisos y Rutas:
- Ruta Crear: `/admin/usuarios/nuevo` (requiere el permiso `usuarios:crear`).
- Ruta Ver Detalle: `/admin/usuarios/[id]` (requiere el permiso `usuarios:ver`).
- Ruta Editar: `/admin/usuarios/[id]/editar` (requiere el permiso `usuarios:editar`).
- Si el usuario logueado no tiene permisos de edición ni creación pero sí de lectura (`usuarios:ver`), renderiza la pantalla en modo 'Solo Lectura'.

2. Campos del Formulario y Reglas de Negocio:

A. Datos de la Persona (`core.persona`):
- Nombre (`nombre`): Texto, Obligatorio.
- Apellido (`apellido`): Texto, Obligatorio.
- DNI (`dni`): Obligatorio. Validar que contenga únicamente números.
- Fecha de Nacimiento (`fecha_nacimiento`): Obligatorio. Implementa una máscara de entrada para formato `dd/mm/yyyy` que agregue automáticamente las barras '/' a medida que se tipea. Limita el ingreso a un máximo de 8 dígitos numéricos (10 caracteres contando las barras). Convertir a ISO/Date al enviar.
- Sexo (`sexo`): Select Obligatorio con opciones: "M - Masculino" (guarda "M"), "F - Femenino" (guarda "F"), "X" (guarda "X").
- Celular (`celular`): Obligatorio. Permitir ingreso de números, espacios y guiones. Aplicar sanitización previa al envío eliminando espacios y guiones (enviar solo dígitos).
- Email (`mail`): Opcional. Si se completa, debe validar formato de correo electrónico válido (con `@`).

B. Datos del Domicilio (`core.domicilio`):
- País (`pais`): Select con opción por defecto "Argentina".
- Provincia (`provincia`): Select con opciones "Buenos Aires" y "Santa Fe".
- Ciudad (`ciudad`): Texto libre, Obligatorio.
- Calle (`calle`): Texto, Obligatorio.
- Altura (`altura`): Texto, Obligatorio.
- Código Postal (`cp`): Obligatorio. Validar que sea un valor numérico.
- Departamento (`departamento`): Texto, Opcional.
- Notas (`notas`): Textarea, Opcional.

C. Datos de la Cuenta (`auth.usuario`):
- Username (`username`): Se genera automáticamente en tiempo real con la fórmula: `primera_letra_nombre + apellido_completo_sin_espacios` (en minúsculas). Este campo es NO editable (solo lectura).
- Rol (`rol_id`): Select obligatorio. Obtener la lista de roles desde la base de datos (petición a backend equivalente a `SELECT id, nombre FROM auth.rol`).
- Habilitado (`habilitado`): Switch/Checkbox booleano, `true` por defecto.

3. Generación de Contraseña, Seguridad y Backend:
- Al crear un usuario, el backend genera una contraseña temporal legible.
- Hashear la contraseña usando `passlib` (con algoritmo `bcrypt`).
- Guardar el registro en la tabla `auth.historial_contrasena`:
  * `usuario_id`: ID del usuario creado.
  * `hashed_password`: Contraseña hasheada.
  * `debe_cambiar`: `true`.
- La API retorna la contraseña en texto plano únicamente en la respuesta de la creación exitosa.

4. UX de Respuesta, Navegación y Estados de Carga:
- Al completar la creación con éxito, despliega un Modal de Confirmación:
  * Título: "Usuario creado correctamente".
  * Mensaje: Texto notificando el alta exitosa y recordando que el usuario deberá cambiar su clave al ingresar.
  * Contraseña temporal: Muestra la contraseña autogenerada en texto plano dentro de una caja destacada/grisada de fácil lectura.
- Botón 'Cancelar': Redirige a la página/URL anterior usando la navegación del historial (no hardcodear la ruta).
- Botón 'Guardar': Deshabilita el botón y muestra un spinner de carga durante el proceso de envío para evitar múltiples clics.

5. UX de Validación y Errores:
- Manejo de respuestas: Asumir el "camino feliz" (happy path) para la creación sin errores de duplicidad.
- Al presionar guardar con errores de validación local:
  * Ejecuta un scroll automático fluido hacia el primer campo con error.
  * Coloca el foco (`autofocus`) en dicho input.
  * Aplica un borde rojo (`border-destructive` o `ring-red-500`) con el mensaje de error debajo del campo.

6. Auditoría:
- Los campos `fecha_alta` (`core.persona`), `fecha_creacion` y `version_token` (`auth.usuario`) se gestionan automáticamente en servidor/DB y no figuran como editables.