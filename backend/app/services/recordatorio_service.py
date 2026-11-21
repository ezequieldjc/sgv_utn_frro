"""Recordatorios por WhatsApp (simulados con wa.me).

El sistema arma el mensaje y el número; la recepción lo envía desde su WhatsApp con el link
`https://wa.me/<número>?text=<mensaje>` y el envío queda registrado en `agenda.recordatorio`.
Es el mismo mensaje que la Fase 2 mandaría sola por la API de WhatsApp (US-07).

Hay dos listas:
  - turnos de un día (por defecto, mañana) que siguen pendientes (solicitados o confirmados);
  - dosis (vacunas y desparasitaciones) que vencen en los próximos DIAS_AVISO_DOSIS días o que
    vencieron hace menos de DIAS_AVISO_DOSIS_VENCIDA, sin refuerzo registrado.
"""

from __future__ import annotations

import re
from collections import defaultdict
from datetime import date, datetime, time, timedelta, timezone
from urllib.parse import quote

from sqlmodel import Session, col, select

from app.core.errors import APIError
from app.models.agenda.recordatorio import Recordatorio
from app.models.clinica.mascota import Mascota
from app.models.clinica.tratamiento_preventivo import TratamientoPreventivo
from app.models.core.persona import Persona
from app.schemas.agenda import TurnoItem
from app.schemas.recordatorios import (
    ContactoTutor,
    RecordatorioCreate,
    RecordatorioDosis,
    RecordatorioEnviado,
    RecordatoriosResponse,
    RecordatorioTurno,
    UltimoEnvio,
)
from app.services.config_service import get_public_razon_social
from app.services.mascota_service import _tutor_eventual_id
from app.services.turno_service import get_turno, get_zona_horaria, list_turnos
from app.services.vacuna_service import (
    _nombre_usuario,
    dosis_a_recordar,
    get_config_preventiva,
    hoy_clinica,
)

PREFIJO_PAIS = "54"
PREFIJO_MOVIL = "9"  # WhatsApp pide 54 9 + característica + número para celulares de Argentina
ESTADOS_TURNO_A_RECORDAR = ("solicitado", "confirmado")
DIAS_SEMANA = ("lunes", "martes", "miércoles", "jueves", "viernes", "sábado", "domingo")


# ---------------------------------------------------------------------------
# Número y link de WhatsApp
# ---------------------------------------------------------------------------


def numero_whatsapp(celular: str | None) -> str | None:
    """Pasa un celular argentino al formato de wa.me: 549 + característica + número (13 dígitos).

    Acepta cómo se agenda habitualmente: 3406419004, +54 9 3406 41-9004, 0341 15 555-1234,
    54 341 5551234. Devuelve None si no se puede interpretar sin adivinar.
    """
    digitos = re.sub(r"\D", "", celular or "")
    if digitos.startswith("00"):
        digitos = digitos[2:]
    if digitos.startswith(PREFIJO_PAIS + PREFIJO_MOVIL) and len(digitos) == 13:
        return digitos
    if digitos.startswith(PREFIJO_PAIS) and len(digitos) == 12:
        digitos = digitos[2:]
    elif digitos.startswith("0"):
        digitos = digitos[1:]
    if len(digitos) == 12:
        # Característica + 15 + número (por ejemplo 341 15 5551234): se saca el 15. La de Buenos
        # Aires (11) tiene 2 dígitos; las demás, 3 o 4.
        largos = (2,) if digitos.startswith("11") else (3, 4)
        for largo in largos:
            if digitos[largo : largo + 2] == "15":
                digitos = digitos[:largo] + digitos[largo + 2 :]
                break
    if len(digitos) != 10 or digitos.startswith("0"):
        return None
    return PREFIJO_PAIS + PREFIJO_MOVIL + digitos


def url_whatsapp(numero: str, mensaje: str) -> str:
    return f"https://wa.me/{numero}?text={quote(mensaje, safe='')}"


