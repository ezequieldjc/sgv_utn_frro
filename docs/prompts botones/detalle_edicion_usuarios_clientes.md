# Ver detalle y editar — Usuarios y Clientes

Hecho el 18/11/2026. Como un cliente es un usuario (rol CLIENTE), las dos pantallas funcionan
igual y comparten la lógica de edición de la persona
(`backend/app/services/persona_service.py → actualizar_persona`).

## Pantallas

Se reutiliza el formulario de alta en tres modos (`create`, `view`, `edit`):

| Ruta | Permiso | Qué hace |
|------|---------|----------|
| `/admin/usuarios/:id` | `usuarios:ver` | Detalle en solo lectura. Botón **Editar** con `usuarios:editar`. |
| `/admin/usuarios/:id/editar` | `usuarios:editar` (con solo `usuarios:ver`, en solo lectura) | Edita persona, domicilio, rol y habilitado. |
| `/clientes/:id` | `clientes:ver_listado` | Detalle en solo lectura, con la cuenta de acceso (usuario y estado). Botón **Editar** con `clientes:editar`. |
| `/clientes/:id/editar` | `clientes:editar` (con solo `clientes:ver_listado`, en solo lectura) | Edita persona y domicilio. |

En el listado de Admin → Usuarios se sumó el botón **Editar** (lápiz). Los de Clientes ya
existían y llevaban a páginas "en construcción" (`pages/clientes/stubs.tsx`, eliminado).

## API

- `GET /api/usuarios/{id}` (`usuarios:ver`) y `PUT /api/usuarios/{id}` (`usuarios:editar`):
  devuelven `UsuarioDetail`, con `es_cliente` para saber qué datos son obligatorios.
- `GET /api/clientes/{id}` (`clientes:ver_listado`) y `PUT /api/clientes/{id}`
  (`clientes:editar`): devuelven `ClienteDetail`, con `cuenta` (usuario y habilitado) o `null`.
  Una persona que no es cliente responde 404 `CLIENTE_NO_ENCONTRADO`.

## Reglas

1. **DNI** no repetido (409 `DNI_DUPLICADO`); si no cambia, no se controla.
2. **Mail de un cliente con cuenta**: obligatorio (422 `MAIL_OBLIGATORIO`) y es su usuario. Al
   cambiarlo cambia el usuario, en minúsculas (409 `MAIL_EN_USO` si lo usa otra cuenta). El
   tutor eventual no tiene cuenta: para él el mail es opcional.
3. **El usuario de un empleado no cambia** aunque cambie el nombre.
4. **Un cliente no pasa a empleado ni un empleado a cliente** (400 `CAMBIO_ROL_CLIENTE`): una
   persona tiene un solo usuario y un cliente siempre tiene su usuario CLIENTE. En el formulario,
   el rol de un cliente no se puede cambiar.
5. **Empleado**: DNI, fecha de nacimiento, sexo y domicilio siguen siendo obligatorios (422
   `DATOS_INCOMPLETOS`). **Cliente**: son opcionales, como en Clientes.
6. **Sesiones**: cambiar el rol o inhabilitar suma 1 a `version_token` (regla de
   `rbac-security`). Editar datos personales no cierra sesiones.
7. Desde Clientes no se cambian la contraseña ni la habilitación de la cuenta: eso sigue en
   Admin → Usuarios.

## Tests

- Backend: `backend/tests/test_usuarios.py` y `backend/tests/test_clientes.py` (secciones "Ver
  detalle y editar").
- Frontend: `frontend/src/pages/admin/usuario-form-page.test.tsx` y
  `frontend/src/pages/clientes/cliente-form-page.test.tsx`.

## Fuera de alcance

Auditoría de cambios sobre datos personales (no hay tabla de auditoría todavía) y que un admin
no pueda quitarse a sí mismo el rol o la habilitación.
