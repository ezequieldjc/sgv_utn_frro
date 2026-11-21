# Modelo de Datos (Diccionario v2)

> **v2 (14/11/2026):** reemplaza a `docs/modelo_datos_v1.md`, que se conserva como historial.
> Cambios: módulo Clinica (historia clínica: `sintoma`, `consulta`, `dictado`,
> `consulta_sintoma`, `consulta_diagnostico`; columnas nuevas en `patologia` y `raza`; se eliminaron
> `historial_peso` y `patologia_predisposicion`) y estados de `agenda.turno` (`atendido` reemplaza a
> `realizado`). Scripts: `scripts/clinica/001` a `005` y `scripts/agenda/002_turno_atendido.sql`.

> Alcance de esta iteración: ver `docs/alcance_iteracion_uno.md`. Este diccionario
> documenta el modelo completo del proyecto (incluye módulos futuros como Clínica); no todo
> se migra ahora.

Este documento define la estructura de la base de datos para generar los modelos usando **SQLModel** y migrarlos con **Alembic** en PostgreSQL.

## Reglas Generales para Cursor (¡Importante!)
1. Generar clases heredando de `SQLModel, table=True`.
2. Usar tipado estricto (ej: `id: int | None = Field(default=None, primary_key=True)`).
3. Configurar atributos `Field()` con `nullable=False`, `unique=True`, o `default=` según lo especificado. Para los defaults de fecha (NOW), usar `default_factory=datetime.utcnow` (o timezone actual).
4. Configurar las relaciones (`Relationship`) bidireccionales entre entidades.
5. Crear las restricciones multi-columna (UniqueConstraint) en los `__table_args__` donde se indique.
6. El código debe ser modular, separando en sub-carpetas lógicas: `core/`, `auth/`, `clinica/`, `catalogo/`, `sys/`.
7. Incluir las "Notas" como docstrings o comentarios en español.

---

## Módulo: Core

### Entidad: `Domicilio`
> Atributo de `Persona` persistido en tabla separada (`core.domicilio`), vinculado por
> `persona.domicilio_id`.
- **id**: integer, PK.
- **pais**: varchar(50), Obligatorio.
- **provincia**: varchar(50), Obligatorio.
- **ciudad**: varchar(50), Obligatorio.
- **cp**: varchar(10), Obligatorio.
- **calle**: varchar(100), Obligatorio.
- **altura**: varchar(10), Obligatorio.
- **departamento**: varchar(20), Opcional.
- **notas**: text, Opcional.

### Entidad: `Persona`
- **id**: integer, PK.
- **nombre**: varchar(100), Obligatorio.
- **apellido**: varchar(100), Obligatorio.
- **dni**: varchar(20), Opcional. En la base no tiene restricción unique, pero **la app no
  permite repetirlo** en ningún alta (Clientes, Admin → Usuarios y registro): 409
  `DNI_DUPLICADO`. Los duplicados que ya existían no se migran.
- **sexo**: char(1), Opcional. (M/F/X).
- **fecha_nacimiento**: date, Opcional.
- **domicilio_id**: integer, Opcional. *FK a domicilio.id.*
- **mail**: varchar(100), Opcional en la base. **Obligatorio para los clientes** (regla de la
  app): es su usuario y se guarda en minúsculas. Para los empleados sigue siendo opcional.
- **celular**: varchar(30), Obligatorio.
- **fecha_alta**: timestamp, Obligatorio. *Default: NOW()*.
- **es_cliente**: boolean, Obligatorio. *Default: True*. Indica si la persona es
  cliente/dueño de la clínica. El listado de clientes (`GET /api/clientes`) solo incluye
  filas con `es_cliente = true`. **Cliente y usuario van siempre juntos:** un cliente tiene
  siempre un usuario con rol CLIENTE y un usuario con rol CLIENTE es siempre un cliente
  (`backend/app/services/cuenta_cliente_service.py`). Un empleado (`POST /api/usuarios` con
  otro rol) se guarda con `es_cliente = false`. Como una persona tiene un solo usuario, un
  empleado no puede ser además cliente. Única excepción: la persona del tutor eventual, que es
  cliente sin usuario.

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
- **username**: varchar(100), Obligatorio. *Restricción: Unique (`UQ_Usuario_Username`).* (De 50 a 100 con `scripts/auth/001_portal_y_cuentas_cliente.sql`.) Para un cliente es su
  mail en minúsculas; para un empleado, primera letra del nombre + apellido. El login compara en
  minúsculas cuando lo ingresado tiene "@".
