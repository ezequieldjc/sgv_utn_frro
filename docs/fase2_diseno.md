# Fase 2: receta electrónica, vacunas, recordatorios, cobros en cuotas y estudios

Este documento cierra el punto 5 del análisis del 17/11: qué quedó simulado en el prototipo y cómo
se construye cada parte para la entrega final. La idea que lo ordena es la misma del resto del
proyecto. Lo que se simula son los extremos que dependen de terceros (la API de WhatsApp, Mercado
Pago, la firma digital certificada), y lo que se construye ya es el diseño definitivo: las tablas,
los permisos y los mensajes. Así, cuando se reemplaza lo simulado por lo real, no cambian ni la
pantalla ni la base.

Las historias de usuario que se citan son las de la 3ra entrega (US-01 a US-21).

## Qué quedó hecho en el prototipo

**Receta en PDF.** Una consulta firmada que tiene indicaciones de tratamiento genera su receta
desde `GET /api/consultas/{id}/receta.pdf`: encabezado de la clínica (parámetro `RAZON_SOCIAL`),
paciente con especie, raza, sexo, edad y peso, tutor con DNI y celular, diagnóstico principal,
alertas médicas, las indicaciones bajo "Rp./", los estudios pedidos y el bloque de firma con el
veterinario y la fecha de firma. El abstract excluye la integración con dispositivos, así que no
hay impresión: el PDF se descarga y se envía. Se baja desde la consulta y desde **Recetas →
Historial de recetas**. No usa tablas nuevas, porque sale del campo `tratamiento` de la consulta.

**Vacunas y desparasitaciones.** La tabla `clinica.tratamiento_preventivo` (script 008) guarda
cada aplicación. Hay dos maneras de registrarla. "Aplicar ahora" usa un producto del stock de los
rubros Vacuna o Antiparasitario: descuenta un envase y, si se cobra, arma la venta al tutor con
el mismo servicio de la venta de mostrador, todo en una sola transacción. Si no se cobra, el
descuento queda como consumo clínico. "Dosis anterior" registra lo que trae la libreta sanitaria
y no mueve stock. Cada aplicación tiene su próxima dosis (por defecto 365 días para vacunas y 90
para desparasitaciones, parámetros del grupo PREVENTIVA), y una aplicación nueva puede declarar
qué dosis anterior completa (`refuerzo_de_id`), con lo que esa dosis deja de recordarse. Desde un
turno de tipo Vacunación, "Registrar vacuna" lo marca atendido. Cubre US-15 y US-17 en su parte
manual, y la parte de US-09 que corresponde a vacunas.

**Recordatorios por WhatsApp.** La pantalla **Agenda → Recordatorios** lista los turnos pendientes
de mañana (o del día que se elija) y las dosis que vencen en los próximos 7 días o vencieron hace
menos de 30. Para cada uno, el sistema arma el mensaje y el número en formato internacional
(`549` + característica + número) y el botón abre `https://wa.me/<número>?text=<mensaje>`. La
recepción solo toca enviar en su WhatsApp. El envío queda registrado en `agenda.recordatorio`, con
quién lo mandó y cuándo, y la pantalla lo muestra para no mandarlo dos veces. Es la versión
manual de US-07: el mensaje y el registro son los definitivos, y lo único que cambia en la Fase 2
es quién aprieta enviar.

## Receta electrónica (US-05, US-11, US-18)

La receta del prototipo es un documento derivado de la consulta. La receta electrónica de la Fase 2
es una entidad propia, por tres razones. Una consulta puede necesitar más de una receta (por
ejemplo, una para la farmacia y otra para un alimento medicado). Cada medicamento necesita sus
propios datos: dosis, frecuencia, duración y cantidad. Y la receta tiene un ciclo de vida que no es
el de la consulta, porque vence, se puede anular y se dispensa.

| Tabla | Columnas principales |
|-------|----------------------|
| `clinica.receta` | id, consulta_id, numero (correlativo), fecha_emision, fecha_vencimiento, estado (`vigente` / `anulada` / `vencida`), veterinario_id, codigo_validacion (único), hash_documento, motivo_anulacion |
| `clinica.receta_item` | id, receta_id, producto_id (opcional, si está en el stock), medicamento, presentacion, dosis, frecuencia, duracion_dias, via, cantidad, indicaciones |
| `clinica.alergia` (US-18) | id, mascota_id, sustancia, severidad (`leve` / `moderada` / `severa`), fecha_deteccion, activa |

Al usuario veterinario le falta la **matrícula profesional**, que hoy no está en ningún lado. Va
como columna de `auth.usuario` (o de una tabla de profesionales, si se quiere guardar también la
especialidad), y la receta la imprime junto a la firma.

