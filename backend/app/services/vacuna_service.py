"""Vacunas y desparasitaciones (medicina preventiva).

Una aplicación en la clínica sale de un producto del stock: se descuenta un envase y, si se cobra,
se arma la venta al tutor con el servicio de ventas (todo en una sola transacción). Una dosis
anterior (libreta sanitaria, otra veterinaria) solo queda registrada. La próxima dosis es la que
después aparece en los recordatorios (ver `recordatorio_service`).

Simplificaciones del prototipo, documentadas en docs/fase2_diseno.md:
  - una aplicación usa un envase completo (no hay dosis fraccionadas);
  - el producto es preventivo según su rubro: «Vacuna» → vacunación, «Antiparasitario» →
    desparasitación (no hay todavía un catálogo de productos preventivos).
"""

from __future__ import annotations

import unicodedata
from datetime import date, datetime, timedelta, timezone
from decimal import Decimal

from sqlalchemy import func
from sqlalchemy.orm import aliased
from sqlmodel import Session, col, select

from app.core.errors import APIError
from app.models.agenda.turno import Turno
from app.models.auth.usuario import Usuario
from app.models.catalogo.mascota_estado import MascotaEstado
from app.models.catalogo.rubro import Rubro
from app.models.clinica.consulta import Consulta
from app.models.clinica.especie import Especie
from app.models.clinica.mascota import Mascota
from app.models.clinica.raza import Raza
from app.models.clinica.tratamiento_preventivo import TratamientoPreventivo
from app.models.core.persona import Persona
from app.models.stock.producto import Producto
from app.schemas.vacunas import (
    EstadoDosis,
    MascotaPreventivaResumen,
    PreventivaConfig,
    ProductoPreventivoOpcion,
    TratamientoPreventivoCreate,
    TratamientoPreventivoItem,
    TratamientoPreventivoResultado,
    VacunasMascotaResponse,
)
from app.schemas.ventas import VentaCreate, VentaItemIn
from app.services.config_service import get_parametro_valor_por_nombre
from app.services.mascota_service import ids_estados_atendibles
from app.services.stock_service import aplicar_movimiento, get_producto_model
from app.services.turno_service import get_zona_horaria
from app.services.venta_service import crear_venta

PARAM_DIAS_REFUERZO_VACUNA = "DIAS_REFUERZO_VACUNA"
PARAM_DIAS_REFUERZO_DESPARASITACION = "DIAS_REFUERZO_DESPARASITACION"
PARAM_DIAS_AVISO_DOSIS = "DIAS_AVISO_DOSIS"
PARAM_DIAS_AVISO_DOSIS_VENCIDA = "DIAS_AVISO_DOSIS_VENCIDA"
DEFAULTS_PREVENTIVA = {
    PARAM_DIAS_REFUERZO_VACUNA: 365,
    PARAM_DIAS_REFUERZO_DESPARASITACION: 90,
    PARAM_DIAS_AVISO_DOSIS: 7,
    PARAM_DIAS_AVISO_DOSIS_VENCIDA: 30,
}

# Rubro del stock → tipo de tratamiento. Se compara el comienzo del nombre, sin tildes ni mayúsculas.
TIPO_POR_RUBRO = (("vacun", "vacunacion"), ("antiparasit", "desparasitacion"))
ETIQUETA_TIPO = {"vacunacion": "vacuna", "desparasitacion": "antiparasitario"}
ESTADOS_TURNO_REGISTRABLES = ("solicitado", "confirmado", "atendido")
ESTADOS_TURNO_A_ATENDER = ("solicitado", "confirmado")


def _normalizar(texto: str) -> str:
    sin_tildes = unicodedata.normalize("NFKD", texto)
    return "".join(c for c in sin_tildes if not unicodedata.combining(c)).strip().lower()


def tipo_de_rubro(nombre_rubro: str) -> str | None:
    nombre = _normalizar(nombre_rubro)
    for prefijo, tipo in TIPO_POR_RUBRO:
        if nombre.startswith(prefijo):
            return tipo
    return None