- **habilitado**: boolean, Obligatorio. *Default: True*.
- **rol_id**: integer, Obligatorio. *FK a rol.id*.
- **version_token**: integer, Obligatorio. *Default: 1*. (Para invalidación de JWT).
- **fecha_creacion**: timestamp, Obligatorio. *Default: NOW()*.

### Entidad: `HistorialContrasena`
- **id**: integer, PK.
- **usuario_id**: integer, Obligatorio. *FK a usuario.id*.
- **hashed_password**: varchar(255), Obligatorio.
- **fecha_creacion**: timestamp, Obligatorio. *Default: NOW()*.
- **debe_cambiar**: boolean, Obligatorio. *Default: True*. Si el registro vigente es `true`,
  el login no emite JWT y responde `403 DEBE_CAMBIAR_CONTRASENA` hasta que el usuario
  actualice la clave (`POST /api/auth/cambiar-contrasena-obligatorio`). Ver también
  `docs/login.md` y `docs/alcance_iteracion_uno.md`.

Regla de uso en login: la contraseña vigente de un usuario no se guarda en `usuario`. Se obtiene consultando `HistorialContrasena` filtrado por `usuario_id` y ordenando por `fecha_creacion DESC, id DESC`; el primer registro resultante define el `hashed_password` actual.

### Entidad: `Login`
- **id**: bigserial, PK.
- **usuario_id**: integer, Opcional. *FK a usuario.id*. (Puede ser nulo si el usuario ingresado no existe).
- **username_ingresado**: varchar(100), Obligatorio.
- **fecha**: timestamp, Obligatorio. *Default: NOW()*.
- **exito**: boolean, Obligatorio. (True=Exitoso, False=Fallido).
- **ip**: inet, Obligatorio. (En SQLModel mapear como String o usar tipo IP de SQLAlchemy; en Pydantic, `IPvAnyAddress`).
- **razon_fallo**: varchar(50), Opcional. (Valores: `USUARIO_INEXISTENTE`,
  `USUARIO_DESHABILITADO`, `CLAVE_INCORRECTA`, `SIN_HISTORIAL_CONTRASENA`,
  `DEBE_CAMBIAR_CONTRASENA` — ver `.cursor/rules/rbac-security.mdc`).

---

## Módulo: Catalogo (`catalogo`)

> Tablas paramétricas para Admin → Catálogos y para los combos del alta/edición de
> mascotas. Script DBA de baja lógica: `scripts/base/catalogo_add_activo.sql`. Ver
> `docs/prompts botones/admin_catalogos.md` y
> `docs/modelo_datos_cambios_mascota_20260907.md`.

Campos comunes a todas (salvo donde se indique):
- **id**: integer, PK.
- **nombre**: varchar(50), Obligatorio.
- **descripcion**: varchar(255), Opcional.
- **activo**: boolean, Obligatorio. *Default: True*. Baja lógica (no se borran filas).

### Entidades con `especie_id` (filtro por especie)

`EstadoReproductivo`, `Habitat`, `Tamanio`, `Pelaje`, `Temperamento`:

- **especie_id**: integer, Opcional a nivel BD (nullable histórico). *Idealmente FK a
  `clinica.especie.id`.* En la UI de Admin Catálogos, para altas/ediciones nuevas, se
  exige seleccionar especie (ver spec).

### Entidad: `MascotaEstado` (`catalogo.mascota_estado`)

Catálogo **global** (sin `especie_id`): estado operativo de la mascota. Reemplaza el
antiguo campo libre `clinica.mascota.estado`.

---

## Módulo: Clinica (`clinica`)

> Las tablas de este módulo **existen en PostgreSQL** (Neon main, verificado el 14/11/2026).
> DDL de la historia clínica en `scripts/clinica/001` a `005` (lo aplica el DBA; `fastapi_app`
> solo DML). Ya **no existen** `historial_peso` ni `patologia_predisposicion` (se eliminaron
> el 14/11/2026). Diseño de referencia: `docs/flujo_de_los_datos.md`.

### Entidad: `Especie`
- **id**: integer, PK.
- **nombre**: varchar(50), Obligatorio. *Unique (`UQ_Especie_Nombre`)*.
- **descripcion**: text/varchar, Opcional.
- **activo**: boolean, Obligatorio. *Default: True*.

