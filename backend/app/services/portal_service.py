"""Portal del cliente: lo que un cliente logueado puede ver de lo suyo, en solo lectura.

Reglas de seguridad (todas cubiertas por tests/test_portal.py):

1. La persona sale siempre de la sesión (`auth.usuario.persona_id` del usuario del JWT). Ningún
   endpoint recibe un `persona_id`.
2. El filtro por dueño va dentro de la consulta SQL (`mascota.persona_id = persona de la
   sesión`), nunca "buscar y después verificar". Así hay un solo patrón y no se puede olvidar.
3. Lo ajeno y lo inexistente responden el mismo 404, con el mismo código y mensaje: el portal no
   confirma que algo exista.
4. Para el cliente, una consulta en borrador no existe: solo se ven las firmadas.
5. La persona del tutor eventual (PERSONA_ID_TUTOR_EVENTUAL) no tiene portal: si un usuario
   quedara vinculado a ella por error, vería todos los rescates. Recibe listas vacías.

Una mascota que cambia de dueño pasa con toda su historia al dueño nuevo: el filtro usa el dueño
actual.

Pedir turnos (permiso `portal:pedir_turno`):

- Solo para mascotas propias, solo de los tipos del parámetro TIPOS_TURNO_PORTAL y desde mañana
  en adelante: un turno para hoy se pide comunicándose con la clínica.
- El turno nace `solicitado` con canal `portal`; lo confirma la clínica. Se aplican las mismas
  validaciones de agenda que en la app interna (horario, módulos, superposiciones).
- El cliente solo cancela un turno suyo, futuro y `solicitado`. Uno confirmado se cancela
  llamando a la clínica.
- La disponibilidad devuelve solo los horarios libres, sin decir por qué un horario está
  ocupado (el detalle interno nombra a otros pacientes).
- El cliente no da de alta mascotas: se registran en el mostrador.
"""

from __future__ import annotations

from datetime import date, datetime, timedelta, timezone

from sqlalchemy import func
from sqlmodel import Session, col, select

from app.core.errors import APIError
from app.core.time_utils import utc_now
from app.models.agenda.tipo_turno import TipoTurno
from app.models.agenda.turno import Turno
from app.models.auth.usuario import Usuario
from app.models.catalogo.mascota_estado import MascotaEstado
from app.models.clinica.consulta import Consulta
from app.models.clinica.consulta_diagnostico import ConsultaDiagnostico
from app.models.clinica.especie import Especie
from app.models.clinica.mascota import Mascota
from app.models.clinica.patologia import Patologia
from app.models.clinica.raza import Raza
from app.models.comercial.detalle_venta import DetalleVenta
from app.models.comercial.venta import Venta
from app.models.core.persona import Persona
from app.models.stock.producto import Producto
from app.schemas.portal import (
    PortalCompraDetalle,
    PortalDisponibilidad,
    PortalHorario,
    PortalOpcion,
    PortalTipoTurno,
    PortalTurnoCreate,
    PortalTurnoOpciones,
    PortalCompraItem,
    PortalCompraRenglon,
    PortalConsultaDetalle,
    PortalConsultaItem,
    PortalConsultaReferencia,
    PortalDiagnostico,
    PortalMascota,
    PortalTurno,
    PortalTurnosResponse,
)
from app.services.config_service import get_parametro_valor_por_nombre
from app.services import turno_service
from app.services.mascota_service import PARAM_TUTOR_EVENTUAL, ids_estados_atendibles
from app.services.turno_service import get_zona_horaria

ESTADOS_TURNO_PROXIMO = ("solicitado", "confirmado")
LIMITE_TURNOS_ANTERIORES = 50
LIMITE_COMPRAS = 100
PARAM_TIPOS_TURNO_PORTAL = "TIPOS_TURNO_PORTAL"

