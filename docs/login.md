# Especificación Técnica de Login - Sistema Inteligente de Gestión Veterinaria

## 1. Introducción y Stack Tecnológico

Este documento detalla los requerimientos funcionales y técnicos para el módulo de
autenticación del Sistema Inteligente de Gestión Veterinaria para Yacanvet.

- **Frontend:** React.js + Vite.
- **Backend:** Python / FastAPI / Uvicorn.
- **Base de Datos:** PostgreSQL.

## 2. Definición de Estructuras de Datos (PostgreSQL)

- **Tabla `auth.usuario`:** Identidad y estado (id, username, habilitado, version_token, rol_id, persona_id).
- **Tabla `auth.historial_contrasena`:** Credenciales con hash bcrypt.
- **Tabla `auth.login` (Auditoría):** Registro de intentos y fallos.
- **Tabla `sys.config`:** Parámetros como expiración de JWT y razón social. Ver valores
  esperados en `docs/prompts-data/modelo_datos_v1.md`.
- **Rendimiento:** Uso de `@lru_cache` (o cache equivalente) para evitar consultas constantes
  a `sys.config`.

## 3. Flujo de Login (`POST /api/auth/login`)

1. **Recepción:** credenciales + IP real. Leer primero `X-Forwarded-For`, luego `X-Real-IP`;
   la IP directa de la conexión es el último fallback.
2. **Búsqueda:** validar existencia del usuario y estado `habilitado`.
3. **Última contraseña vigente:** buscar en `auth.historial_contrasena` el último registro del
   usuario por `fecha_creacion DESC, id DESC` y usar ese `hashed_password` como vigente.
4. **Validación bcrypt:** comparar el password ingresado contra el `hashed_password` vigente.
5. **Auditoría obligatoria:** registrar siempre el intento en `auth.login` antes de responder,
   tanto si el acceso es exitoso como si falla.
6. **Éxito:** emitir cookie HttpOnly con el JWT y devolver el cuerpo JSON descripto en 4.1.
7. **Sin historial de contraseñas:** si el usuario existe pero no tiene registros en
   `auth.historial_contrasena`, rechazar como credenciales inválidas.

### 3.1 Estándar de Respuestas de Error

- Estructura JSON fija: `{"error": "CODIGO", "detalle": "..."}`.
- Códigos del login: `CREDENCIALES_INVALIDAS` (HTTP 401), `USUARIO_DESHABILITADO` (HTTP 403).
- Códigos de autenticación/autorización general: `TOKEN_EXPIRADO`, `TOKEN_INVALIDO`,
  `PERMISOS_INSUFICIENTES`.
- El frontend traduce `CREDENCIALES_INVALIDAS` → `Credenciales incorrectas` y
  `USUARIO_DESHABILITADO` → `Usuario deshabilitado`. Ante cualquiera de los dos, limpiar los
  campos de usuario y contraseña.
- `razon_fallo` interno para auditoría (nunca expuesto al usuario) usa códigos más granulares:
  ver `.cursor/rules/rbac-security.mdc`.

## 4. Gestión de Sesiones y JWT

### 4.1. Contrato de la respuesta de login

El JWT viaja **solo** dentro de la cookie HttpOnly — nunca es legible por JavaScript del
frontend. Por eso el login también devuelve un cuerpo JSON aparte, con los datos que el
frontend necesita para pintar la UI:

```json
{
  "usuario": { "id": 1, "username": "jperez", "nombre": "Juan", "apellido": "Pérez" },
  "permisos": ["pacientes:read", "turnos:create"]
}
```

- **Access Token (payload del JWT, en cookie):** `user_id`, `rol_id`, `permisos` (mismo array
  plano de strings que el JSON de arriba), `version_token`, `exp`.
- **Refresh Token (payload del JWT, en cookie separada):** `user_id`, `version_token`, `exp`.
- **Seguridad:** Cookies HttpOnly, Secure, SameSite=Strict. `CORSMiddleware` con
  `allow_credentials=True`; el cliente HTTP del frontend usa `withCredentials: true` en todas
  las peticiones.

### 4.2. `GET /api/auth/me` — rehidratación de sesión

Endpoint autenticado vía cookie (sin body). Devuelve el mismo contrato que 4.1
(`{ "usuario": ..., "permisos": [...] }`) si la cookie es válida y el `version_token`
coincide; HTTP 401 si no hay cookie, es inválida, expiró, o el `version_token` no coincide.

El frontend lo llama al montar la aplicación (recarga de página) para reconstruir el estado
de sesión sin pedir credenciales de nuevo. `<ProtectedRoute>` (ver
`docs/prompts-front/sidebar.md`) usa este endpoint para decidir si redirige a `/login`.

### 4.3. Middleware de Autenticación y Autorización

Validación criptográfica, de `version_token` y de permiso específico para cada petición
protegida — ver `.cursor/rules/rbac-security.mdc`.

### 4.4. Proceso de Refresco Silencioso

Uso del Refresh Token para obtener nuevos Access Tokens sin re-login.

### 4.5. `POST /api/auth/logout`

Elimina las cookies de Access y Refresh Token en el navegador. No requiere body. El frontend
redirige a `/login` después de una respuesta exitosa.

## 5. Mecanismo de Revocación de Sesiones

Basado en `version_token` (ver `.cursor/rules/rbac-security.mdc`). Cualquier cambio crítico
incrementa la versión en la BD, invalidando instantáneamente todos los JWT anteriores.

## 6. Configuración pública

### `GET /api/config/public`

Endpoint público (sin autenticación). Devuelve la razón social para branding:

```sql
select parametro_valor as razon_social from sys.config where config_id = 2 and parametro_id = 1;
```

Lo consumen la pantalla de login (`docs/prompts-front/login.md`) y el shell autenticado
(`docs/prompts-front/sidebar.md`).