### Entidad: `Raza`
- **id**: integer, PK.
- **especie_id**: integer, Obligatorio. *FK a `clinica.especie.id`*.
- **nombre**: varchar(50), Obligatorio.
- **descripcion**: text/varchar, Opcional.
- **activo**: boolean, Obligatorio. *Default: True*.
- **codigo**: varchar(60), Opcional. *Unique (`UQ_Raza_Codigo`)*. Código estable que usará el motor;
  solo en razas de la base de conocimiento.
- **talla**: varchar(10), Opcional. Talla de la raza. *Sin CHECK: la lista de valores está pendiente.*
- **peso_referencia_kg**: numeric(5,2), Opcional. Peso típico de un adulto. *CHECK (`CK_Raza_PesoRef`): `> 0`.*

> Hoy `codigo`, `talla` y `peso_referencia_kg` están en NULL en todas las razas.

### Entidad: `Mascota`
- **id**: integer, PK.
- **persona_id**: integer, Obligatorio. *FK a `core.persona.id`* (dueño/tutor).
- **raza_id**: integer, Obligatorio. *FK a `clinica.raza.id`*.
- **nombre**: varchar(50), Obligatorio.
- **fecha_nacimiento**: date, Opcional.
- **ultimo_peso**: decimal(5,2), Opcional. *Lo guarda el alta de mascota con el peso inicial
  (`peso_inicial_kg`). Ya no hay trigger (se eliminó `historial_peso`). Pendiente para la etapa de
  consulta: que el backend lo actualice al firmar una consulta con `peso_kg`.*
- **sexo**: char(1), Opcional. *Restricción CHECK: `'M'`, `'H'`, `'U'`.*
- **microchip**: varchar(15), Opcional. *Unique.*
- **alertas_medicas**: text, Opcional.
- **fecha_alta**: timestamp, Obligatorio. *Default: NOW()*.
- **pelaje_id**: integer, Opcional. *FK a `catalogo.pelaje.id`*.
- **tamanio_id**: integer, Opcional. *FK a `catalogo.tamanio.id`*.
- **habitat_id**: integer, Opcional. *FK a `catalogo.habitat.id`*.
- **estado_reproductivo_id**: integer, Opcional. *FK a `catalogo.estado_reproductivo.id`*.
- **temperamento_id**: integer, Opcional. *FK a `catalogo.temperamento.id`*.
- **mascota_estado_id**: integer, Obligatorio. *FK a `catalogo.mascota_estado.id`*.

> Ya **no** existe la columna libre `estado` (VIVA/FALLECIDA/…). El estado operativo se
> modela con `mascota_estado_id`. No hay columna `castrado`: la castración se registra con
> `estado_reproductivo_id`. El historial de peso es la serie de `consulta.peso_kg`.

### Entidad: `Patologia`
> Patologías candidatas del motor de diagnóstico. Hoy está vacía (carga pendiente).

- **id**: integer, PK. *(Secuencia: `patologia_patologia_id_seq`.)*
- **nombre**: varchar(160), Obligatorio. Nombre en español.
- **descripcion**: text, Opcional.
- **nivel_gravedad**: varchar(20), Opcional. *CHECK: `'Baja' | 'Moderada' | 'Alta' | 'Crítica'`.*
- **codigo**: varchar(100), Obligatorio. *Unique (`UQ_Patologia_Codigo`)*. Código estable (slug de la CIDD);
  no cambia nunca.
- **nombre_en**: varchar(160), Opcional. Nombre original de la fuente.
- **categoria**: varchar(80), Opcional. Grupo de la CIDD.
- **prevalencia**: numeric(6,5), Obligatorio. *CHECK (`CK_Patologia_Prevalencia`): `> 0` y `<= 1`.*
- **prevalencia_nivel**: varchar(20), Obligatorio. *Sin CHECK: la lista de valores está pendiente.*
- **solo_razas_predispuestas**: boolean, Obligatorio. *Default: False*.
- **activo**: boolean, Obligatorio. *Default: True*.

### Entidad: `Sintoma`
> Catálogo de signos que comparten el NLP, el veterinario y el motor. Hoy está vacía
> (carga pendiente). `codigo` no cambia nunca.

