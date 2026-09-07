# Especificación Técnica: Restablecer Contraseña de Usuario

## Archivos de Contexto y Reglas
@tech-stack.mdc @rbac-security.mdc @database-permission.mdc @database-types.mdc

---

## 1. Alcance y Permisos de Seguridad
- **Permiso Requerido:** La acción de restablecer contraseña requiere explícitamente el permiso `usuarios:editar` (o wildcard `*`).
- **Estado de Botón:** Si el usuario autenticado NO posee este permiso, el botón con ícono de llave (`Key`) en la tabla debe estar deshabilitado (`disabled`) o no renderizarse.

---

## 2. Contrato de API / Backend (FastAPI + SQLModel)

### Endpoint: `POST /api/admin/usuarios/{usuario_id}/restablecer-contrasena`
- **Autorización:** Requiere token HttpOnly válido y verificación en backend del permiso `usuarios:editar`.

### Lógica de Negocio Backend:
1. **Validación:** Verificar que el `usuario_id` exista en `auth.usuario` (retornar error `404 Not Found` si no existe).
2. **Generación de Contraseña Temporal (REFACTORIZACIÓN REQUERIDA):**
   - **No reescribas ni dupliques lógica de generación de contraseñas.** El proyecto ya genera contraseñas aleatorias al crear usuarios nuevos. 
   - **Instrucción estricta:** Si la lógica de generación actual está embebida directamente dentro del endpoint de creación de usuarios, **extráela** a una función utilitaria compartida (por ejemplo, en `utils/security.py`, `utils/password.py` o en un `auth_service`).
   - Invoca esa función unificada tanto en el endpoint de creación como en este nuevo endpoint de restablecimiento.
3. **Hasheo y Persistencia:**
   - Hashear la nueva contraseña temporal usando `passlib` (con algoritmo `bcrypt`).
   - **INSERT** en `auth.historial_contrasena`:
     - `usuario_id`: ID del usuario destino.
     - `hashed_password`: Hash de la contraseña temporal.
     - `debe_cambiar`: `true`.
     - `fecha_creacion`: `NOW()`. (Cero sobrescritura de registros anteriores).
4. **Invalidación de Sesiones Activas:**
   - Incrementar en +1 la columna `version_token` en `auth.usuario` (`version_token = version_token + 1`). Esto revoca instantáneamente cualquier JWT activo del usuario restablecido.
5. **Respuesta Exitosa (`200 OK`):**
   ```json
   {
     "mensaje": "Contraseña restablecida exitosamente",
     "usuario_id": 12,
     "username": "ejemplo",
     "temporal_password": "..."
   }
   ```
   *(La contraseña en texto plano SOLO se retorna en este payload de respuesta y nunca se guarda sin hashear).*

---

## 3. Flujo de Interfaz y Componentes (Frontend React + TSX)

### Ubicación: `src/pages/admin/usuarios-page.tsx` (o su componente de tabla/columnas asociado)

### Paso A: Diálogo de Confirmación (`AlertDialog` de Shadcn UI)
- **Disparador:** Clic en el botón con ícono `Key` (llave) en la columna de Acciones de la fila correspondiente.
- **Título:** `"¿Restablecer contraseña?"`
- **Descripción:** `"Esta acción generará una nueva contraseña temporal para el usuario @{username} y cerrará todas sus sesiones activas de forma inmediata. ¿Deseas continuar?"`
- **Botón Cancelar:** Cierra el diálogo sin ejecutar cambios.
- **Botón Confirmar (`bg-primary`):** `"Restablecer Contraseña"`.
  - Muestra estado de carga (`spinner` + botón deshabilitado) mientras resuelve la petición HTTP para evitar doble clic.

### Paso B: Diálogo de Resultado (Modal con Nueva Contraseña)
Al recibir respuesta HTTP 200 exitosa del backend:
1. Cierra el diálogo de confirmación.
2. Abre un nuevo Modal / Dialog de presentación:
   - **Título:** `"Contraseña Restablecida Exitosamente"`
   - **Contenido:**
     - Texto indicativo: `"Comunícale la siguiente contraseña temporal al usuario. Deberá usarla en su próximo inicio de sesión y el sistema le pedirá cambiarla:"`
     - **Caja Destacada (`bg-muted p-4 rounded-md flex items-center justify-between font-mono text-lg border mt-4`):**
       - Muestra el texto de `temporal_password`.
       - Botón integrado de **"Copiar"** (ícono `Copy` de Lucide) que al hacer clic copia la clave al portapapeles (`navigator.clipboard.writeText`) y cambia temporalmente el ícono a `Check` con feedback tipo toast ("Copiada al portapapeles").
   - **Botón Entendido / Cerrar:** Cierra el modal de resultado de manera limpia.

---

## 4. Manejo de Errores y Calidad (Testing)
- **Toast de Error:** Si la API responde con error, muestra un Toast destructivo con el mensaje correspondiente y no abre el modal de resultado.
- **Pruebas Automatizadas (Pytest Backend):**
  - Actualizar o crear tests que verifiquen:
    - Que la función utilitaria de generación de contraseñas funcione correctamente y de forma aislada.
    - Que el endpoint `/restablecer-contrasena`:
      - Inserte un nuevo registro en `auth.historial_contrasena` con `debe_cambiar == True`.
      - Incremente el `version_token` del usuario.
      - Retorne HTTP 200 con la propiedad `temporal_password`.