# Mismo mensaje para lo ajeno y lo inexistente (regla 3).
_MASCOTA_NO_ENCONTRADA = ("MASCOTA_NO_ENCONTRADA", "La mascota no existe")
_CONSULTA_NO_ENCONTRADA = ("CONSULTA_NO_ENCONTRADA", "La consulta no existe")
_COMPRA_NO_ENCONTRADA = ("COMPRA_NO_ENCONTRADA", "La compra no existe")
_TURNO_NO_ENCONTRADO = ("TURNO_NO_ENCONTRADO", "El turno no existe")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _aware(value: datetime) -> datetime:
    """SQLite devuelve datetimes naive (guardados en UTC); PostgreSQL los devuelve aware."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _tutor_eventual_id(session: Session) -> int | None:
    raw = get_parametro_valor_por_nombre(session, PARAM_TUTOR_EVENTUAL, default="")
    try:
        return int(str(raw).strip()) if str(raw).strip() else None
    except ValueError:
        return None


def persona_de_sesion(session: Session, usuario_id: int) -> int | None:
    """La persona del usuario logueado, o None si no tiene portal (regla 5)."""
    persona_id = session.exec(select(Usuario.persona_id).where(Usuario.id == usuario_id)).first()
    if persona_id is None or persona_id == _tutor_eventual_id(session):
        return None
    return persona_id


def _edad_meses(fecha_nacimiento: date | None) -> int | None:
    if fecha_nacimiento is None:
        return None
    hoy = datetime.now(get_zona_horaria()).date()
    meses = (hoy.year - fecha_nacimiento.year) * 12 + (hoy.month - fecha_nacimiento.month)
    if hoy.day < fecha_nacimiento.day:
        meses -= 1
    return max(meses, 0)


def _nombres_usuarios(session: Session, usuario_ids: set[int]) -> dict[int, str]:
    if not usuario_ids:
        return {}
    filas = session.exec(
        select(Usuario.id, Persona.nombre, Persona.apellido)
        .join(Persona, col(Persona.id) == col(Usuario.persona_id))
        .where(col(Usuario.id).in_(usuario_ids))
    ).all()
    return {uid: f"{nombre} {apellido}".strip() for uid, nombre, apellido in filas}


def _nombre_diagnostico(dx: ConsultaDiagnostico, patologia: Patologia | None) -> str:
    return patologia.nombre if patologia else (dx.descripcion_libre or "")


def _mascota_propia(session: Session, persona_id: int | None, mascota_id: int) -> Mascota:
    if persona_id is None:
        raise APIError(404, *_MASCOTA_NO_ENCONTRADA)
    mascota = session.exec(
        select(Mascota).where(Mascota.id == mascota_id, Mascota.persona_id == persona_id)
    ).first()
    if mascota is None:
        raise APIError(404, *_MASCOTA_NO_ENCONTRADA)
    return mascota


# ---------------------------------------------------------------------------
# Mascotas
# ---------------------------------------------------------------------------


def _query_mascotas(persona_id: int):
    return (
        select(Mascota, Raza, Especie, MascotaEstado)
        .join(Raza, col(Raza.id) == col(Mascota.raza_id))
        .join(Especie, col(Especie.id) == col(Raza.especie_id))
        .join(MascotaEstado, col(MascotaEstado.id) == col(Mascota.mascota_estado_id))
        .where(Mascota.persona_id == persona_id)
    )


def _to_portal_mascota(mascota: Mascota, raza: Raza, especie: Especie, estado: MascotaEstado):
    return PortalMascota(
        id=mascota.id or 0,
        nombre=mascota.nombre,
        especie_nombre=especie.nombre,
        raza_nombre=raza.nombre,
        sexo=mascota.sexo,
        fecha_nacimiento=mascota.fecha_nacimiento,
        edad_meses=_edad_meses(mascota.fecha_nacimiento),
        ultimo_peso=mascota.ultimo_peso,
        estado_nombre=estado.nombre,
        alertas_medicas=mascota.alertas_medicas,
    )


def listar_mascotas(session: Session, persona_id: int | None) -> list[PortalMascota]:
    if persona_id is None:
        return []
    filas = session.exec(_query_mascotas(persona_id).order_by(col(Mascota.nombre))).all()
    return [_to_portal_mascota(*fila) for fila in filas]


def get_mascota(session: Session, persona_id: int | None, mascota_id: int) -> PortalMascota:
    if persona_id is None:
        raise APIError(404, *_MASCOTA_NO_ENCONTRADA)
    fila = session.exec(_query_mascotas(persona_id).where(Mascota.id == mascota_id)).first()
    if fila is None:
        raise APIError(404, *_MASCOTA_NO_ENCONTRADA)
    return _to_portal_mascota(*fila)


# ---------------------------------------------------------------------------
# Historia clínica (solo consultas firmadas)
# ---------------------------------------------------------------------------


def listar_consultas(
    session: Session, persona_id: int | None, mascota_id: int
) -> list[PortalConsultaItem]:
    _mascota_propia(session, persona_id, mascota_id)
    consultas = session.exec(
        select(Consulta)
        .where(Consulta.mascota_id == mascota_id, Consulta.estado == "firmada")
        .order_by(col(Consulta.fecha_hora).desc())
    ).all()
    if not consultas:
        return []

    ids = [c.id or 0 for c in consultas]
    principales: dict[int, str] = {}
    for dx, patologia in session.exec(
        select(ConsultaDiagnostico, Patologia)
        .join(Patologia, col(Patologia.id) == col(ConsultaDiagnostico.patologia_id), isouter=True)
        .where(
            col(ConsultaDiagnostico.consulta_id).in_(ids),
            ConsultaDiagnostico.tipo_diagnostico == "principal",
        )
    ).all():
        principales[dx.consulta_id] = _nombre_diagnostico(dx, patologia)
    veterinarios = _nombres_usuarios(session, {c.veterinario_id for c in consultas})

    return [
        PortalConsultaItem(
            id=c.id or 0,
            fecha_hora=_aware(c.fecha_hora),
            veterinario_nombre=veterinarios.get(c.veterinario_id, ""),
            motivo=c.motivo,
            diagnostico_principal=principales.get(c.id or 0),
            es_control=c.consulta_padre_id is not None,
        )
        for c in consultas
    ]


def get_consulta(
    session: Session, persona_id: int | None, consulta_id: int
) -> PortalConsultaDetalle:
    if persona_id is None:
        raise APIError(404, *_CONSULTA_NO_ENCONTRADA)
    fila = session.exec(
        select(Consulta, Mascota)
        .join(Mascota, col(Mascota.id) == col(Consulta.mascota_id))
        .where(
            Consulta.id == consulta_id,
            Consulta.estado == "firmada",
            Mascota.persona_id == persona_id,
        )
    ).first()
    if fila is None:
        raise APIError(404, *_CONSULTA_NO_ENCONTRADA)
    consulta, mascota = fila

    diagnosticos = [
        PortalDiagnostico(
            nombre=_nombre_diagnostico(dx, patologia),
            principal=dx.tipo_diagnostico == "principal",
        )
        for dx, patologia in session.exec(
            select(ConsultaDiagnostico, Patologia)
            .join(
                Patologia,
                col(Patologia.id) == col(ConsultaDiagnostico.patologia_id),
                isouter=True,
            )
            .where(ConsultaDiagnostico.consulta_id == consulta.id)
            .order_by(col(ConsultaDiagnostico.id))
        ).all()
    ]
    diagnosticos.sort(key=lambda d: not d.principal)  # el principal primero

    control_de = None
    if consulta.consulta_padre_id is not None:
        # La anterior es siempre una firmada de la misma mascota (lo valida consulta_service);
        # igual se vuelve a filtrar, para no depender de esa validación.
        padre = session.exec(
            select(Consulta).where(
                Consulta.id == consulta.consulta_padre_id,
                Consulta.mascota_id == mascota.id,
                Consulta.estado == "firmada",
            )
        ).first()
        if padre is not None:
            control_de = PortalConsultaReferencia(
                id=padre.id or 0, fecha_hora=_aware(padre.fecha_hora)
            )

    return PortalConsultaDetalle(
        id=consulta.id or 0,
        fecha_hora=_aware(consulta.fecha_hora),
        veterinario_nombre=_nombres_usuarios(session, {consulta.veterinario_id}).get(
            consulta.veterinario_id, ""
        ),
        mascota_id=mascota.id or 0,
        mascota_nombre=mascota.nombre,
        motivo=consulta.motivo,
        peso_kg=consulta.peso_kg,
        temperatura_c=consulta.temperatura_c,
        tratamiento=consulta.tratamiento,
        diagnosticos=diagnosticos,
        control_de=control_de,
    )


# ---------------------------------------------------------------------------
# Turnos
# ---------------------------------------------------------------------------


def _to_portal_turno(
    turno: Turno, mascota_nombre: str, tipo_nombre: str, veterinario_nombre: str
) -> PortalTurno:
    inicio = _aware(turno.fecha_hora_inicio)
    return PortalTurno(
        id=turno.id or 0,
        mascota_id=turno.mascota_id,
        mascota_nombre=mascota_nombre,
        fecha_hora_inicio=inicio,
        fecha_hora_fin=_aware(turno.fecha_hora_fin),
        tipo_turno_nombre=tipo_nombre,
        veterinario_nombre=veterinario_nombre,
        estado=turno.estado,
        cancelable=turno.estado == "solicitado" and inicio > utc_now(),
    )


def listar_turnos(session: Session, persona_id: int | None) -> PortalTurnosResponse:
    """Próximos (futuros y vigentes) del más cercano al más lejano; el resto, del más reciente."""
    if persona_id is None:
        return PortalTurnosResponse(proximos=[], anteriores=[])
    filas = session.exec(
        select(Turno, Mascota.nombre, TipoTurno.nombre)
        .join(Mascota, col(Mascota.id) == col(Turno.mascota_id))
        .join(TipoTurno, col(TipoTurno.id) == col(Turno.tipo_turno_id))
        .where(Mascota.persona_id == persona_id)
        .order_by(col(Turno.fecha_hora_inicio))
    ).all()
    veterinarios = _nombres_usuarios(session, {t.veterinario_id for t, _, _ in filas})
    ahora = utc_now()

    proximos: list[PortalTurno] = []
    anteriores: list[PortalTurno] = []
    for turno, mascota_nombre, tipo_nombre in filas:
        item = _to_portal_turno(
            turno, mascota_nombre, tipo_nombre, veterinarios.get(turno.veterinario_id, "")
        )
        if item.fecha_hora_inicio >= ahora and turno.estado in ESTADOS_TURNO_PROXIMO:
            proximos.append(item)
        else:
            anteriores.append(item)
    anteriores.reverse()
    return PortalTurnosResponse(
        proximos=proximos, anteriores=anteriores[:LIMITE_TURNOS_ANTERIORES]
    )


# ---------------------------------------------------------------------------
# Pedir y cancelar turnos
# ---------------------------------------------------------------------------


def _hoy() -> date:
    return datetime.now(get_zona_horaria()).date()


def _primer_dia() -> date:
    return _hoy() + timedelta(days=1)


def _validar_fecha(fecha: date) -> None:
    if fecha <= _hoy():
        raise APIError(
            400,
            "TURNO_PORTAL_DESDE_MANANA",
            "Desde el portal se piden turnos a partir de mañana. "
            "Para hoy, comunicate con la clínica.",
        )


def _ids_tipos_portal(session: Session) -> list[int]:
    raw = get_parametro_valor_por_nombre(session, PARAM_TIPOS_TURNO_PORTAL, default="")
    ids: list[int] = []
    for parte in str(raw).split(","):
        parte = parte.strip()
        if parte.isdigit():
            ids.append(int(parte))
    return ids


def _validar_tipo(session: Session, tipo_turno_id: int) -> None:
    if tipo_turno_id not in _ids_tipos_portal(session):
        raise APIError(
            400,
            "TIPO_TURNO_NO_PERMITIDO",
            "Ese tipo de turno no se pide desde el portal. Comunicate con la clínica.",
        )


def opciones_turno(session: Session, persona_id: int | None) -> PortalTurnoOpciones:
    if persona_id is None:
        return PortalTurnoOpciones(mascotas=[], tipos=[], veterinarios=[], primer_dia=_primer_dia())
    mascotas = session.exec(
        select(Mascota)
        .where(
            Mascota.persona_id == persona_id,
            col(Mascota.mascota_estado_id).in_(ids_estados_atendibles(session)),
        )
        .order_by(col(Mascota.nombre))
    ).all()
    ids_tipos = _ids_tipos_portal(session)
    tipos = (
        session.exec(
            select(TipoTurno)
            .where(col(TipoTurno.id).in_(ids_tipos), TipoTurno.activo.is_(True))
            .order_by(col(TipoTurno.nombre))
        ).all()
        if ids_tipos
        else []
    )
    return PortalTurnoOpciones(
        mascotas=[PortalOpcion(id=m.id or 0, nombre=m.nombre) for m in mascotas],
        tipos=[
            PortalTipoTurno(id=t.id or 0, nombre=t.nombre, duracion_min=t.duracion_min)
            for t in tipos
        ],
        veterinarios=[
            PortalOpcion(id=v.id, nombre=f"{v.nombre} {v.apellido}".strip())
            for v in turno_service.list_veterinarios(session)
        ],
        primer_dia=_primer_dia(),
    )


def disponibilidad(
    session: Session,
    persona_id: int | None,
    *,
    mascota_id: int,
    veterinario_id: int,
    tipo_turno_id: int,
    fecha: date,
) -> PortalDisponibilidad:
    _mascota_propia(session, persona_id, mascota_id)
    _validar_tipo(session, tipo_turno_id)
    _validar_fecha(fecha)
    interna = turno_service.get_disponibilidad(
        session,
        veterinario_id=veterinario_id,
        fecha=fecha,
        tipo_turno_id=tipo_turno_id,
        mascota_id=mascota_id,
    )
    return PortalDisponibilidad(
        fecha=fecha,
        horarios=[
            PortalHorario(fecha_hora_inicio=f.fecha_hora_inicio, fecha_hora_fin=f.fecha_hora_fin)
            for f in interna.franjas
            if f.disponible
        ],
    )


def pedir_turno(
    session: Session, persona_id: int | None, payload: PortalTurnoCreate
) -> PortalTurno:
    mascota = _mascota_propia(session, persona_id, payload.mascota_id)
    _validar_tipo(session, payload.tipo_turno_id)
    inicio = payload.fecha_hora_inicio
    if inicio.tzinfo is None:  # sin zona = hora local de la clínica, como en la agenda
        inicio = inicio.replace(tzinfo=get_zona_horaria())
    _validar_fecha(inicio.astimezone(get_zona_horaria()).date())

    turno = turno_service.registrar_turno(
        session,
        mascota_id=payload.mascota_id,
        veterinario_id=payload.veterinario_id,
        tipo_turno_id=payload.tipo_turno_id,
        fecha_hora_inicio=inicio,
        estado="solicitado",
        canal_origen="portal",
    )
    tipo = session.get(TipoTurno, turno.tipo_turno_id)
    return _to_portal_turno(
        turno,
        mascota.nombre,
        tipo.nombre if tipo else "",
        _nombres_usuarios(session, {turno.veterinario_id}).get(turno.veterinario_id, ""),
    )


def cancelar_turno(session: Session, persona_id: int | None, turno_id: int) -> PortalTurno:
    if persona_id is None:
        raise APIError(404, *_TURNO_NO_ENCONTRADO)
    fila = session.exec(
        select(Turno, Mascota.nombre, TipoTurno.nombre)
        .join(Mascota, col(Mascota.id) == col(Turno.mascota_id))
        .join(TipoTurno, col(TipoTurno.id) == col(Turno.tipo_turno_id))
        .where(Turno.id == turno_id, Mascota.persona_id == persona_id)
    ).first()
    if fila is None:
        raise APIError(404, *_TURNO_NO_ENCONTRADO)
    turno, mascota_nombre, tipo_nombre = fila
    if turno.estado != "solicitado" or _aware(turno.fecha_hora_inicio) <= utc_now():
        raise APIError(
            400,
            "TURNO_NO_CANCELABLE",
            "Este turno ya no se puede cancelar desde el portal. Comunicate con la clínica.",
        )
    turno_service.cancelar_turno(session, turno.id or 0)
    session.refresh(turno)
    return _to_portal_turno(
        turno,
        mascota_nombre,
        tipo_nombre,
        _nombres_usuarios(session, {turno.veterinario_id}).get(turno.veterinario_id, ""),
    )


# ---------------------------------------------------------------------------
# Compras
# ---------------------------------------------------------------------------


def listar_compras(session: Session, persona_id: int | None) -> list[PortalCompraItem]:
    if persona_id is None:
        return []
    items_por_venta = (
        select(DetalleVenta.venta_id, func.count().label("n"))
        .group_by(col(DetalleVenta.venta_id))
        .subquery()
    )
    filas = session.exec(
        select(Venta, items_por_venta.c.n)
        .outerjoin(items_por_venta, items_por_venta.c.venta_id == Venta.id)
        .where(Venta.persona_id == persona_id)
        .order_by(col(Venta.fecha).desc())
        .limit(LIMITE_COMPRAS)
    ).all()
    return [
        PortalCompraItem(
            id=venta.id or 0,
            fecha=_aware(venta.fecha),
            total=venta.total,
            medio_pago=venta.medio_pago,
            cantidad_items=n or 0,
        )
        for venta, n in filas
    ]


def get_compra(session: Session, persona_id: int | None, venta_id: int) -> PortalCompraDetalle:
    if persona_id is None:
        raise APIError(404, *_COMPRA_NO_ENCONTRADA)
    venta = session.exec(
        select(Venta).where(Venta.id == venta_id, Venta.persona_id == persona_id)
    ).first()
    if venta is None:
        raise APIError(404, *_COMPRA_NO_ENCONTRADA)
    renglones = session.exec(
        select(DetalleVenta, Producto.nombre)
        .join(Producto, col(Producto.id) == col(DetalleVenta.producto_id))
        .where(DetalleVenta.venta_id == venta.id)
        .order_by(col(DetalleVenta.id))
    ).all()
    return PortalCompraDetalle(
        id=venta.id or 0,
        fecha=_aware(venta.fecha),
        total=venta.total,
        medio_pago=venta.medio_pago,
        items=[
            PortalCompraRenglon(
                producto_nombre=nombre,
                cantidad=detalle.cantidad,
                precio_unitario=detalle.precio_unitario,
                subtotal=detalle.precio_unitario * detalle.cantidad,
            )
            for detalle, nombre in renglones
        ],
    )