- **id**: integer, PK.
- **codigo**: varchar(40), Obligatorio. *Unique (`UQ_Sintoma_Codigo`)*.
- **nombre_es**: varchar(80), Obligatorio.
- **sistema**: varchar(20), Obligatorio. *CHECK (`CK_Sintoma_Sistema`): `'general' | 'piel' | 'oido' |
  'ojo' | 'boca' | 'respiratorio' | 'cardiovascular' | 'digestivo' | 'urinario' | 'reproductor' |
  'musculoesqueletico' | 'neurologico' | 'conducta'`.*
- **tipo**: varchar(12), Obligatorio. *CHECK (`CK_Sintoma_Tipo`): `'observable'` (lo cuenta el dueño) |
  `'examen'` (lo encuentra el veterinario).*
- **activo**: boolean, Obligatorio. *Default: True*.

### Entidad: `Consulta`
> Centro de la historia clínica. Nace en `borrador` y la firma la cierra (`firmada` = solo lectura,
> lo controla el backend).

- **id**: integer, PK.
- **mascota_id**: integer, Obligatorio. *FK a `clinica.mascota.id`*.
- **veterinario_id**: integer, Obligatorio. *FK a `auth.usuario.id`*.
- **turno_id**: integer, Opcional. *FK a `agenda.turno.id`*. *Unique (`UQ_Consulta_Turno`)*: una consulta
  por turno. Nulo = paciente sin turno.
- **fecha_hora**: timestamptz, Obligatorio. Cuándo se atendió.
- **motivo**, **anamnesis**, **examen_fisico**, **tratamiento**, **observaciones**: text, Opcionales.
  Los completa el NLP y los edita el veterinario.
- **peso_kg**: numeric(5,2), Opcional. *CHECK (`CK_Consulta_Peso`): `> 0` y `<= 150`.* Es el historial de
  peso de la mascota.
- **temperatura_c**: numeric(4,1), Opcional. *CHECK (`CK_Consulta_Temperatura`): entre 30 y 45.*
- **estado**: varchar(20), Obligatorio. *Default: `'borrador'`. CHECK (`CK_Consulta_Estado`):
  `'borrador' | 'firmada'`.*
- **consulta_padre_id**: integer, Opcional. *FK a `clinica.consulta.id`*. Para un addendum; no se usa en el prototipo.
- **fecha_firma**: timestamptz, Opcional. *CHECK (`CK_Consulta_Firma`): tiene valor si y solo si
  `estado = 'firmada'`.*
- **fecha_creacion**: timestamptz, Opcional. *Default: now()*.
- **fecha_modificacion**: timestamptz, Opcional. La completa el backend.
- *Índices: `IX_Consulta_MascotaFecha` (`mascota_id`, `fecha_hora DESC`), `IX_Consulta_Veterinario`.*
- *Al borrar: no se puede borrar una consulta con diagnósticos. Sus dictados y signos se borran en cascada.*

### Entidad: `Dictado`
> Una fila por grabación, tal como la devolvió el NLP. No se edita. Una consulta puede tener
> varios dictados (ordenados por `fecha_creacion`). El audio no se guarda.

- **id**: integer, PK.
- **consulta_id**: integer, Obligatorio. *FK a `clinica.consulta.id`, `ON DELETE CASCADE`*.
- **transcripcion**: text, Obligatorio.
- **extraccion_json**: jsonb, Obligatorio. Ficha completa del NLP (contrato 1.0), sin correcciones.
- **modelo_stt**: varchar(60), Obligatorio. Ej. `whisper.cpp/small-q5_1`; `'texto'` si fue sin audio.
- **modelo_llm**: varchar(60), Opcional. Nulo si se usó el extractor por reglas.
- **version_prompt**: varchar(20), Opcional.
- **duracion_audio_s**: numeric(6,1), Opcional.
- **latencia_stt_ms**, **latencia_llm_ms**: integer, Opcionales.
- **fecha_creacion**: timestamptz, Obligatorio. *Default: now()*.
- *Índice: `IX_Dictado_Consulta` (`consulta_id`, `fecha_creacion`).*

### Entidad: `ConsultaSintoma`
> Signos de la consulta, presentes o negados. Un signo negado (`presente = false`) no es lo mismo
> que uno no mencionado (sin fila).