El flujo queda así. Desde la consulta, el veterinario agrega los medicamentos: los puede elegir
del stock o escribirlos. El extractor del dictado puede proponerlos a partir de "indico…", igual
que hoy completa el campo de tratamiento. Antes de firmar, el sistema cruza cada ítem con las
alergias activas de la mascota y muestra la advertencia que pide US-18. Al firmar la consulta se
emite la receta: número, código de validación y hash del PDF. El PDF suma un código QR que lleva a
una página pública de verificación (`/verificar/<código>`), que muestra si la receta es válida y
vigente sin datos personales del tutor. Si un ítem sale del stock y se entrega en la clínica, se
descuenta como consumo clínico vinculado a la consulta (US-09).

La validez legal depende de la normativa vigente para recetas veterinarias. El diseño deja los
datos que esa normativa pide (matrícula, firma, número y código verificable), pero la **firma
digital certificada** es un servicio externo. En la Fase 2 se simula igual que hoy: la firma es la
del sistema, con usuario, fecha y hash. Reemplazarla por un certificado real cambia solo el paso
de firmar.

El portal del cliente (punto 2, Facu) muestra las recetas vigentes de sus mascotas y permite
descargar el mismo PDF (US-11).

## Vacunas: esquemas y productos (US-15, US-17)

El prototipo propone la próxima dosis con un intervalo fijo por tipo. La Fase 2 lo reemplaza por
un catálogo de productos preventivos, que la 3ra entrega ya define:

| Tabla | Columnas principales |
|-------|----------------------|
| `clinica.producto_preventivo` | id, codigo, nombre, tipo (`vacunacion` / `desparasitacion`), especie_id, enfermedad_que_cubre, intervalo_refuerzo_dias, dosis_por_kg (antiparasitarios) |
| `clinica.esquema_preventivo` | id, producto_preventivo_id, numero_dosis, edad_minima_semanas, dias_desde_dosis_anterior (el plan de cachorro: 1ra, 2da, 3ra dosis y refuerzo anual) |

Con eso, la próxima fecha sale del esquema (y del peso, en los antiparasitarios), y el refuerzo
se vincula solo, porque dos aplicaciones del mismo producto preventivo son la misma vacuna. Hoy esa
relación la sugiere la pantalla comparando nombres y el veterinario la confirma.

El stock necesita además **dosis fraccionadas**. Hoy una aplicación usa un envase completo, lo que
sirve para vacunas monodosis pero no para un antiparasitario en comprimidos que se dosifica por
peso. El inventario ya maneja envases abiertos, así que alcanza con que la aplicación registre la
cantidad usada y salga por el mismo movimiento de consumo.

El estado de protección (vigente o vencida) también entra al motor de diagnóstico como factor
`proteccion`, que `PatologiaFactor` ya contempla en el modelo: una vacuna vencida sube la
probabilidad de las enfermedades que cubre.

## Recordatorios automáticos (US-07)

La Fase 2 reemplaza el clic de la recepción por un proceso que corre solo, una vez por día a una
hora configurable. Ese proceso arma la misma lista que hoy muestra la pantalla, crea cada
recordatorio en estado `pendiente` y lo envía por la API de WhatsApp Business. Si el envío sale
bien pasa a `enviado` y, si falla, a `error`, con un reintento (US-07 pide que reintente si el
canal falla). La tabla y los estados ya existen; solo se agregan las columnas del proveedor:

| Tabla | Cambios |
|-------|---------|
| `agenda.recordatorio` | id_mensaje_proveedor, intentos, ultimo_error, fecha_entrega (y los estados `entregado` / `leido` que informa el proveedor) |
| `core.persona` | acepta_whatsapp (el tutor puede pedir no recibir más mensajes) |

Hay una condición que pone WhatsApp y que conviene saber desde ahora: los mensajes que inicia la
empresa tienen que usar **plantillas aprobadas** por Meta. Por eso los textos de hoy ya tienen
forma de plantilla: un saludo con el nombre, la mascota, el día y la hora, y la clínica. Pasarlos a
plantillas es copiar los textos de `recordatorio_service.py` con sus variables.

Como mejora, una respuesta del tutor ("confirmo" o "no puedo") puede llegar por el webhook de
WhatsApp y cambiar el estado del turno, que es la confirmación por WhatsApp que pide US-16.

## Ventas, cobros en cuotas y Mercado Pago

Parte de lo que se preguntó ya está en el modelo. La venta guarda quién la registró
(`comercial.venta.usuario_id`) y a qué cliente (`persona_id`). Por eso la recepción puede ver todas
las ventas con su vendedor, y el portal puede mostrarle a cada cliente las suyas filtrando por
`persona_id`, sin tablas nuevas.

Para las cuotas hay que separar dos casos, porque se resuelven distinto.

