# Recordatorios por WhatsApp — `/recordatorios`

Menú **Agenda → Recordatorios**. Es la versión manual de US-07: el sistema arma el mensaje y el
número de cada tutor, y la recepción lo envía desde su WhatsApp con un clic. El envío automático
por la API de WhatsApp está diseñado en `docs/fase2_diseno.md`.

## Qué lista

- **Turnos del día elegido** (por defecto, mañana) que siguen pendientes, es decir, solicitados o
  confirmados. Los cancelados y los atendidos no se recuerdan.
- **Vacunas y desparasitaciones** cuya próxima dosis vence en los próximos `DIAS_AVISO_DOSIS`
  días (7) o venció hace menos de `DIAS_AVISO_DOSIS_VENCIDA` (30), sin el refuerzo registrado, de
  mascotas que se atienden (no fallecidas ni dadas de baja).

## Cómo se envía

**Enviar por WhatsApp** es un link a `https://wa.me/<número>?text=<mensaje>` que se abre en otra
pestaña (WhatsApp Web o la app) con el mensaje escrito. Al tocarlo, el sistema registra el envío
en `agenda.recordatorio`. Ese registro guarda quién lo mandó, cuándo, a qué número y el texto, que
el backend vuelve a armar en lugar de tomarlo del navegador. La fila muestra después "Enviado el
… por …" y el botón pasa a **Reenviar**.

El número se arma desde el celular del cliente en el formato que pide WhatsApp para Argentina:
`549` + característica + número, sin el 0 ni el 15. Se aceptan las formas habituales de agendarlo:
`3406419004`, `+54 9 3406 41-9004`, `03406 15 419004` y `0341 15 555-1234`. Si el celular no se
puede interpretar, o el tutor es el tutor eventual, la fila dice por qué no se puede enviar.

## Mensajes

Turno: "¡Hola Joaquín! Te recordamos el turno de Simón en Yacanvet mañana miércoles 18/11 a las
10:00 (Consulta con Valeria Sosa). Si no pueden venir, avisanos respondiendo este mensaje.
¡Gracias! 🐾"

Dosis por vencer: "¡Hola Joaquín! A Felipe le toca el refuerzo de la vacuna (Vacuna Séxtuple):
vence el 20/11. Respondé este mensaje y le reservamos un turno en Yacanvet. 🐾"

Dosis vencida: "¡Hola Joaquín! La desparasitación de Simón (Antiparasitario interno) venció el
08/11. Para mantener la protección conviene aplicar el refuerzo cuanto antes: respondé este mensaje
y le reservamos un turno en Yacanvet. 🐾"

El nombre de la clínica es el parámetro `RAZON_SOCIAL`. Los textos están en
`backend/app/services/recordatorio_service.py` y ya tienen la forma de las plantillas que pide la
API de WhatsApp para la Fase 2.

## Permisos y API

Todo requiere `recordatorios:enviar`, que el script 008 les da a los roles que tienen
`agenda:crear_turno`.

| Método y ruta | Qué hace |
|---------------|----------|
| `GET /api/recordatorios/pendientes?fecha_turnos=` | Turnos del día (por defecto, mañana) y dosis por vencer o vencidas, con el mensaje, el link y el último envío |
| `POST /api/recordatorios` | Registra un envío. Lleva `turno_id` o `tratamiento_preventivo_id` (uno de los dos) |

Errores: `TURNO_NO_PENDIENTE`, `DOSIS_NO_ENCONTRADA`, `SIN_WHATSAPP`.

## Tests

`backend/tests/test_recordatorios.py` (formatos de celular, textos, qué entra en cada lista,
registro del envío, tutor eventual, permisos), `frontend/src/lib/recordatorios.test.ts` y
`frontend/src/pages/recordatorios/recordatorios-page.test.tsx`.