- **id**: integer, PK.
- **consulta_id**: integer, Obligatorio. *FK a `clinica.consulta.id`, `ON DELETE CASCADE`*.
- **sintoma_id**: integer, Opcional. *FK a `clinica.sintoma.id`*. Nulo si el NLP no lo pudo mapear.
- **dictado_id**: integer, Opcional. *FK a `clinica.dictado.id`, `ON DELETE SET NULL`*. Nulo si se cargó a mano.
- **texto_original**: varchar(255), Obligatorio. Fragmento tal como se dictó.
- **presente**: boolean, Obligatorio. *Default: True*.
- **origen**: varchar(10), Obligatorio. *Default: `'nlp'`. CHECK (`CK_ConsultaSintoma_Origen`): `'nlp' | 'manual'`.*
- **confirmado**: boolean, Obligatorio. *Default: False*. Al firmar pasan todos a True.
- **fecha_creacion**: timestamptz, Obligatorio. *Default: now()*.
- *Índice único parcial `UQ_ConsultaSintoma_Sintoma` (`consulta_id`, `sintoma_id`) donde `sintoma_id`
  no es nulo: un signo con código una sola vez por consulta; los textos sin mapear pueden ser varios.*
- *Índice: `IX_ConsultaSintoma_Dictado`.*

### Entidad: `ConsultaDiagnostico`
> Solo se guardan los diagnósticos que el veterinario **acepta**: uno principal y los secundarios
> que quiera conservar (por si una consulta futura descarta el principal). Las sugerencias del
> motor que se descartan no se guardan.

- **id**: integer, PK.
- **consulta_id**: integer, Obligatorio. *FK a `clinica.consulta.id`* (sin cascada).
- **patologia_id**: integer, Opcional. *FK a `clinica.patologia.id`*.
- **descripcion_libre**: varchar(255), Opcional. Diagnóstico escrito a mano si no está en el catálogo.
- **tipo_diagnostico**: varchar(20), Obligatorio. *Default: `'secundario'`. CHECK (`CK_ConsultaDx_Tipo`):
  `'principal' | 'secundario'`.*
- **origen**: varchar(20), Obligatorio. *Default: `'manual'`. CHECK (`CK_ConsultaDx_Origen`):
  `'manual' | 'sugerido_ia'`.*
- **ranking**: smallint, Opcional. *CHECK: 1 a 3.* Puesto en el top 3 del motor. Solo IA.
- **probabilidad_pct**: numeric(5,2), Opcional. *CHECK: 0 a 100.* Solo IA.
- **explicacion**: jsonb, Opcional. Aporte de cada factor y signo al porcentaje. Solo IA.
- **version_motor**: varchar(20), Opcional. Solo IA.
- **confirmado_por_usuario_id**: integer, Obligatorio. *FK a `auth.usuario.id`*: quién lo aceptó.
- **fecha_creacion**: timestamptz, Opcional. *Default: now()*.
- *CHECK (`CK_ConsultaDx_Contenido`): tiene `patologia_id` o `descripcion_libre`.*
- *CHECK (`CK_ConsultaDx_IA`): si `origen = 'sugerido_ia'`, tiene `patologia_id`, `ranking` y `probabilidad_pct`.*
- *CHECK (`CK_ConsultaDx_Manual`): si `origen = 'manual'`, `ranking`, `probabilidad_pct`, `explicacion` y
  `version_motor` son nulos.*
- *Índices únicos parciales: `UQ_ConsultaDx_Principal` (un solo principal por consulta),
  `UQ_ConsultaDx_Patologia` (la misma patología no se repite en una consulta),
  `UQ_ConsultaDx_Ranking` (un diagnóstico por puesto del top 3).*

> Que una consulta firmada tenga exactamente un principal lo valida el backend al firmar.
> Permiso para firmar: `consultas:firmar` (creado en `auth.permiso`; pendiente asignarlo a roles).

---

## Módulo: Agenda (`agenda`)

> DDL en `scripts/agenda/001_agenda_turno.sql` y `scripts/agenda/002_turno_atendido.sql` (lo aplica el DBA; `fastapi_app` solo DML).
> Fechas en `timestamptz` (UTC). El horario de atención vive en `sys.config` (`config_id = 4`).

