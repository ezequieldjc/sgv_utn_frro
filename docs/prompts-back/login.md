Resumen en Formato Markdown
# Especificación Técnica de Login - Sistema YACANVET
## 1. Introducción y Stack Tecnológico
Este documento detalla los requerimientos funcionales y técnicos para el módulo de autenticación del sistema YACANVET.
* **Frontend:** React.js + Vite.
* **Backend:** Python / FastAPI / Uvicorn.
* **Base de Datos:** PostgreSQL.
## 2. Definición de Estructuras de Datos (PostgreSQL)
* **Tabla: usuario:** Identidad y estado (id, username, habilitado, token_version, rol_id).
* **Tabla: historial_contrasenas:** Credenciales con hash bcrypt.
* **Tabla: login (Auditoría):** Registro de intentos y fallos.
* **Tabla: configuracion_global:** Parámetros como expiración de JWT.
* **Rendimiento:** Uso de @lru_cache para evitar consultas constantes a la configuración.
## 3. Flujo de Login (POST /api/auth/login)
1. **Paso 1: Recepción:** Captura de credenciales e IP real (header X-Forwarded-For).
2. **Paso 2: Búsqueda:** Validación de existencia y estado habilitado.
3. **Paso 3: Validación bcrypt:** Comparación de hashes.
4. **Paso 4: Éxito:** Registro en auditoría y emisión de tokens.
### 3.1 Estándar de Respuestas de Error
* Estructura JSON fija: {"error": "CODIGO", "detalle": "..."}.
* Códigos: CREDENCIALES_INVALIDAS, USUARIO_INACTIVO, TOKEN_EXPIRADO, TOKEN_INVALIDO, PERMISOS_INSUFICIENTES.
## 4. Gestión de Sesiones y JWT
### 4.1. Generación de Tokens
* **Access Token:** user_id, rol_id, token_version, exp.
* **Refresh Token:** user_id, token_version, exp.
* **Seguridad:** Cookies HttpOnly, Secure, SameSite=Strict. Configuración de CORS con allow_credentials=True.
### 4.2. Middleware de Autenticación y Autorización
* Validación criptográfica, de versión y de rol para cada petición protegida.
### 4.3. Proceso de Refresco Silencioso
* Uso del Refresh Token para obtener nuevos Access Tokens sin re-login.
### 4.4. Cierre de Sesión (Logout)
* Eliminación de las cookies de tokens en el navegador.
## 5. Mecanismo de Revocación de Sesiones
* Basado en el campo **token_version**. Cualquier cambio crítico incrementa la versión en la BD, invalidando instantáneamente todos los JWT anteriores.
