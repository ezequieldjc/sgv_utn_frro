# Especificación Técnica: Cambio de Contraseña Obligatorio en Login

## Archivos de Contexto y Reglas
@tech-stack.mdc @rbac-security.mdc @login.md

---

## 1. Alcance y Contexto
- Se activa la funcionalidad de cambio obligatorio de contraseña que había quedado pospuesta en las especificaciones iniciales.
- **Objetivo:** Si el usuario tiene `auth.historial_contrasena.debe_cambiar == true`, no se le debe permitir iniciar sesión. Se le debe exigir que establezca una nueva contraseña, y luego obligarlo a autenticarse de nuevo.

---

## 2. Contrato de API / Backend (FastAPI + SQLModel)

### A. Modificación del endpoint actual: `POST /api/auth/login`
- **Lógica:** Si las credenciales son válidas (el password es correcto), pero el último registro en `auth.historial_contrasena` tiene `debe_cambiar == true`:
  - **NO** emitir la cookie HttpOnly con el JWT.
  - Registrar en `auth.login` el intento.
  - Retornar un error controlado: `HTTP 403 Forbidden` con el payload: `{"error": "DEBE_CAMBIAR_CONTRASENA", "detalle": "Debe actualizar su contraseña para continuar."}`.

### B. Nuevo Endpoint: `POST /api/auth/cambiar-contrasena-obligatorio`
- **Visibilidad:** Público (no requiere token JWT, porque el usuario aún no pudo loguearse).
- **Payload (Body):**
  - `username` (string)
  - `password_actual` (string)
  - `password_nueva` (string, mínimo 8 caracteres).
- **Lógica de Negocio Backend:**
  1. Buscar al usuario por `username` y verificar que esté habilitado.
  2. Verificar que `password_actual` coincida con el hash vigente en `auth.historial_contrasena` (usando bcrypt). Si no coincide, retornar `401 Credenciales inválidas`.
  3. Verificar que el registro vigente realmente tenga `debe_cambiar == true`. Si es `false`, retornar `400 Bad Request` (el usuario no necesita este flujo).
  4. **Persistencia:**
     - Hashear `password_nueva` con bcrypt.
     - **INSERT** en `auth.historial_contrasena`: `usuario_id`, `hashed_password`, `debe_cambiar = false`, `fecha_creacion = NOW()`.
  5. Retornar `200 OK` con un mensaje de éxito. (NUNCA auto-loguear ni emitir JWT aquí).

---

## 3. Flujo de Interfaz y Componentes (Frontend React + TSX)

### Ubicación: `src/pages/auth/login-page.tsx` (o equivalente)

### Paso A: Intercepción del Login
- Al hacer submit del formulario de login, si la respuesta es `403` con error `DEBE_CAMBIAR_CONTRASENA`:
  - Evitar el mensaje de error rojo tradicional.
  - Guardar el `username` ingresado en un estado local.
  - Abrir el Modal de Cambio de Contraseña.

### Paso B: Modal de Cambio de Contraseña (`Dialog` de Shadcn UI)
- **Estética:** Modal limpio, con la estética de Shadcn UI (tarjeta centrada, bordes redondeados, fondo acorde al tema).
- **Título:** `"Cambio de contraseña requerido"`
- **Descripción:** `"Por razones de seguridad, debes actualizar tu contraseña antes de continuar."`
- **Formulario interno:**
  1. `Contraseña actual` (Input type password).
  2. `Nueva contraseña` (Input type password, validación min 8 caracteres).
  3. `Repetir contraseña` (Input type password).
- **Validaciones Frontend (antes de enviar):**
  - Ningún campo puede estar vacío.
  - `Nueva contraseña` debe ser idéntica a `Repetir contraseña`. Si no coinciden, mostrar mensaje de error bajo el input: *"Las contraseñas nuevas no coinciden"*.
- **Acciones:**
  - Botón "Cancelar": Cierra el modal y limpia el formulario de login principal.
  - Botón "Actualizar Contraseña" (`bg-primary`): Ejecuta el POST a `/api/auth/cambiar-contrasena-obligatorio`. Muestra estado de carga (spinner).

### Paso C: Finalización Exitosa
Si la respuesta del endpoint es `200 OK`:
1. Cerrar el modal.
2. Limpiar todos los campos del modal y del formulario de login original (usuario y clave).
3. Mostrar un **Toast** de éxito: *"Contraseña actualizada correctamente. Por favor, inicia sesión con tus nuevas credenciales."*
4. El usuario permanece en `/login` para iniciar sesión manualmente.

---

## 4. Manejo de Errores y Calidad (Testing)
- **Testing Backend (Pytest):**
  - Testear que `POST /api/auth/login` devuelve 403 y `DEBE_CAMBIAR_CONTRASENA` cuando corresponde.
  - Testear que el nuevo endpoint falla si la `password_actual` es incorrecta.
  - Testear que tras ejecutar el nuevo endpoint con éxito, el registro se inserta con `debe_cambiar=False`.
- **Testing Frontend (Vitest / Component Test):**
  - Verificar que el modal no permite enviar si la clave nueva y su repetición no son exactamente iguales.