# Alta de Cliente — `/clientes/nuevo`

Spec de implementación del formulario de alta de cliente y `POST /api/clientes`.

## Objetivo

Permitir crear un cliente (`core.persona` con `es_cliente = true` + `core.domicilio`), con un check opcional **“Crear usuario”** que además inserta `auth.usuario` con rol fijo `CLIENTE` y contraseña temporal.

## Permisos

| Acción | Permiso |
|--------|---------|
| Ver / usar pantalla `/clientes/nuevo` | `clientes:crear` o `*` |
| `POST /api/clientes` | `clientes:crear` o `*` |

Con `clientes:crear` también se puede crear el usuario vinculado (no se exige `usuarios:crear`).

Si falta el permiso: estado de acceso denegado (mismo patrón visual que Usuarios / listado de clientes).

## Frontend — ruta y estructura

- Ruta: `/clientes/nuevo` → `ClienteFormPage` (modo create).
- Cancelar → `navigate(-1)`.
- Misma UX de formulario que `usuario-form-page.tsx`:
  - Secciones **Persona** + **Domicilio**.
  - Máscara de fecha `dd/mm/yyyy`.
  - Validaciones DNI (solo dígitos), CP numérico, mail opcional, celular sanitizado a dígitos al enviar.
  - Scroll + foco al primer campo con error; borde `border-destructive`.

### Check “Crear usuario”

- Por defecto **off**.
- Off → solo domicilio + persona (`es_cliente=true` en backend).
- On → muestra:
  - **Username** (solo lectura, preview con fórmula `primera_letra_nombre + apellido_sin_espacios`, minúsculas, sin acentos).
  - **Rol** fijo texto “CLIENTE” (solo lectura; no hay select).
  - **Habilitado** (checkbox, default `true`).

## API — `POST /api/clientes`

### Request (`ClienteCreate`)

```json
{
  "nombre": "string",
  "apellido": "string",
  "dni": "string",
  "fecha_nacimiento": "YYYY-MM-DD",
  "sexo": "M" | "F" | "X",
  "celular": "string",
  "mail": "string | null",
  "domicilio": {
    "pais": "string",
    "provincia": "string",
    "ciudad": "string",
    "calle": "string",
    "altura": "string",
    "cp": "string",
    "departamento": "string | null",
    "notas": "string | null"
  },
  "crear_usuario": false,
  "habilitado": true
}
```

### Response 201 (`ClienteCreateResponse`)

```json
{
  "id": 1,
  "nombre": "string",
  "apellido": "string",
  "dni": "string",
  "usuario_creado": false,
  "username": null,
  "password_temporal": null
}
```

Si `crear_usuario=true` y el alta de usuario OK: `usuario_creado=true`, `username` y `password_temporal` en claro (solo en esta respuesta).

### Errores

| Status | Código | Cuándo |
|--------|--------|--------|
| 401 | — | Sin sesión |
| 403 | — | Sin `clientes:crear` |
| 409 | `DNI_DUPLICADO` | Ya existe persona con ese DNI |
| 404 | `ROL_NO_ENCONTRADO` | `crear_usuario=true` y no existe `auth.rol.nombre = 'CLIENTE'` |

## Backend — reglas

1. Si DNI ya existe → `409 DNI_DUPLICADO`.
2. INSERT `domicilio` + INSERT `persona` con **`es_cliente = true`**.
3. Si `crear_usuario`:
   - Buscar rol `CLIENTE` → si falta, `404 ROL_NO_ENCONTRADO`.
   - `allocate_username` + `generate_temp_password` (reutilizar `usuario_service`).
   - INSERT `usuario` (`habilitado` del payload, `version_token=1`) + `historial_contrasena` con `debe_cambiar=true`.
4. Commit; devolver response (password solo si se creó usuario).

**Prerrequisito de datos:** debe existir `auth.rol` con `nombre = 'CLIENTE'`. No se corre DDL desde la app.

## Modales UI

### Éxito

- Sin usuario: “Cliente creado correctamente”.
- Con usuario: mismo título + mensaje con `@username` + caja con `password_temporal`.
- Al cerrar / “Ir al listado” → navegar a `/clientes`.

### DNI duplicado

- Dialog “El DNI ya existe”.
- Al cerrar el dialog, el formulario permanece **completo**; el campo DNI queda en rojo con mensaje.

## Tests (backend)

- 401 / 403 sin permiso.
- 201 solo cliente (`usuario_creado=false`, `es_cliente=true`, sin historial).
- 201 con `crear_usuario=true` (rol CLIENTE seed, password temporal, historial `debe_cambiar`).
- 409 DNI duplicado.
- 404 si falta rol CLIENTE y `crear_usuario=true`.

## Fuera de alcance

- Edición / detalle de cliente.
- Select de rol distinto de CLIENTE en el alta.
- Módulo de mascotas.
