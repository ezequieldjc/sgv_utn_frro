# Modelo de Datos (Diccionario v1)

> Alcance de esta iteración: ver `docs/alcance_iteracion_actual.md`. Este diccionario
> documenta el modelo completo del proyecto (incluye módulos futuros como Clínica); no todo
> se migra ahora.

Este documento define la estructura de la base de datos para generar los modelos usando **SQLModel** y migrarlos con **Alembic** en PostgreSQL.

## Reglas Generales para Cursor (¡Importante!)
1. Generar clases heredando de `SQLModel, table=True`.
2. Usar tipado estricto (ej: `id: int | None = Field(default=None, primary_key=True)`).
3. Configurar atributos `Field()` con `nullable=False`, `unique=True`, o `default=` según lo especificado. Para los defaults de fecha (NOW), usar `default_factory=datetime.utcnow` (o timezone actual).
4. Configurar las relaciones (`Relationship`) bidireccionales entre entidades.
5. Crear las restricciones multi-columna (UniqueConstraint) en los `__table_args__` donde se indique.
6. El código debe ser modular, separando en sub-carpetas lógicas: `core/`, `auth/`, `clinica/`, `sys/`.
7. Incluir las "Notas" como docstrings o comentarios en español.

---

## Módulo: Core

### Entidad: `Domicilio`
> Fuera de alcance en esta iteración — no se crea esta tabla todavía (ver nota en `Persona.domicilio_id`).
- **id**: integer, PK.
- **pais**: varchar(50), Obligatorio.
- **provincia**: varchar(50), Obligatorio.
- **ciudad**: varchar(50), Obligatorio.
- **cp**: varchar(10), Opcional.
- **calle**: varchar(100), Obligatorio.
- **altura**: varchar(10), Obligatorio.
- **departamento**: varchar(20), Opcional.
- **notas**: text, Opcional.

### Entidad: `Persona`
- **id**: integer, PK.
- **nombre**: varchar(100), Obligatorio.
- **apellido**: varchar(100), Obligatorio.
- **dni**: varchar(20), Obligatorio. *Restricción: Unique (`UQ_Persona_DNI`).*
- **sexo**: char(1), Opcional. (M/F/X).
- **domicilio_id**: integer, Opcional. *FK a domicilio.id.* **Fuera de alcance esta
  iteración: no incluir esta columna todavía** — se agrega en una migración posterior,
  cuando exista `Domicilio` y el módulo que lo use.
- **mail**: varchar(100), Opcional.
- **celular**: varchar(30), Obligatorio.
- **fecha_alta**: timestamp, Obligatorio. *Default: NOW()*.

---

## Módulo: Auth

### Entidad: `Rol`
- **id**: integer, PK.
- **nombre**: varchar(50), Obligatorio. *Restricción: Unique (`UQ_Rol_Nombre`).* (ej: ADMIN, VETERINARIO).
- **descripcion**: varchar(255), Opcional.

### Entidad: `Permiso`
- **id**: integer, PK.
- **nombre**: varchar(50), Obligatorio. *Restricción: Unique (`UQ_Permiso_Nombre`).* (ej: pacientes:read, turnos:create).
- **descripcion**: varchar(255), Opcional.

### Entidad: `RolPermiso` (Tabla intermedia)
- **rol_id**: integer, Obligatorio. *FK a rol.id*. (PK compuesta junto a permiso_id).
- **permiso_id**: integer, Obligatorio. *FK a permiso.id*. (PK compuesta junto a rol_id).

### Regla de Asignación de Permisos
La asignación concreta de permisos a cada rol vive en la base de datos y no debe hardcodearse en documentación de UI ni en el frontend. Al iniciar sesión, la aplicación debe leer el rol del usuario y sus permisos asociados para construir la experiencia de navegación y autorización.

### Entidad: `Usuario`
- **id**: integer, PK.
- **persona_id**: integer, Obligatorio. *FK a persona.id*. *Restricción: Unique (un usuario por persona).*
- **username**: varchar(50), Obligatorio. *Restricción: Unique (`UQ_Usuario_Username`).*
- **habilitado**: boolean, Obligatorio. *Default: True*.
- **rol_id**: integer, Obligatorio. *FK a rol.id*.
- **version_token**: integer, Obligatorio. *Default: 1*. (Para invalidación de JWT).
- **fecha_creacion**: timestamp, Obligatorio. *Default: NOW()*.

