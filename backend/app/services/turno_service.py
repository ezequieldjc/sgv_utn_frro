from __future__ import annotations

from dataclasses import dataclass
from datetime import date, datetime, time, timedelta, timezone
from zoneinfo import ZoneInfo, ZoneInfoNotFoundError

from sqlalchemy import or_
from sqlalchemy import select as sa_select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import aliased
from sqlmodel import Session, col, select

from app.core.errors import APIError
from app.core.time_utils import utc_now
from app.models.agenda.tipo_turno import TipoTurno
from app.models.agenda.turno import Turno
from app.models.auth.permiso import Permiso
from app.models.auth.rol_permiso import RolPermiso
from app.models.auth.usuario import Usuario
from app.models.clinica.especie import Especie
from app.models.clinica.mascota import Mascota
from app.models.clinica.raza import Raza
from app.models.core.persona import Persona
from app.schemas.agenda import (
    DisponibilidadResponse,
    FranjaDisponible,
    FranjaHoraria,
    HorarioAtencion,
    HorarioDia,
    MascotaAgendaOpcion,
    TipoTurnoOpcion,
    TurnoCambioEstado,
    TurnoCreate,
    TurnoItem,
    TurnoListResponse,
    TurnoReprogramar,
    VeterinarioOpcion,
)
from app.services.config_service import get_config_value
from app.services.mascota_service import MASCOTA_ESTADO_ACTIVA_ID

PERMISO_ATENDER = "agenda:atender"

# Estados que ocupan el horario (igual que el WHERE de las exclusiones en Postgres).
ESTADOS_ACTIVOS = ("solicitado", "confirmado", "realizado")
ESTADOS_MODIFICABLES = ("solicitado", "confirmado")

# Estado destino -> estados de origen permitidos (Figura 5 de la 3ra entrega).
TRANSICIONES: dict[str, tuple[str, ...]] = {
    "confirmado": ("solicitado",),
    "realizado": ("confirmado",),
    "no_asistio": ("confirmado",),
    "cancelado": ESTADOS_MODIFICABLES,
}

# sys.config: config_id = 4 (AGENDA)
CONFIG_AGENDA_ID = 4
PARAM_HORARIO_LUNES_A_VIERNES = 1
PARAM_HORARIO_SABADO = 2
PARAM_DURACION_MODULO_MIN = 3
PARAM_ZONA_HORARIA = 4

DEFAULT_HORARIO_LUNES_A_VIERNES = "08:00-12:00,15:00-20:00"
DEFAULT_HORARIO_SABADO = "08:00-12:00"
DEFAULT_DURACION_MODULO_MIN = "30"
DEFAULT_ZONA_HORARIA = "America/Argentina/Buenos_Aires"

MAX_RANGO_LISTADO = timedelta(days=62)

# Nombres de las exclusiones en Postgres (para traducir IntegrityError a 409).
EX_VETERINARIO = "EX_Turno_SinSuperposicion"
EX_MASCOTA = "EX_Turno_MascotaSinSuperposicion"


# ---------------------------------------------------------------------------
# Horario de atención (sys.config)
# ---------------------------------------------------------------------------


@dataclass(frozen=True)
class Franja:
    desde: time
    hasta: time


def _parse_franjas(raw: str, parametro: str) -> list[Franja]:
    """Parsea "HH:MM-HH:MM,HH:MM-HH:MM". Cadena vacía = día cerrado."""
    franjas: list[Franja] = []
    for parte in (p.strip() for p in raw.split(",")):
        if not parte:
            continue
        try:
            desde_txt, hasta_txt = (x.strip() for x in parte.split("-"))
            desde = time.fromisoformat(desde_txt)
            hasta = time.fromisoformat(hasta_txt)
        except ValueError as exc:
            raise APIError(
                500,
                "CONFIG_INVALIDA",
                f"El parámetro de agenda '{parametro}' tiene un formato inválido",
            ) from exc
        if hasta <= desde:
            raise APIError(
                500,
                "CONFIG_INVALIDA",
                f"El parámetro de agenda '{parametro}' tiene una franja inválida",
            )
        franjas.append(Franja(desde=desde, hasta=hasta))
    return sorted(franjas, key=lambda f: f.desde)