### Entidad: `TipoTurno` (`agenda.tipo_turno`)
- **id**: integer, PK.
- **nombre**: varchar(50), Obligatorio. *Unique (`UQ_TipoTurno_Nombre`)*.
- **duracion_min**: integer, Obligatorio. *CHECK (`CK_TipoTurno_Duracion`): `> 0` y múltiplo de 30 (módulos de agenda).*
- **activo**: boolean, Obligatorio. *Default: True*.

### Entidad: `Turno` (`agenda.turno`)
- **id**: integer, PK.
- **mascota_id**: integer, Obligatorio. *FK a `clinica.mascota.id`*.
- **veterinario_id**: integer, Obligatorio. *FK a `auth.usuario.id`*. Debe ser un usuario
  habilitado cuyo rol tenga el permiso explícito `agenda:atender` (el comodín `*` no cuenta).
- **tipo_turno_id**: integer, Obligatorio. *FK a `agenda.tipo_turno.id`*.
- **fecha_hora_inicio**: timestamptz, Obligatorio.
- **fecha_hora_fin**: timestamptz, Obligatorio. *Lo calcula el backend: inicio + `tipo_turno.duracion_min`.*
- **estado**: varchar(20), Obligatorio. *Default: `'solicitado'`. CHECK (`CK_Turno_Estado`):
  `'solicitado' | 'confirmado' | 'atendido' | 'cancelado' | 'no_asistio'`.* `atendido` reemplazó a
  `realizado` el 14/11/2026: al firmar la consulta, el backend pasa el turno a `atendido`.
- **canal_origen**: varchar(20), Obligatorio. *Default: `'mostrador'`. CHECK (`CK_Turno_Canal`):
  `'mostrador' | 'telefono' | 'whatsapp' | 'portal'`.*
- *CHECK (`CK_Turno_Rango`): `fecha_hora_fin > fecha_hora_inicio`.*
- *Exclusión (`EX_Turno_SinSuperposicion`, requiere `btree_gist`): un veterinario no puede tener
  dos turnos activos (`solicitado`, `confirmado`, `atendido`) que se superpongan.*
- *Exclusión (`EX_Turno_MascotaSinSuperposicion`): ídem por mascota.*

> Transiciones válidas: `solicitado → confirmado`; `confirmado → atendido | no_asistio` (solo si
> el turno ya comenzó; `atendido` lo pone la firma de la consulta); `solicitado | confirmado → cancelado`. Solo se reprograman turnos
> `solicitado` o `confirmado` y conservan su estado.
>
> *Actualización 16/11/2026:* `atendido` se puede marcar desde `confirmado` aunque el turno todavía
> no haya comenzado (la app muestra un aviso). `no_asistio` sigue exigiendo que haya comenzado.

---

## Módulo: Stock (`stock`) y Comercial (`comercial`)

> DDL en `scripts/stock/001_stock_ventas.sql` (lo aplica el DBA; `fastapi_app` solo DML).
> Inventario único para consultorio y pet shop. El stock solo cambia a través de movimientos;
> el backend actualiza los saldos del producto en la misma transacción que el movimiento.

### Entidad: `Rubro` (`catalogo.rubro`)
- Catálogo global (sin `especie_id`): **id**, **nombre** varchar(50) *Unique (`UQ_Rubro_Nombre`)*,
  **descripcion** varchar(255) opcional, **activo** boolean. Administrable desde Admin → Catálogos.

### Entidad: `Producto` (`stock.producto`)
- **id**: integer, PK.
- **nombre**: varchar(100), Obligatorio. *Unique (`UQ_Producto_Nombre`)*. Incluye la presentación ("Ivermectina 1% 50 ml").
- **rubro_id**: integer, Obligatorio. *FK a `catalogo.rubro.id`*.
- **proveedor**: varchar(100), Opcional (texto libre).
- **unidad**: varchar(20), Obligatorio. *CHECK: `'unidad' | 'ml' | 'comprimido' | 'g' | 'kg'`*. Unidad en la que se mide lo abierto.
- **contenido_envase**: numeric(10,3), Obligatorio. *Default: 1. CHECK > 0*. Ej.: 50 (ml por frasco).
- **fraccionable**: boolean, Obligatorio. *Default: False*. Si es False no puede tener cantidad abierta (`CK_Producto_Fraccion`).
- **envases_cerrados**: integer, Obligatorio. *Default: 0. CHECK >= 0*. Lo único que se vende.
- **cantidad_abierta**: numeric(12,3), Obligatorio. *Default: 0. CHECK >= 0*. Remanente de envases abiertos, en `unidad`.
- **stock_minimo**: integer, Obligatorio. *Default: 0*. En envases cerrados.
- **precio_costo** / **precio_venta**: numeric(12,2), Opcionales. `precio_venta` NULL = no se vende en pet shop.
- **activo**: boolean, Obligatorio. *Default: True*. Un producto inactivo solo admite ajustes.
- **requiere_revision**: boolean, Obligatorio. *Default: False*. Se activa cuando una salida superó lo registrado; se limpia con un ajuste por recuento.