def hoy_clinica() -> date:
    """La fecha de hoy en la zona horaria de la clínica (parámetro ZONA_HORARIA)."""
    return datetime.now(get_zona_horaria()).date()


def _entero_positivo(session: Session, nombre: str) -> int:
    default = DEFAULTS_PREVENTIVA[nombre]
    raw = get_parametro_valor_por_nombre(session, nombre, default=str(default))
    try:
        valor = int(str(raw).strip())
    except ValueError:
        return default
    return valor if valor >= 1 else default


def get_config_preventiva(session: Session) -> PreventivaConfig:
    return PreventivaConfig(
        dias_refuerzo_vacuna=_entero_positivo(session, PARAM_DIAS_REFUERZO_VACUNA),
        dias_refuerzo_desparasitacion=_entero_positivo(
            session, PARAM_DIAS_REFUERZO_DESPARASITACION
        ),
        dias_aviso_dosis=_entero_positivo(session, PARAM_DIAS_AVISO_DOSIS),
        dias_aviso_dosis_vencida=_entero_positivo(session, PARAM_DIAS_AVISO_DOSIS_VENCIDA),
    )


def estado_dosis(
    fecha_proxima: date | None, reforzada: bool, hoy: date, dias_aviso: int
) -> tuple[EstadoDosis, int | None]:
    if fecha_proxima is None:
        return "sin_refuerzo", None
    dias = (fecha_proxima - hoy).days
    if reforzada:
        return "reforzada", dias
    if dias < 0:
        return "vencida", dias
    if dias <= dias_aviso:
        return "por_vencer", dias
    return "al_dia", dias


def _nombre_usuario(session: Session, usuario_id: int) -> str:
    fila = session.exec(
        select(Persona.nombre, Persona.apellido, Usuario.username)
        .join(Usuario, col(Usuario.persona_id) == col(Persona.id))
        .where(Usuario.id == usuario_id)
    ).first()
    if fila is None:
        return ""
    nombre, apellido, username = fila
    return f"{nombre} {apellido}".strip() or username


def _reforzadas_por(session: Session, ids: list[int]) -> dict[int, int]:
    """Para cada dosis, el id de la aplicación que la reforzó (si hay)."""
    if not ids:
        return {}
    filas = session.exec(
        select(TratamientoPreventivo.refuerzo_de_id, TratamientoPreventivo.id).where(
            col(TratamientoPreventivo.refuerzo_de_id).in_(ids)
        )
    ).all()
    return {refuerzo_de: tid for refuerzo_de, tid in filas if refuerzo_de is not None and tid}


def _to_item(
    session: Session,
    t: TratamientoPreventivo,
    reforzada_por: int | None,
    hoy: date,
    dias_aviso: int,
) -> TratamientoPreventivoItem:
    estado, dias = estado_dosis(t.fecha_proxima_dosis, reforzada_por is not None, hoy, dias_aviso)
    fecha_registro = t.fecha_registro
    if fecha_registro.tzinfo is None:
        fecha_registro = fecha_registro.replace(tzinfo=timezone.utc)
    return TratamientoPreventivoItem(
        id=t.id or 0,
        mascota_id=t.mascota_id,
        tipo=t.tipo,  # type: ignore[arg-type]
        producto_id=t.producto_id,
        nombre_producto=t.nombre_producto,
        aplicada_en_clinica=t.producto_id is not None,
        fecha_aplicacion=t.fecha_aplicacion,
        fecha_proxima_dosis=t.fecha_proxima_dosis,
        estado_dosis=estado,
        dias_para_vencer=dias,
        lote=t.lote,
        peso_kg=t.peso_kg,
        refuerzo_de_id=t.refuerzo_de_id,
        reforzada_por_id=reforzada_por,
        consulta_id=t.consulta_id,
        turno_id=t.turno_id,
        venta_id=t.venta_id,
        usuario_nombre=_nombre_usuario(session, t.usuario_id),
        observaciones=t.observaciones,
        fecha_registro=fecha_registro,
    )


