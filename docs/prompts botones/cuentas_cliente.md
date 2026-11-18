# Cuentas de cliente

Rama `feature/cuentas-cliente` (18/11/2026). Decisiones en `claude/decisiones_del_equipo.md` del
proyecto.

## Reglas

1. **Cliente y usuario van siempre juntos.** Un cliente (`core.persona.es_cliente = true`)
   siempre tiene un usuario con rol CLIENTE, y un usuario con rol CLIENTE siempre es un cliente.
   Los tres caminos de alta pasan por la misma función,
   `backend/app/services/cuenta_cliente_service.py → crear_cuenta_cliente`:
   - **Clientes → Nuevo cliente** (`POST /api/clientes`, `clientes:crear`).
   - **Admin → Usuarios con rol CLIENTE** (`POST /api/usuarios`, `usuarios:crear`).
   - **Crear cuenta** desde el login (`POST /api/auth/registro`, público).

   Única excepción: la persona del tutor eventual (`PERSONA_ID_TUTOR_EVENTUAL`), que es cliente
   sin usuario.
2. **El usuario del cliente es su mail**, guardado en minúsculas. Por eso el mail es
   obligatorio para los clientes. En la base `persona.mail` sigue aceptando vacío: la regla es
   de la app. Los empleados siguen entrando con su usuario de siempre (primera letra del nombre
   + apellido) y para ellos el mail sigue siendo opcional.
3. **Login con "Usuario o mail".** Si lo ingresado tiene "@" se compara en minúsculas (así el
   cliente puede escribir su mail en mayúsculas); si no, tal cual. Lo mismo en el cambio
   obligatorio de contraseña. La auditoría (`auth.login.username_ingresado`) guarda lo que se
   escribió.
4. **Sin repetidos:** el DNI no se repite en ningún alta (409 `DNI_DUPLICADO`; un alta sin DNI
   no se controla) y el mail no se repite entre usuarios (409 `MAIL_EN_USO`).
5. Los usuarios y clientes de prueba que ya existían no se migran.

## Cada camino

| Camino | Contraseña | Lo que ve quien da el alta |
|--------|------------|-----------------------------|
| Clientes → Nuevo cliente | Temporal, `debe_cambiar = true` | El usuario (mail) y la contraseña temporal, para pasárselos al cliente. Ya no está el check "Crear usuario". |
| Admin → Usuarios con rol CLIENTE | Temporal, `debe_cambiar = true` | Igual que hoy. Sin mail → 422 `MAIL_OBLIGATORIO`. Crea la persona con `es_cliente = true`, así que aparece en Clientes y se le pueden asignar mascotas. |
| Crear cuenta (`/registro`) | La elige el cliente (dos veces, mínimo 8) | La cuenta queda activa y sin cambio obligatorio. No inicia sesión sola: vuelve al login con el mail cargado. |

En Admin → Usuarios, el rol objetivo CLIENTE se reconoce por nombre
(`cuenta_cliente_service.es_rol_cliente`) solo para saber **qué se crea**. Quien da el alta se
autoriza con `usuarios:crear`, como siempre (Permission-First).

### Registro (`POST /api/auth/registro`)

- Pide nombre, apellido, DNI, celular, mail, contraseña y su repetición. Fecha de nacimiento y
  sexo son opcionales. No pide domicilio.
- No se verifica el mail: el cliente solo ve lo suyo, así que se aceptó ese riesgo.
- Si el DNI o el mail ya existen responde un único 409 `CUENTA_EXISTENTE` ("Ya existe una cuenta
  con esos datos. Si es tuya, comunicate con la clínica para recuperarla."), sin decir cuál.
- Una cuenta nueva **no se vincula** con mascotas ya cargadas en el mostrador.

## Pantallas

- `/login`: "Usuario o mail" y el link **Crear cuenta**.
- `/registro`: pública, fuera del `ProtectedRoute` (`frontend/src/pages/registro-page.tsx`). La
  ruta está en `RUTAS_SIN_RENOVACION` de `lib/api.ts`.
- Clientes → Nuevo cliente: mail obligatorio; al guardar muestra usuario y contraseña temporal.
- Admin → Usuarios: el mail indica que es obligatorio con rol CLIENTE.

## Base de datos

No hizo falta DDL: `auth.usuario.username` y `auth.login.username_ingresado` ya pasaron a
`varchar(100)` con `scripts/auth/001_portal_y_cuentas_cliente.sql`. El alta de mascotas desde
el portal usa `scripts/auth/002_portal_crear_mascota.sql` (solo datos), ver
`docs/prompts botones/portal_cliente.md`.

## Tests

- Backend: `backend/tests/test_registro.py`, `test_clientes.py`, `test_usuarios.py` (rol
  CLIENTE) y `test_portal_alta_mascota.py`.
- Frontend: `frontend/src/pages/registro-page.test.tsx`,
  `pages/clientes/cliente-form-page.test.tsx` y `pages/portal/nueva-mascota-page.test.tsx`.

## Para después (entrega final)

- Envío de mails (`email_service` con modo SMTP y modo consola): bienvenida con link para elegir
  la contraseña y **Olvidé mi contraseña** con un token firmado de un solo uso (sin tabla nueva).
  Mientras tanto, si un cliente se olvida la clave se la restablecen desde Admin → Usuarios.
- Límite de intentos en el login y el registro.
- Vincular la cuenta con un código al celular.
- Empleados que también son clientes (hoy una persona tiene un solo usuario).