def _contacto(session: Session, persona: Persona) -> ContactoTutor:
    whatsapp: str | None = None
    motivo: str | None = None
    if persona.id is not None and persona.id == _tutor_eventual_id(session):
        motivo = "Tutor eventual: no tiene un contacto registrado"
    else:
        whatsapp = numero_whatsapp(persona.celular)
        if whatsapp is None:
            motivo = "El celular no tiene un formato válido para WhatsApp: corregilo en el cliente"
    return ContactoTutor(
        persona_id=persona.id or 0,
        nombre=f"{persona.nombre} {persona.apellido}".strip(),
        celular=persona.celular,
        whatsapp=whatsapp,
        motivo_sin_whatsapp=motivo,
    )


# ---------------------------------------------------------------------------
# Mensajes
# ---------------------------------------------------------------------------


def _dia_y_fecha(fecha: date) -> str:
    return f"{DIAS_SEMANA[fecha.weekday()]} {fecha.day:02d}/{fecha.month:02d}"


def _primer_nombre(nombre: str) -> str:
    partes = nombre.split()
    return partes[0] if partes else nombre


def mensaje_turno(
    *,
    tutor_nombre: str,
    mascota: str,
    inicio_local: datetime,
    tipo_turno: str,
    veterinario: str,
    clinica: str,
    hoy: date,
) -> str:
    fecha = inicio_local.date()
    if fecha == hoy:
        cuando = f"hoy {_dia_y_fecha(fecha)}"
    elif fecha == hoy + timedelta(days=1):
        cuando = f"mañana {_dia_y_fecha(fecha)}"
    else:
        cuando = f"el {_dia_y_fecha(fecha)}"
    hora = f"{inicio_local.hour:02d}:{inicio_local.minute:02d}"
    return (
        f"¡Hola {_primer_nombre(tutor_nombre)}! Te recordamos el turno de {mascota} en {clinica} "
        f"{cuando} a las {hora} ({tipo_turno} con {veterinario}). "
        "Si no pueden venir, avisanos respondiendo este mensaje. ¡Gracias! 🐾"
    )


def mensaje_dosis(
    *,
    tutor_nombre: str,
    mascota: str,
    tipo: str,
    producto: str,
    fecha_proxima: date,
    clinica: str,
    hoy: date,
) -> str:
    saludo = f"¡Hola {_primer_nombre(tutor_nombre)}!"
    fecha = f"{fecha_proxima.day:02d}/{fecha_proxima.month:02d}"
    dias = (fecha_proxima - hoy).days
    if dias < 0:
        que = "La vacuna" if tipo == "vacunacion" else "La desparasitación"
        return (
            f"{saludo} {que} de {mascota} ({producto}) venció el {fecha}. Para mantener la "
            "protección conviene aplicar el refuerzo cuanto antes: respondé este mensaje y le "
            f"reservamos un turno en {clinica}. 🐾"
        )
    if dias == 0:
        cuando = "vence hoy"
    elif dias == 1:
        cuando = "vence mañana"
    else:
        cuando = f"vence el {fecha}"
    que = "la vacuna" if tipo == "vacunacion" else "la desparasitación"
    return (
        f"{saludo} A {mascota} le toca el refuerzo de {que} ({producto}): {cuando}. "
        f"Respondé este mensaje y le reservamos un turno en {clinica}. 🐾"
    )


# ---------------------------------------------------------------------------
# Listado
# ---------------------------------------------------------------------------