def get_zona_horaria() -> ZoneInfo:
    nombre = get_config_value(CONFIG_AGENDA_ID, PARAM_ZONA_HORARIA, default=DEFAULT_ZONA_HORARIA)
    try:
        return ZoneInfo(nombre)
    except ZoneInfoNotFoundError as exc:
        raise APIError(500, "CONFIG_INVALIDA", f"Zona horaria inválida: '{nombre}'") from exc


def get_duracion_modulo_min() -> int:
    raw = get_config_value(
        CONFIG_AGENDA_ID, PARAM_DURACION_MODULO_MIN, default=DEFAULT_DURACION_MODULO_MIN
    )
    try:
        valor = int(raw)
    except ValueError as exc:
        raise APIError(500, "CONFIG_INVALIDA", "DURACION_MODULO_MIN debe ser un entero") from exc
    if valor <= 0:
        raise APIError(500, "CONFIG_INVALIDA", "DURACION_MODULO_MIN debe ser mayor a 0")
    return valor


def get_franjas_por_dia() -> dict[int, list[Franja]]:
    """Franjas por día de la semana (0 = lunes). Domingo sin franjas = cerrado."""
    lunes_a_viernes = _parse_franjas(
        get_config_value(
            CONFIG_AGENDA_ID,
            PARAM_HORARIO_LUNES_A_VIERNES,
            default=DEFAULT_HORARIO_LUNES_A_VIERNES,
        ),
        "HORARIO_LUNES_A_VIERNES",
    )
    sabado = _parse_franjas(
        get_config_value(CONFIG_AGENDA_ID, PARAM_HORARIO_SABADO, default=DEFAULT_HORARIO_SABADO),
        "HORARIO_SABADO",
    )
    franjas: dict[int, list[Franja]] = {dia: lunes_a_viernes for dia in range(5)}
    franjas[5] = sabado
    franjas[6] = []
    return franjas


def get_horario_atencion() -> HorarioAtencion:
    franjas = get_franjas_por_dia()
    return HorarioAtencion(
        zona_horaria=str(get_zona_horaria()),
        duracion_modulo_min=get_duracion_modulo_min(),
        dias=[
            HorarioDia(
                dia_semana=dia,
                franjas=[
                    FranjaHoraria(desde=f.desde.strftime("%H:%M"), hasta=f.hasta.strftime("%H:%M"))
                    for f in franjas[dia]
                ],
            )
            for dia in range(7)
        ],
    )


# ---------------------------------------------------------------------------
# Fechas
# ---------------------------------------------------------------------------


def _to_utc(value: datetime) -> datetime:
    """Normaliza una fecha de entrada a UTC. Sin zona horaria = hora local de la clínica."""
    if value.tzinfo is None:
        value = value.replace(tzinfo=get_zona_horaria())
    return value.astimezone(timezone.utc)