### Entidad: `HistorialContrasena`
- **id**: integer, PK.
- **usuario_id**: integer, Obligatorio. *FK a usuario.id*.
- **hashed_password**: varchar(255), Obligatorio.
- **fecha_creacion**: timestamp, Obligatorio. *Default: NOW()*.
- **debe_cambiar**: boolean, Obligatorio. *Default: True*. (Cambio de clave en próximo login
  — el campo existe desde esta iteración, pero su enforcement en el login queda para cuando
  exista la pantalla de cambio de contraseña; ver `docs/alcance_iteracion_actual.md`).

Regla de uso en login: la contraseña vigente de un usuario no se guarda en `usuario`. Se obtiene consultando `HistorialContrasena` filtrado por `usuario_id` y ordenando por `fecha_creacion DESC, id DESC`; el primer registro resultante define el `hashed_password` actual.

### Entidad: `Login`
- **id**: bigserial, PK.
- **usuario_id**: integer, Opcional. *FK a usuario.id*. (Puede ser nulo si el usuario ingresado no existe).
- **username_ingresado**: varchar(50), Obligatorio.
- **fecha**: timestamp, Obligatorio. *Default: NOW()*.
- **exito**: boolean, Obligatorio. (True=Exitoso, False=Fallido).
- **ip**: inet, Obligatorio. (En SQLModel mapear como String o usar tipo IP de SQLAlchemy; en Pydantic, `IPvAnyAddress`).
- **razon_fallo**: varchar(50), Opcional. (Valores: `USUARIO_INEXISTENTE`,
  `USUARIO_DESHABILITADO`, `CLAVE_INCORRECTA`, `SIN_HISTORIAL_CONTRASENA` — ver
  `.cursor/rules/rbac-security.mdc`).

---

## Módulo: Clinica

> **Fuera de alcance en esta iteración** (ver `docs/alcance_iteracion_actual.md`).
> Diccionario documentado para referencia futura; no se crean estas tablas todavía.

### Entidad: `Especie`
- **id**: integer, PK.
- **nombre**: varchar(50), Obligatorio. *Unique*.
- **descripcion**: text, Opcional.
- **activo**: boolean, Obligatorio. *Default: True*.

### Entidad: `Raza`
- **id**: integer, PK.
- **especie_id**: integer, Obligatorio. *FK a especie.id*.
- **nombre**: varchar(50), Obligatorio.
- **descripcion**: text, Opcional.
- **activo**: boolean, Obligatorio. *Default: True*.

### Entidad: `Mascota`
- **id**: integer, PK.
- **persona_id**: integer, Obligatorio. *FK a persona.id*. (Dueño).
- **raza_id**: integer, Obligatorio. *FK a raza.id*.
- **nombre**: varchar(50), Obligatorio.
- **fecha_nacimiento**: date, Opcional.
- **ultimo_peso**: decimal(5,2), Opcional.
- **estado**: varchar(20), Obligatorio. (VIVA, FALLECIDA, INACTIVA).
- **fecha_alta**: timestamp, Obligatorio. *Default: NOW()*.

### Entidad: `HistorialPeso`
- **id**: integer, PK.
- **mascota_id**: integer, Obligatorio. *FK a mascota.id*.
- **fecha**: timestamp, Obligatorio. *Default: NOW()*.
- **peso_kg**: decimal(5,2), Obligatorio.
- *Restricción compuesta en `__table_args__`: UniqueConstraint sobre (`mascota_id`, `fecha`) llamada `UQ_HP_MascotaFecha`.*

---

## Módulo: sys

### Entidad: `Config`
- **id**: integer, PK.
- **config_id**: integer, Obligatorio.
- **config_nombre**: varchar(100), Obligatorio.
- **parametro_id**: integer, Obligatorio.
- **parametro_nombre**: varchar(100), Obligatorio.
- **parametro_valor**: varchar(255), Obligatorio.
- *Restricción compuesta en `__table_args__`: UniqueConstraint sobre (`config_id`, `parametro_id`) llamada `UQ_Config_IDID`.*

#### Valores iniciales esperados (seed)

| config_id | parametro_id | config_nombre | parametro_nombre        | Uso |
|---|---|---|---|---|
| 1 | 1 | JWT      | ACCESS_TOKEN_EXPIRACION  | Expiración del Access Token — `select parametro_valor from sys.config where config_id = 1 and parametro_id = 1` |
| 1 | 2 | JWT      | REFRESH_TOKEN_EXPIRACION | Expiración del Refresh Token — `config_id = 1 and parametro_id = 2` |
| 2 | 1 | BRANDING | RAZON_SOCIAL             | Nombre de la clínica, expuesto en `GET /api/config/public` como `razon_social` — `config_id = 2 and parametro_id = 1` |