def _aware(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def _envios(
    session: Session, *, turno_ids: list[int], dosis_ids: list[int]
) -> tuple[dict[int, list[Recordatorio]], dict[int, list[Recordatorio]]]:
    por_turno: dict[int, list[Recordatorio]] = defaultdict(list)
    por_dosis: dict[int, list[Recordatorio]] = defaultdict(list)
    condiciones = []
    if turno_ids:
        condiciones.append(col(Recordatorio.turno_id).in_(turno_ids))
    if dosis_ids:
        condiciones.append(col(Recordatorio.tratamiento_preventivo_id).in_(dosis_ids))
    for condicion in condiciones:
        for r in session.exec(
            select(Recordatorio)
            .where(condicion, Recordatorio.estado == "enviado")
            .order_by(col(Recordatorio.fecha_envio).desc(), col(Recordatorio.id).desc())
        ).all():
            if r.turno_id is not None:
                por_turno[r.turno_id].append(r)
            elif r.tratamiento_preventivo_id is not None:
                por_dosis[r.tratamiento_preventivo_id].append(r)
    return por_turno, por_dosis


def _ultimo(session: Session, envios: list[Recordatorio]) -> UltimoEnvio | None:
    if not envios:
        return None
    ultimo = envios[0]
    return UltimoEnvio(
        fecha_envio=_aware(ultimo.fecha_envio),
        usuario_nombre=_nombre_usuario(session, ultimo.usuario_id) if ultimo.usuario_id else "",
        destino=ultimo.destino,
    )


def _turnos_del_dia(session: Session, fecha: date) -> list[TurnoItem]:
    zona = get_zona_horaria()
    desde = datetime.combine(fecha, time.min, tzinfo=zona)
    hasta = desde + timedelta(days=1)
    return [
        t
        for t in list_turnos(session, desde=desde, hasta=hasta).items
        if t.estado in ESTADOS_TURNO_A_RECORDAR
        and t.fecha_hora_inicio.astimezone(zona).date() == fecha
    ]


def _armar_turno(
    session: Session, turno: TurnoItem, clinica: str, hoy: date
) -> tuple[RecordatorioTurno, Persona]:
    persona = session.get(Persona, turno.tutor_id)
    if persona is None:
        raise APIError(404, "CLIENTE_NO_ENCONTRADO", "No se encontró el tutor del turno")
    contacto = _contacto(session, persona)
    veterinario = f"{turno.veterinario_nombre} {turno.veterinario_apellido}".strip()
    mensaje = mensaje_turno(
        tutor_nombre=persona.nombre,
        mascota=turno.mascota_nombre,
        inicio_local=turno.fecha_hora_inicio.astimezone(get_zona_horaria()),
        tipo_turno=turno.tipo_turno_nombre,
        veterinario=veterinario,
        clinica=clinica,
        hoy=hoy,
    )
    item = RecordatorioTurno(
        turno_id=turno.id,
        fecha_hora_inicio=turno.fecha_hora_inicio,
        estado_turno=turno.estado,
        tipo_turno=turno.tipo_turno_nombre,
        veterinario_nombre=veterinario,
        mascota_id=turno.mascota_id,
        mascota_nombre=turno.mascota_nombre,
        tutor=contacto,
        mensaje=mensaje,
        url_whatsapp=url_whatsapp(contacto.whatsapp, mensaje) if contacto.whatsapp else None,
    )
    return item, persona


def _armar_dosis(
    session: Session, dosis: TratamientoPreventivo, clinica: str, hoy: date
) -> tuple[RecordatorioDosis, Persona]:
    mascota = session.get(Mascota, dosis.mascota_id)
    persona = session.get(Persona, mascota.persona_id) if mascota else None
    if mascota is None or persona is None or dosis.fecha_proxima_dosis is None:
        raise APIError(404, "DOSIS_NO_ENCONTRADA", "No se encontró la dosis indicada")
    contacto = _contacto(session, persona)
    mensaje = mensaje_dosis(
        tutor_nombre=persona.nombre,
        mascota=mascota.nombre,
        tipo=dosis.tipo,
        producto=dosis.nombre_producto,
        fecha_proxima=dosis.fecha_proxima_dosis,
        clinica=clinica,
        hoy=hoy,
    )
    item = RecordatorioDosis(
        tratamiento_preventivo_id=dosis.id or 0,
        tipo=dosis.tipo,  # type: ignore[arg-type]
        nombre_producto=dosis.nombre_producto,
        fecha_aplicacion=dosis.fecha_aplicacion,
        fecha_proxima_dosis=dosis.fecha_proxima_dosis,
        dias_para_vencer=(dosis.fecha_proxima_dosis - hoy).days,
        mascota_id=mascota.id or 0,
        mascota_nombre=mascota.nombre,
        tutor=contacto,
        mensaje=mensaje,
        url_whatsapp=url_whatsapp(contacto.whatsapp, mensaje) if contacto.whatsapp else None,
    )
    return item, persona


def listar_pendientes(session: Session, fecha_turnos: date | None = None) -> RecordatoriosResponse:
    hoy = hoy_clinica()
    fecha = fecha_turnos or hoy + timedelta(days=1)
    config = get_config_preventiva(session)
    clinica = get_public_razon_social()

    turnos = [_armar_turno(session, t, clinica, hoy)[0] for t in _turnos_del_dia(session, fecha)]
    dosis = [
        _armar_dosis(session, d, clinica, hoy)[0] for d in dosis_a_recordar(session, hoy, config)
    ]

    por_turno, por_dosis = _envios(
        session,
        turno_ids=[t.turno_id for t in turnos],
        dosis_ids=[d.tratamiento_preventivo_id for d in dosis],
    )
    for t in turnos:
        t.envios = len(por_turno.get(t.turno_id, []))
        t.ultimo_envio = _ultimo(session, por_turno.get(t.turno_id, []))
    for d in dosis:
        d.envios = len(por_dosis.get(d.tratamiento_preventivo_id, []))
        d.ultimo_envio = _ultimo(session, por_dosis.get(d.tratamiento_preventivo_id, []))

    return RecordatoriosResponse(
        hoy=hoy,
        fecha_turnos=fecha,
        dias_aviso_dosis=config.dias_aviso_dosis,
        dias_aviso_dosis_vencida=config.dias_aviso_dosis_vencida,
        turnos=turnos,
        dosis=dosis,
    )


# ---------------------------------------------------------------------------
# Registro del envío
# ---------------------------------------------------------------------------


def registrar_envio(
    session: Session, payload: RecordatorioCreate, usuario_id: int
) -> RecordatorioEnviado:
    """Guarda el recordatorio que la recepción acaba de abrir en WhatsApp.

    El mensaje y el número se vuelven a armar acá (no se toman del navegador), así lo que queda
    registrado es lo que el sistema generó.
    """
    hoy = hoy_clinica()
    clinica = get_public_razon_social()
    if payload.turno_id is not None:
        turno = get_turno(session, payload.turno_id)
        if turno.estado not in ESTADOS_TURNO_A_RECORDAR:
            raise APIError(
                400, "TURNO_NO_PENDIENTE", "El turno ya no está pendiente: no hace falta recordarlo"
            )
        item, persona = _armar_turno(session, turno, clinica, hoy)
        tipo = "turno"
    else:
        dosis = session.get(TratamientoPreventivo, payload.tratamiento_preventivo_id or 0)
        if dosis is None or dosis.fecha_proxima_dosis is None:
            raise APIError(404, "DOSIS_NO_ENCONTRADA", "No se encontró la dosis indicada")
        item, persona = _armar_dosis(session, dosis, clinica, hoy)
        tipo = "dosis"

    if item.tutor.whatsapp is None or item.url_whatsapp is None:
        raise APIError(400, "SIN_WHATSAPP", item.tutor.motivo_sin_whatsapp or "Sin WhatsApp")

    recordatorio = Recordatorio(
        tipo=tipo,
        turno_id=payload.turno_id,
        tratamiento_preventivo_id=payload.tratamiento_preventivo_id,
        persona_id=persona.id or 0,
        destino=item.tutor.whatsapp,
        mensaje=item.mensaje,
        usuario_id=usuario_id,
    )
    session.add(recordatorio)
    session.commit()
    session.refresh(recordatorio)
    return RecordatorioEnviado(
        id=recordatorio.id or 0,
        tipo=tipo,  # type: ignore[arg-type]
        fecha_envio=_aware(recordatorio.fecha_envio),
        destino=recordatorio.destino,
        mensaje=recordatorio.mensaje,
        url_whatsapp=item.url_whatsapp,
        usuario_nombre=_nombre_usuario(session, usuario_id),
    )