def _mascota_resumen(session: Session, mascota_id: int) -> MascotaPreventivaResumen:
    fila = session.exec(
        select(Mascota, Raza, Especie, Persona, MascotaEstado)
        .join(Raza, col(Raza.id) == col(Mascota.raza_id))
        .join(Especie, col(Especie.id) == col(Raza.especie_id))
        .join(Persona, col(Persona.id) == col(Mascota.persona_id))
        .join(MascotaEstado, col(MascotaEstado.id) == col(Mascota.mascota_estado_id))
        .where(Mascota.id == mascota_id)
    ).first()
    if fila is None:
        raise APIError(404, "MASCOTA_NO_ENCONTRADA", "La mascota no existe")
    mascota, raza, especie, tutor, estado = fila
    return MascotaPreventivaResumen(
        id=mascota.id or 0,
        nombre=mascota.nombre,
        especie_nombre=especie.nombre,
        raza_nombre=raza.nombre,
        tutor_id=tutor.id or 0,
        tutor_nombre=f"{tutor.nombre} {tutor.apellido}".strip(),
        ultimo_peso=mascota.ultimo_peso,
        estado_nombre=estado.nombre,
        atendible=mascota.mascota_estado_id in ids_estados_atendibles(session),
    )


def listar_vacunas(session: Session, mascota_id: int) -> VacunasMascotaResponse:
    """Carnet de la mascota: todas las aplicaciones, de la más reciente a la más antigua."""
    mascota = _mascota_resumen(session, mascota_id)
    config = get_config_preventiva(session)
    hoy = hoy_clinica()
    tratamientos = session.exec(
        select(TratamientoPreventivo)
        .where(TratamientoPreventivo.mascota_id == mascota_id)
        .order_by(
            col(TratamientoPreventivo.fecha_aplicacion).desc(),
            col(TratamientoPreventivo.id).desc(),
        )
    ).all()
    reforzadas = _reforzadas_por(session, [t.id for t in tratamientos if t.id is not None])
    return VacunasMascotaResponse(
        hoy=hoy,
        mascota=mascota,
        items=[
            _to_item(session, t, reforzadas.get(t.id or 0), hoy, config.dias_aviso_dosis)
            for t in tratamientos
        ],
        config=config,
    )


def get_tratamiento_item(session: Session, tratamiento_id: int) -> TratamientoPreventivoItem:
    t = session.get(TratamientoPreventivo, tratamiento_id)
    if t is None:
        raise APIError(404, "DOSIS_NO_ENCONTRADA", "No se encontró la dosis indicada")
    config = get_config_preventiva(session)
    reforzada = _reforzadas_por(session, [tratamiento_id]).get(tratamiento_id)
    return _to_item(session, t, reforzada, hoy_clinica(), config.dias_aviso_dosis)


def productos_preventivos(session: Session) -> list[ProductoPreventivoOpcion]:
    """Productos activos del stock que se aplican como vacuna o antiparasitario."""
    filas = session.exec(
        select(Producto, Rubro)
        .join(Rubro, col(Rubro.id) == col(Producto.rubro_id))
        .where(col(Producto.activo).is_(True))
        .order_by(col(Producto.nombre))
    ).all()
    opciones: list[ProductoPreventivoOpcion] = []
    for producto, rubro in filas:
        tipo = tipo_de_rubro(rubro.nombre)
        if tipo is None:
            continue
        opciones.append(
            ProductoPreventivoOpcion(
                id=producto.id or 0,
                nombre=producto.nombre,
                tipo=tipo,  # type: ignore[arg-type]
                rubro_nombre=rubro.nombre,
                unidad=producto.unidad,
                envases_cerrados=producto.envases_cerrados,
                precio_venta=producto.precio_venta,
            )
        )
    return opciones


