Resumen en Formato Markdown
# Especificación Técnica de Login - Sistema Inteligente de Gestión Veterinaria
## 1. Introducción y Stack Tecnológico
Este documento detalla los requerimientos funcionales y técnicos para el módulo de autenticación del Sistema Inteligente de Gestión Veterinaria para Yacanvet.
* **Frontend:** React.js + Vite.
* **Backend:** Python / FastAPI / Uvicorn.
* **Base de Datos:** PostgreSQL.
## 2. Definición de Estructuras de Datos (PostgreSQL)
* **Tabla: usuario:** Identidad y estado (id, username, habilitado, version_token, rol_id).
* **Tabla: historial_contrasena:** Credenciales con hash bcrypt.
* **Tabla: login (Auditoría):** Registro de intentos y fallos.
* **Tabla: sys.config:** Parámetros como expiración de JWT.
* **Rendimiento:** Uso de @lru_cache para evitar consultas constantes a la configuración.
## 3. Flujo de Login (POST /api/auth/login)
1. **Paso 1: Recepción:** Captura de credenciales e IP real (header X-Forwarded-For).
2. **Paso 2: Búsqueda:** Validación de existencia y estado habilitado.
3. **Paso 3: Última contraseña vigente:** Buscar en `auth.historial_contrasena` el último registro del usuario por `fecha_creacion DESC, id DESC` y usar ese `hashed_password` como contraseña vigente.
4. **Paso 4: Validación bcrypt:** Comparación del password ingresado contra el `hashed_password` vigente.
5. **Paso 5: Auditoría obligatoria:** Registrar siempre el intento en `auth.login` antes de responder, tanto si el acceso es exitoso como si falla.
6. **Paso 6: Éxito:** Si la validación es correcta, emitir tokens y devolver respuesta exitosa.
7. **Paso 7: Sin historial de contraseñas:** Si el usuario existe pero no tiene registros en `auth.historial_contrasena`, rechazar el login como credenciales inválidas.
### 3.1 Estándar de Respuestas de Error
* Estructura JSON fija: {"error": "CODIGO", "detalle": "..."}.
* Códigos del login: CREDENCIALES_INVALIDAS, USUARIO_DESHABILITADO.
* Códigos de autenticación/autorización general: TOKEN_EXPIRADO, TOKEN_INVALIDO, PERMISOS_INSUFICIENTES.
* El frontend debe traducir `CREDENCIALES_INVALIDAS` como `Credenciales incorrectas` y `USUARIO_DESHABILITADO` como `Usuario deshabilitado`.
## 4. Gestión de Sesiones y JWT
### 4.1. Generación de Tokens
* **Access Token:** user_id, rol_id, version_token, exp.
* **Refresh Token:** user_id, version_token, exp.
* **Seguridad:** Cookies HttpOnly, Secure, SameSite=Strict. Configuración de CORS con allow_credentials=True.
### 4.2. Middleware de Autenticación y Autorización
* Validación criptográfica, de versión y de permiso para cada petición protegida.
### 4.3. Proceso de Refresco Silencioso
* Uso del Refresh Token para obtener nuevos Access Tokens sin re-login.
### 4.4. Cierre de Sesión (Logout)
* Eliminación de las cookies de tokens en el navegador.
## 5. Mecanismo de Revocación de Sesiones
* Basado en el campo **version_token**. Cualquier cambio crítico incrementa la versión en la BD, invalidando instantáneamente todos los JWT anteriores.