### Entidad: `MovimientoStock` (`stock.movimiento_stock`)
- **id**: integer, PK.
- **producto_id**: integer, Obligatorio. *FK a `stock.producto.id`*.
- **tipo**: varchar(30), Obligatorio. *CHECK: `'compra' | 'venta' | 'consumo_clinico' | 'vencimiento_rotura' | 'ajuste'`*.
  El destino sale del tipo: `venta` = pet shop, `consumo_clinico` = consultorio.
- **delta_envases_cerrados**: integer y **delta_cantidad_abierta**: numeric(12,3). Cuánto cambió cada saldo.
  *CHECK: al menos uno distinto de 0 (`CK_Movimiento_Delta`).*
- **fecha**: timestamptz, Obligatorio. *Default: now()*.
- **usuario_id**: integer, Obligatorio. *FK a `auth.usuario.id`* (quién lo registró).
- **venta_id**: integer, Opcional. *FK a `comercial.venta.id`*. *CHECK: obligatorio sí y solo sí `tipo = 'venta'`.*
- **fecha_vencimiento**: date, Opcional (en compras). **observaciones**: varchar(255), Opcional.
- *Pendiente: `consulta_id` (FK a `clinica.consulta`, que ya existe desde el 14/11/2026) para el consumo clínico (US-09).*

> Consumo clínico: se indica la cantidad (en `unidad` si es fraccionable, en envases si no) y cuántos
> envases se abrieron para ese consumo (0 = de uno ya abierto). El sistema nunca abre envases por su cuenta.
> Ninguna salida se bloquea por falta de stock: si supera lo registrado, el movimiento se guarda con la cantidad
> real, el saldo queda en 0, se agrega un `ajuste` automático por el faltante y el producto queda
> `requiere_revision` (alerta "Revisar stock"). Ajuste: se informan los valores reales del
> recuento y se calcula la diferencia. El alta de producto puede registrar un ajuste "Stock inicial".

### Entidad: `Venta` (`comercial.venta`)
- **id**: integer, PK. **persona_id**: integer, Opcional, *FK a `core.persona.id`* (cliente).
- **usuario_id**: integer, Obligatorio, *FK a `auth.usuario.id`*. **fecha**: timestamptz, *Default: now()*.
- **total**: numeric(12,2), Obligatorio, *CHECK >= 0*.
- **medio_pago**: varchar(20), Obligatorio. *CHECK: `'efectivo' | 'debito' | 'credito' | 'transferencia'`*.

### Entidad: `DetalleVenta` (`comercial.detalle_venta`)
- **id**: integer, PK. **venta_id**: *FK a `comercial.venta.id`*. **producto_id**: *FK a `stock.producto.id`*.
- **cantidad**: integer (envases completos), *CHECK > 0*. **precio_unitario**: numeric(12,2), precio al momento de la venta.
- *Unique (`venta_id`, `producto_id`) = `UQ_DetalleVenta_Producto`.*

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
| 4 | 1 | AGENDA   | HORARIO_LUNES_A_VIERNES  | Franjas de atención L–V, formato `HH:MM-HH:MM` separadas por coma (ej. `08:00-12:00,15:00-20:00`) |
| 4 | 2 | AGENDA   | HORARIO_SABADO           | Franjas de atención del sábado (ej. `08:00-12:00`). Domingo sin parámetro = cerrado |
| 4 | 3 | AGENDA   | DURACION_MODULO_MIN      | Tamaño del módulo de agenda en minutos (`30`) |
| 4 | 4 | AGENDA   | ZONA_HORARIA             | Zona horaria de la clínica (`America/Argentina/Buenos_Aires`) |
| 5 | 1 | STOCK    | DIAS_ALERTA_VENCIMIENTO  | Días de anticipación para alertar vencimientos de compras en Análisis de Stock (`30`) |