def _validar_refuerzo(
    session: Session, payload: TratamientoPreventivoCreate, fecha_aplicacion: date
) -> None:
    if payload.refuerzo_de_id is None:
        return
    anterior = session.get(TratamientoPreventivo, payload.refuerzo_de_id)
    if anterior is None or anterior.mascota_id != payload.mascota_id:
        raise APIError(404, "DOSIS_NO_ENCONTRADA", "La dosis a reforzar no es de esta mascota")
    if anterior.tipo != payload.tipo:
        raise APIError(
            400,
            "REFUERZO_DE_OTRO_TIPO",
            "El refuerzo tiene que ser del mismo tipo que la dosis anterior",
        )
    if anterior.fecha_aplicacion >= fecha_aplicacion:
        raise APIError(
            400,
            "REFUERZO_ANTERIOR_A_LA_DOSIS",
            "El refuerzo tiene que ser posterior a la dosis que completa",
        )
    ya = session.exec(
        select(func.count())
        .select_from(TratamientoPreventivo)
        .where(TratamientoPreventivo.refuerzo_de_id == payload.refuerzo_de_id)
    ).one()
    if ya:
        raise APIError(409, "DOSIS_YA_REFORZADA", "Esa dosis ya tiene registrado su refuerzo")


def _validar_turno(session: Session, payload: TratamientoPreventivoCreate) -> Turno | None:
    if payload.turno_id is None:
        return None
    turno = session.get(Turno, payload.turno_id)
    if turno is None:
        raise APIError(404, "TURNO_NO_ENCONTRADO", "El turno no existe")
    if turno.mascota_id != payload.mascota_id:
        raise APIError(400, "TURNO_DE_OTRA_MASCOTA", "El turno es de otra mascota")
    if turno.estado not in ESTADOS_TURNO_REGISTRABLES:
        raise APIError(
            400, "TURNO_NO_ATENDIBLE", "El turno está cancelado o la mascota no asistió"
        )
    return turno


def _validar_consulta(session: Session, payload: TratamientoPreventivoCreate) -> None:
    if payload.consulta_id is None:
        return
    consulta = session.get(Consulta, payload.consulta_id)
    if consulta is None:
        raise APIError(404, "CONSULTA_NO_ENCONTRADA", "La consulta no existe")
    if consulta.mascota_id != payload.mascota_id:
        raise APIError(400, "CONSULTA_DE_OTRA_MASCOTA", "La consulta es de otra mascota")