def _from_db(value: datetime) -> datetime:
    """SQLite devuelve datetimes naive (guardados en UTC); Postgres los devuelve aware."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value.astimezone(timezone.utc)


# ---------------------------------------------------------------------------
# Validaciones
# ---------------------------------------------------------------------------


def _validar_no_pasado(inicio: datetime) -> None:
    if inicio <= utc_now():
        raise APIError(400, "TURNO_EN_EL_PASADO", "No se puede agendar un turno en el pasado")


def _validar_horario(inicio: datetime, fin: datetime) -> None:
    """El turno debe empezar en un módulo exacto y entrar completo en una franja de
    atención del mismo día (hora local de la clínica)."""
    tz = get_zona_horaria()
    inicio_local = inicio.astimezone(tz)
    fin_local = fin.astimezone(tz)

    modulo = get_duracion_modulo_min()
    minutos = inicio_local.hour * 60 + inicio_local.minute
    if inicio_local.second or inicio_local.microsecond or minutos % modulo:
        raise APIError(
            400,
            "TURNO_FUERA_DE_MODULO",
            f"El turno debe comenzar en un módulo de {modulo} minutos (ej. 08:00, 08:30)",
        )

    franjas = get_franjas_por_dia().get(inicio_local.weekday(), [])
    if not franjas:
        raise APIError(400, "DIA_SIN_ATENCION", "La clínica no atiende ese día")

    if fin_local.date() == inicio_local.date():
        for franja in franjas:
            if franja.desde <= inicio_local.time() and fin_local.time() <= franja.hasta:
                return

    raise APIError(
        400,
        "TURNO_FUERA_DE_HORARIO",
        "El turno debe quedar completo dentro del horario de atención",
    )


def _get_tipo_turno_activo(session: Session, tipo_turno_id: int) -> TipoTurno:
    tipo = session.get(TipoTurno, tipo_turno_id)
    if tipo is None:
        raise APIError(404, "TIPO_TURNO_NO_ENCONTRADO", "No se encontró el tipo de turno indicado")
    if not tipo.activo:
        raise APIError(400, "TIPO_TURNO_INACTIVO", "El tipo de turno indicado no está activo")
    return tipo


def _validar_mascota(session: Session, mascota_id: int) -> None:
    mascota = session.get(Mascota, mascota_id)
    if mascota is None:
        raise APIError(404, "MASCOTA_NO_ENCONTRADA", "No se encontró la mascota indicada")
    if mascota.mascota_estado_id != MASCOTA_ESTADO_ACTIVA_ID:
        raise APIError(400, "MASCOTA_NO_ACTIVA", "La mascota indicada no está activa")


def es_veterinario_asignable(session: Session, usuario_id: int) -> bool:
    """Asignable = usuario habilitado cuyo rol tiene `agenda:atender` EXPLÍCITO.
    El comodín `*` no cuenta: un administrador no es veterinario por tener acceso total."""
    stmt = (
        select(Usuario.id)
        .join(RolPermiso, RolPermiso.rol_id == Usuario.rol_id)
        .join(Permiso, Permiso.id == RolPermiso.permiso_id)
        .where(
            Usuario.id == usuario_id,
            Usuario.habilitado.is_(True),
            Permiso.nombre == PERMISO_ATENDER,
        )
    )
    return session.exec(stmt).first() is not None


def _validar_veterinario(session: Session, veterinario_id: int) -> None:
    if not es_veterinario_asignable(session, veterinario_id):
        raise APIError(
            400,
            "VETERINARIO_INVALIDO",
            "El usuario indicado no está habilitado para atender turnos",
        )


def _turnos_activos_superpuestos(
    session: Session,
    *,
    inicio: datetime,
    fin: datetime,
    veterinario_id: int | None = None,
    mascota_id: int | None = None,
    excluir_turno_id: int | None = None,
) -> list[Turno]:
    stmt = select(Turno).where(
        col(Turno.estado).in_(ESTADOS_ACTIVOS),
        Turno.fecha_hora_inicio < fin,
        Turno.fecha_hora_fin > inicio,
    )
    if veterinario_id is not None:
        stmt = stmt.where(Turno.veterinario_id == veterinario_id)
    if mascota_id is not None:
        stmt = stmt.where(Turno.mascota_id == mascota_id)
    if excluir_turno_id is not None:
        stmt = stmt.where(Turno.id != excluir_turno_id)
    return list(session.exec(stmt).all())


def _validar_superposiciones(
    session: Session,
    *,
    veterinario_id: int,
    mascota_id: int,
    inicio: datetime,
    fin: datetime,
    excluir_turno_id: int | None = None,
) -> None:
    if _turnos_activos_superpuestos(
        session,
        inicio=inicio,
        fin=fin,
        veterinario_id=veterinario_id,
        excluir_turno_id=excluir_turno_id,
    ):
        raise APIError(
            409, "TURNO_SUPERPUESTO", "El veterinario ya tiene un turno en ese horario"
        )
    if _turnos_activos_superpuestos(
        session,
        inicio=inicio,
        fin=fin,
        mascota_id=mascota_id,
        excluir_turno_id=excluir_turno_id,
    ):
        raise APIError(
            409,
            "MASCOTA_CON_TURNO_SUPERPUESTO",
            "La mascota ya tiene un turno en ese horario",
        )


def _commit_turno(session: Session) -> None:
    """Commit traduciendo las exclusiones de Postgres a 409 (caso de dos altas
    simultáneas que pasan la validación previa al mismo tiempo)."""
    try:
        session.commit()
    except IntegrityError as exc:
        session.rollback()
        mensaje = str(exc.orig)
        if EX_MASCOTA in mensaje:
            raise APIError(
                409,
                "MASCOTA_CON_TURNO_SUPERPUESTO",
                "La mascota ya tiene un turno en ese horario",
            ) from exc
        if EX_VETERINARIO in mensaje:
            raise APIError(
                409, "TURNO_SUPERPUESTO", "El veterinario ya tiene un turno en ese horario"
            ) from exc
        raise


# ---------------------------------------------------------------------------
# Consultas
# ---------------------------------------------------------------------------


def _turno_items_query():
    tutor = aliased(Persona)
    vet_persona = aliased(Persona)
    return (
        sa_select(
            Turno,
            Mascota.nombre,
            tutor.id,
            tutor.nombre,
            tutor.apellido,
            tutor.celular,
            vet_persona.nombre,
            vet_persona.apellido,
            TipoTurno.nombre,
        )
        .join(Mascota, Mascota.id == Turno.mascota_id)
        .join(tutor, tutor.id == Mascota.persona_id)
        .join(Usuario, Usuario.id == Turno.veterinario_id)
        .join(vet_persona, vet_persona.id == Usuario.persona_id)
        .join(TipoTurno, TipoTurno.id == Turno.tipo_turno_id)
    )


def _row_to_item(row) -> TurnoItem:
    (
        turno,
        mascota_nombre,
        tutor_id,
        tutor_nombre,
        tutor_apellido,
        tutor_celular,
        vet_nombre,
        vet_apellido,
        tipo_nombre,
    ) = row
    return TurnoItem(
        id=turno.id or 0,
        mascota_id=turno.mascota_id,
        mascota_nombre=mascota_nombre,
        tutor_id=tutor_id,
        tutor_nombre=tutor_nombre,
        tutor_apellido=tutor_apellido,
        tutor_celular=tutor_celular,
        veterinario_id=turno.veterinario_id,
        veterinario_nombre=vet_nombre,
        veterinario_apellido=vet_apellido,
        tipo_turno_id=turno.tipo_turno_id,
        tipo_turno_nombre=tipo_nombre,
        fecha_hora_inicio=_from_db(turno.fecha_hora_inicio),
        fecha_hora_fin=_from_db(turno.fecha_hora_fin),
        estado=turno.estado,
        canal_origen=turno.canal_origen,
    )


def list_turnos(
    session: Session,
    *,
    desde: datetime,
    hasta: datetime,
    veterinario_id: int | None = None,
) -> TurnoListResponse:
    desde_utc = _to_utc(desde)
    hasta_utc = _to_utc(hasta)
    if hasta_utc <= desde_utc:
        raise APIError(400, "RANGO_INVALIDO", "'hasta' debe ser posterior a 'desde'")
    if hasta_utc - desde_utc > MAX_RANGO_LISTADO:
        raise APIError(
            400, "RANGO_DEMASIADO_AMPLIO", "El rango consultado no puede superar los 62 días"
        )

    stmt = _turno_items_query().where(
        Turno.fecha_hora_inicio < hasta_utc,
        Turno.fecha_hora_fin > desde_utc,
    )
    if veterinario_id is not None:
        stmt = stmt.where(Turno.veterinario_id == veterinario_id)
    stmt = stmt.order_by(Turno.fecha_hora_inicio, Turno.id)

    rows = session.execute(stmt).all()
    return TurnoListResponse(items=[_row_to_item(row) for row in rows])


def get_turno(session: Session, turno_id: int) -> TurnoItem:
    row = session.execute(_turno_items_query().where(Turno.id == turno_id)).first()
    if row is None:
        raise APIError(404, "TURNO_NO_ENCONTRADO", "No se encontró el turno indicado")
    return _row_to_item(row)


def _get_turno_model(session: Session, turno_id: int) -> Turno:
    turno = session.get(Turno, turno_id)
    if turno is None:
        raise APIError(404, "TURNO_NO_ENCONTRADO", "No se encontró el turno indicado")
    return turno


def list_veterinarios(session: Session) -> list[VeterinarioOpcion]:
    stmt = (
        select(Usuario.id, Usuario.username, Persona.nombre, Persona.apellido)
        .join(Persona, Persona.id == Usuario.persona_id)
        .join(RolPermiso, RolPermiso.rol_id == Usuario.rol_id)
        .join(Permiso, Permiso.id == RolPermiso.permiso_id)
        .where(Usuario.habilitado.is_(True), Permiso.nombre == PERMISO_ATENDER)
        .order_by(Persona.apellido, Persona.nombre)
    )
    return [
        VeterinarioOpcion(id=row[0], username=row[1], nombre=row[2], apellido=row[3])
        for row in session.exec(stmt).all()
    ]


def list_tipos_turno_activos(session: Session) -> list[TipoTurnoOpcion]:
    rows = session.exec(
        select(TipoTurno).where(TipoTurno.activo.is_(True)).order_by(TipoTurno.nombre)
    ).all()
    return [
        TipoTurnoOpcion(id=row.id or 0, nombre=row.nombre, duracion_min=row.duracion_min)
        for row in rows
    ]


def buscar_mascotas(session: Session, q: str, *, limit: int = 20) -> list[MascotaAgendaOpcion]:
    """Busca mascotas activas por nombre de la mascota o nombre/apellido/DNI del tutor."""
    term = q.strip()
    if not term:
        return []
    like = f"%{term}%"
    stmt = (
        sa_select(
            Mascota.id,
            Mascota.nombre,
            Especie.nombre,
            Raza.nombre,
            Persona.id,
            Persona.nombre,
            Persona.apellido,
            Persona.dni,
        )
        .join(Raza, Raza.id == Mascota.raza_id)
        .join(Especie, Especie.id == Raza.especie_id)
        .join(Persona, Persona.id == Mascota.persona_id)
        .where(
            Mascota.mascota_estado_id == MASCOTA_ESTADO_ACTIVA_ID,
            or_(
                col(Mascota.nombre).ilike(like),
                col(Persona.nombre).ilike(like),
                col(Persona.apellido).ilike(like),
                col(Persona.dni).ilike(like),
            ),
        )
        .order_by(Mascota.nombre, Persona.apellido)
        .limit(limit)
    )
    return [
        MascotaAgendaOpcion(
            id=row[0],
            nombre=row[1],
            especie_nombre=row[2],
            raza_nombre=row[3],
            tutor_id=row[4],
            tutor_nombre=row[5],
            tutor_apellido=row[6],
            tutor_dni=row[7],
        )
        for row in session.execute(stmt).all()
    ]


def _items_activos_superpuestos(
    session: Session,
    *,
    inicio: datetime,
    fin: datetime,
    veterinario_id: int | None = None,
    mascota_id: int | None = None,
    excluir_turno_id: int | None = None,
) -> list[TurnoItem]:
    """Igual que `_turnos_activos_superpuestos` pero con los datos para mostrar."""
    stmt = _turno_items_query().where(
        col(Turno.estado).in_(ESTADOS_ACTIVOS),
        Turno.fecha_hora_inicio < fin,
        Turno.fecha_hora_fin > inicio,
    )
    if veterinario_id is not None:
        stmt = stmt.where(Turno.veterinario_id == veterinario_id)
    if mascota_id is not None:
        stmt = stmt.where(Turno.mascota_id == mascota_id)
    if excluir_turno_id is not None:
        stmt = stmt.where(Turno.id != excluir_turno_id)
    return [_row_to_item(row) for row in session.execute(stmt.order_by(Turno.fecha_hora_inicio)).all()]


def get_disponibilidad(
    session: Session,
    *,
    veterinario_id: int,
    fecha: date,
    tipo_turno_id: int,
    mascota_id: int | None = None,
    excluir_turno_id: int | None = None,
) -> DisponibilidadResponse:
    """Todos los módulos del horario de atención de esa fecha para un turno de ese tipo
    con ese veterinario. Cada módulo indica si está disponible y, si no, el motivo
    (en este orden de prioridad): ya pasó, no entra completo en la franja, el
    veterinario tiene otro turno, o la mascota (si se indica) tiene otro turno."""
    _validar_veterinario(session, veterinario_id)
    tipo = _get_tipo_turno_activo(session, tipo_turno_id)
    duracion = timedelta(minutes=tipo.duracion_min)
    paso = timedelta(minutes=get_duracion_modulo_min())
    tz = get_zona_horaria()

    dia_inicio = datetime.combine(fecha, time.min, tzinfo=tz).astimezone(timezone.utc)
    dia_fin = dia_inicio + timedelta(days=1)
    ocupados_vet = _items_activos_superpuestos(
        session,
        inicio=dia_inicio,
        fin=dia_fin,
        veterinario_id=veterinario_id,
        excluir_turno_id=excluir_turno_id,
    )
    ocupados_mascota = (
        _items_activos_superpuestos(
            session,
            inicio=dia_inicio,
            fin=dia_fin,
            mascota_id=mascota_id,
            excluir_turno_id=excluir_turno_id,
        )
        if mascota_id is not None
        else []
    )

    def hhmm(value: datetime) -> str:
        return value.astimezone(tz).strftime("%H:%M")

    def superpuesto(items: list[TurnoItem], inicio: datetime, fin: datetime) -> TurnoItem | None:
        return next(
            (t for t in items if t.fecha_hora_inicio < fin and t.fecha_hora_fin > inicio), None
        )

    ahora = utc_now()
    franjas: list[FranjaDisponible] = []
    for franja in get_franjas_por_dia().get(fecha.weekday(), []):
        cursor = datetime.combine(fecha, franja.desde, tzinfo=tz)
        limite = datetime.combine(fecha, franja.hasta, tzinfo=tz)
        while cursor < limite:
            inicio = cursor.astimezone(timezone.utc)
            fin = inicio + duracion
            motivo: str | None = None
            detalle: str | None = None
            if inicio <= ahora:
                motivo, detalle = "PASADO", "Horario ya pasado"
            elif fin > limite.astimezone(timezone.utc):
                motivo = "EXCEDE_HORARIO"
                detalle = (
                    f"No entra en el horario: {tipo.nombre} ({tipo.duracion_min} min) a las "
                    f"{hhmm(inicio)} terminaría {hhmm(fin)} y la atención cierra a las "
                    f"{franja.hasta.strftime('%H:%M')}"
                )
            elif (t := superpuesto(ocupados_vet, inicio, fin)) is not None:
                motivo = "OCUPADO_VETERINARIO"
                detalle = (
                    f"Ocupado: {t.veterinario_nombre} {t.veterinario_apellido} atiende a "
                    f"{t.mascota_nombre} ({t.tipo_turno_nombre} "
                    f"{hhmm(t.fecha_hora_inicio)}–{hhmm(t.fecha_hora_fin)})"
                )
            elif (t := superpuesto(ocupados_mascota, inicio, fin)) is not None:
                motivo = "OCUPADO_MASCOTA"
                detalle = (
                    f"{t.mascota_nombre} ya tiene un turno: {t.tipo_turno_nombre} con "
                    f"{t.veterinario_nombre} {t.veterinario_apellido}, "
                    f"{hhmm(t.fecha_hora_inicio)}–{hhmm(t.fecha_hora_fin)}"
                )
            franjas.append(
                FranjaDisponible(
                    fecha_hora_inicio=inicio,
                    fecha_hora_fin=fin,
                    disponible=motivo is None,
                    motivo=motivo,
                    detalle=detalle,
                )
            )
            cursor += paso

    return DisponibilidadResponse(
        fecha=fecha,
        veterinario_id=veterinario_id,
        tipo_turno_id=tipo_turno_id,
        duracion_min=tipo.duracion_min,
        franjas=franjas,
    )


# ---------------------------------------------------------------------------
# Altas y cambios
# ---------------------------------------------------------------------------


def create_turno(session: Session, payload: TurnoCreate) -> TurnoItem:
    tipo = _get_tipo_turno_activo(session, payload.tipo_turno_id)
    _validar_mascota(session, payload.mascota_id)
    _validar_veterinario(session, payload.veterinario_id)

    inicio = _to_utc(payload.fecha_hora_inicio)
    fin = inicio + timedelta(minutes=tipo.duracion_min)
    _validar_no_pasado(inicio)
    _validar_horario(inicio, fin)
    _validar_superposiciones(
        session,
        veterinario_id=payload.veterinario_id,
        mascota_id=payload.mascota_id,
        inicio=inicio,
        fin=fin,
    )

    turno = Turno(
        mascota_id=payload.mascota_id,
        veterinario_id=payload.veterinario_id,
        tipo_turno_id=payload.tipo_turno_id,
        fecha_hora_inicio=inicio,
        fecha_hora_fin=fin,
        estado=payload.estado_inicial,
        canal_origen=payload.canal_origen,
    )
    session.add(turno)
    _commit_turno(session)
    session.refresh(turno)
    return get_turno(session, turno.id or 0)


def reprogramar_turno(session: Session, turno_id: int, payload: TurnoReprogramar) -> TurnoItem:
    """Cambia fecha, veterinario y/o tipo. El turno conserva su estado."""
    turno = _get_turno_model(session, turno_id)
    if turno.estado not in ESTADOS_MODIFICABLES:
        raise APIError(
            400,
            "TURNO_NO_REPROGRAMABLE",
            f"No se puede reprogramar un turno en estado '{turno.estado}'",
        )

    if payload.tipo_turno_id is not None:
        tipo = _get_tipo_turno_activo(session, payload.tipo_turno_id)
    else:
        tipo = session.get(TipoTurno, turno.tipo_turno_id)
        if tipo is None:
            raise APIError(404, "TIPO_TURNO_NO_ENCONTRADO", "No se encontró el tipo de turno")

    veterinario_id = payload.veterinario_id or turno.veterinario_id
    if payload.veterinario_id is not None:
        _validar_veterinario(session, veterinario_id)

    inicio = (
        _to_utc(payload.fecha_hora_inicio)
        if payload.fecha_hora_inicio is not None
        else _from_db(turno.fecha_hora_inicio)
    )
    fin = inicio + timedelta(minutes=tipo.duracion_min)
    _validar_no_pasado(inicio)
    _validar_horario(inicio, fin)
    _validar_superposiciones(
        session,
        veterinario_id=veterinario_id,
        mascota_id=turno.mascota_id,
        inicio=inicio,
        fin=fin,
        excluir_turno_id=turno.id,
    )

    turno.tipo_turno_id = tipo.id or turno.tipo_turno_id
    turno.veterinario_id = veterinario_id
    turno.fecha_hora_inicio = inicio
    turno.fecha_hora_fin = fin
    session.add(turno)
    _commit_turno(session)
    return get_turno(session, turno_id)


def _aplicar_transicion(session: Session, turno: Turno, nuevo_estado: str) -> None:
    if turno.estado not in TRANSICIONES[nuevo_estado]:
        raise APIError(
            400,
            "TRANSICION_INVALIDA",
            f"No se puede pasar un turno de '{turno.estado}' a '{nuevo_estado}'",
        )
    if nuevo_estado in ("realizado", "no_asistio") and _from_db(turno.fecha_hora_inicio) > utc_now():
        raise APIError(
            400,
            "TURNO_NO_INICIADO",
            "Solo se puede marcar como realizado o no asistió un turno que ya comenzó",
        )
    turno.estado = nuevo_estado
    session.add(turno)
    session.commit()


def cambiar_estado_turno(session: Session, turno_id: int, payload: TurnoCambioEstado) -> TurnoItem:
    turno = _get_turno_model(session, turno_id)
    _aplicar_transicion(session, turno, payload.estado)
    return get_turno(session, turno_id)


def cancelar_turno(session: Session, turno_id: int) -> TurnoItem:
    turno = _get_turno_model(session, turno_id)
    _aplicar_transicion(session, turno, "cancelado")
    return get_turno(session, turno_id)