**Tarjeta de crédito en cuotas.** Con posnet o con Mercado Pago, quien financia es el emisor de la
tarjeta. La clínica cobra el total (menos la comisión) y no tiene que seguir si el cliente terminó
de pagar. Alcanza con guardar el pago con sus datos:

| Tabla | Columnas principales |
|-------|----------------------|
| `comercial.pago` | id, venta_id, medio, monto, cuotas, interes_pct, recargo, estado (`pendiente` / `aprobado` / `rechazado` / `reintegrado`), proveedor, referencia_externa, fecha |

Una venta puede tener más de un pago, por ejemplo una parte en efectivo y otra con tarjeta.

**Financiación propia de la clínica** (cuenta corriente o "fiado en cuotas"). Acá sí la clínica
presta la plata y necesita saber qué falta cobrar:

| Tabla | Columnas principales |
|-------|----------------------|
| `comercial.plan_cuotas` | id, venta_id, cantidad_cuotas, interes_pct, monto_financiado |
| `comercial.cuota` | id, plan_cuotas_id, numero, vencimiento, monto, pago_id (nulo hasta que se paga) |

El saldo es la suma de las cuotas sin pago. Una cuota vencida puede entrar a la misma pantalla de
recordatorios, como un tercer tipo.

**Mercado Pago simulado.** Mercado Pago ofrece credenciales y tarjetas de prueba (modo sandbox).
El flujo real es: se crea una "preferencia" con el monto, el cliente paga en la página de Mercado
Pago y Mercado Pago avisa el resultado por webhook. Para la entrega alcanza con simular las dos
puntas. "Cobrar con Mercado Pago" crea el pago en `pendiente` y abre una página de checkout falsa
con "Aprobar" y "Rechazar". Esa página llama al mismo endpoint de webhook que llamaría Mercado
Pago, que actualiza el pago y, si se aprueba, confirma la venta. Pasar al sandbox real después es
cambiar la página falsa por la preferencia de Mercado Pago, sin tocar el webhook ni las tablas.

## Estudios complementarios (US-19, US-20) y tipos de turno

Las tablas son las de la 3ra entrega: `clinica.tipo_estudio` (catálogo con categoría:
laboratorio, imágenes, procedimiento), `clinica.patologia_estudio` (qué estudio confirma o descarta
cada patología, con prioridad) y `clinica.estudio_complementario` (consulta_id, tipo_estudio_id,
estado `solicitado` / `realizado`, sugerido_por_sistema, resultado_texto, archivo_adjunto_url). El
motor ya devuelve un estudio sugerido por patología. Con `patologia_estudio`, eso pasa a salir de
la base, y "Pedir estudio" queda a un clic desde la sugerencia. Cuando llega el resultado, se carga
como texto o como archivo. Si confirma un signo de tipo "examen", ese signo entra a la consulta y el
motor recalcula el top 3, que es la puerta de salida del Sprint 9. Los archivos (radiografías,
PDF del laboratorio) no van a la base. Van a un almacenamiento de archivos, y la tabla guarda la
URL.

Sobre los tipos de turno, la pregunta de las radiografías apunta a algo que conviene corregir.
Hoy el comportamiento de un turno se reconoce **por el nombre** del tipo: "Control" vincula la
consulta anterior y "Vacunación" ofrece registrar la vacuna. Funciona, pero si alguien renombra el
tipo, el comportamiento se pierde. La Fase 2 agrega a `agenda.tipo_turno` una columna
`comportamiento` (`consulta`, `control`, `vacunacion`, `estudio`, `cirugia`), y el código mira esa
columna en lugar del nombre. Un turno de tipo `estudio` (radiografía, ecografía) se atiende
cargando el resultado del estudio pedido, igual que uno de vacunación se atiende registrando la
dosis.

## Orden sugerido

La 3ra entrega ya ubica estudios y seguimiento en el Sprint 9 y la receta en el Sprint 10. Lo
que este documento suma encaja así:

1. **Sprint 9:** estudios complementarios y la columna `comportamiento` del tipo de turno.
2. **Sprint 10:** receta electrónica con ítems, alergias y matrícula, y el catálogo de productos
   preventivos con esquemas y dosis fraccionadas.
3. **Sprint 11:** recordatorios automáticos (proceso diario, plantillas, reintento) y pagos con
   Mercado Pago simulado. Los dos dependen de servicios externos, y el panel gerencial (US-12)
   puede mostrar sus resultados: ausentismo antes y después de los recordatorios, y ventas por
   medio de pago.

Lo que ya está construido no hay que rehacerlo en ninguno de los tres: la receta en PDF pasa a
leer `receta_item` en lugar de `tratamiento`, y las vacunas y los recordatorios solo cambian quién
calcula la fecha y quién aprieta enviar.