def registrar_tratamiento(
    session: Session, payload: TratamientoPreventivoCreate, usuario_id: int
) -> TratamientoPreventivoResultado:
    mascota = session.get(Mascota, payload.mascota_id)
    if mascota is None:
        raise APIError(404, "MASCOTA_NO_ENCONTRADA", "La mascota no existe")
    if mascota.mascota_estado_id not in ids_estados_atendibles(session):
        raise APIError(
            400,
            "MASCOTA_NO_ATENDIBLE",
            "La mascota no puede recibir vacunas ni desparasitaciones en su estado actual",
        )

    hoy = hoy_clinica()
    producto: Producto | None = None
    if payload.modo == "aplicar":
        if payload.fecha_aplicacion is not None and payload.fecha_aplicacion != hoy:
            raise APIError(
                400,
                "FECHA_APLICACION_INVALIDA",
                "Una dosis aplicada en la clínica se registra con la fecha de hoy",
            )
        fecha_aplicacion = hoy
        producto = get_producto_model(session, payload.producto_id or 0, bloquear=True)
        rubro = session.get(Rubro, producto.rubro_id)
        if not producto.activo:
            raise APIError(400, "PRODUCTO_INACTIVO", f"'{producto.nombre}' está dado de baja")
        if rubro is None or tipo_de_rubro(rubro.nombre) != payload.tipo:
            raise APIError(
                400,
                "PRODUCTO_NO_PREVENTIVO",
                f"'{producto.nombre}' no es un {ETIQUETA_TIPO[payload.tipo]} del stock",
            )
        nombre_producto = producto.nombre
    else:
        fecha_aplicacion = payload.fecha_aplicacion or hoy
        if fecha_aplicacion > hoy:
            raise APIError(
                400, "FECHA_APLICACION_INVALIDA", "La fecha de aplicación no puede ser futura"
            )
        nombre_producto = payload.nombre_producto or ""

    if payload.fecha_proxima_dosis is not None and payload.fecha_proxima_dosis <= fecha_aplicacion:
        raise APIError(
            400,
            "FECHA_PROXIMA_INVALIDA",
            "La próxima dosis tiene que ser posterior a la fecha de aplicación",
        )
    _validar_refuerzo(session, payload, fecha_aplicacion)
    turno = _validar_turno(session, payload)
    _validar_consulta(session, payload)

    venta_id: int | None = None
    venta_total: Decimal | None = None
    advertencias: list[str] = []
    if producto is not None:
        if payload.cobrar:
            venta, avisos = crear_venta(
                session,
                VentaCreate(
                    items=[VentaItemIn(producto_id=producto.id or 0, cantidad=1)],
                    medio_pago=payload.medio_pago or "efectivo",
                    persona_id=mascota.persona_id,
                ),
                usuario_id,
            )
            venta_id = venta.id
            venta_total = venta.total
        else:
            _, avisos = aplicar_movimiento(
                session,
                producto,
                tipo="consumo_clinico",
                delta_cerrados=-1,
                delta_abierta=Decimal("0"),
                usuario_id=usuario_id,
                observaciones=f"Aplicación a {mascota.nombre}"[:255],
            )
        advertencias.extend(avisos)

    tratamiento = TratamientoPreventivo(
        mascota_id=payload.mascota_id,
        tipo=payload.tipo,
        producto_id=producto.id if producto is not None else None,
        nombre_producto=nombre_producto,
        fecha_aplicacion=fecha_aplicacion,
        fecha_proxima_dosis=payload.fecha_proxima_dosis,
        lote=payload.lote,
        peso_kg=payload.peso_kg,
        refuerzo_de_id=payload.refuerzo_de_id,
        consulta_id=payload.consulta_id,
        turno_id=payload.turno_id,
        venta_id=venta_id,
        usuario_id=usuario_id,
        observaciones=payload.observaciones,
    )
    session.add(tratamiento)

    turno_atendido = False
    if turno is not None and producto is not None and turno.estado in ESTADOS_TURNO_A_ATENDER:
        turno.estado = "atendido"
        session.add(turno)
        turno_atendido = True

    if producto is not None and payload.peso_kg is not None:
        mascota.ultimo_peso = payload.peso_kg
        session.add(mascota)

    session.commit()
    session.refresh(tratamiento)
    return TratamientoPreventivoResultado(
        item=get_tratamiento_item(session, tratamiento.id or 0),
        venta_id=venta_id,
        venta_total=venta_total,
        turno_atendido=turno_atendido,
        advertencias=advertencias,
    )


def dosis_a_recordar(
    session: Session, hoy: date, config: PreventivaConfig
) -> list[TratamientoPreventivo]:
    """Dosis con la próxima aplicación dentro de la ventana de aviso, sin refuerzo registrado,
    de mascotas que se pueden atender (no fallecidas ni dadas de baja)."""
    desde = hoy - timedelta(days=config.dias_aviso_dosis_vencida)
    hasta = hoy + timedelta(days=config.dias_aviso_dosis)
    refuerzo = aliased(TratamientoPreventivo)
    reforzadas = select(refuerzo.refuerzo_de_id).where(col(refuerzo.refuerzo_de_id).is_not(None))
    return list(
        session.exec(
            select(TratamientoPreventivo)
            .join(Mascota, col(Mascota.id) == col(TratamientoPreventivo.mascota_id))
            .where(
                col(TratamientoPreventivo.fecha_proxima_dosis).is_not(None),
                col(TratamientoPreventivo.fecha_proxima_dosis) >= desde,
                col(TratamientoPreventivo.fecha_proxima_dosis) <= hasta,
                col(TratamientoPreventivo.id).not_in(reforzadas),
                col(Mascota.mascota_estado_id).in_(ids_estados_atendibles(session)),
            )
            .order_by(
                col(TratamientoPreventivo.fecha_proxima_dosis), col(TratamientoPreventivo.id)
            )
        ).all()
    )
