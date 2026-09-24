from __future__ import annotations

from sqlalchemy import func, or_
from sqlmodel import Session, col, select

from app.core.errors import APIError
from app.core.time_utils import utc_now
from app.models.catalogo.estado_reproductivo import EstadoReproductivo
from app.models.catalogo.habitat import Habitat
from app.models.catalogo.mascota_estado import MascotaEstado
from app.models.catalogo.pelaje import Pelaje
from app.models.catalogo.tamanio import Tamanio
from app.models.catalogo.temperamento import Temperamento
from app.models.clinica.especie import Especie
from app.models.clinica.historial_peso import HistorialPeso
from app.models.clinica.mascota import Mascota
from app.models.clinica.raza import Raza
from app.models.core.persona import Persona
from app.schemas.mascotas import (
    CatalogoClinicoOpcion,
    EspecieOpcionMascota,
    MascotaCreate,
    MascotaCreateResponse,
    MascotaDetail,
    MascotaEstadoOpcion,
    MascotaListItem,
    MascotaListResponse,
    MascotaUpdate,
    RazaOpcionMascota,
    TutorOpcion,
)
from app.services.config_service import get_parametro_valor_por_nombre

MASCOTA_ESTADO_ACTIVA_ID = 1
PARAM_TUTOR_EVENTUAL = "PERSONA_ID_TUTOR_EVENTUAL"
PARAM_RAZA_DEFAULT = "RAZA_NOMBRE_DEFAULT"
RAZA_DEFAULT_FALLBACK = "Sin raza definida"


def list_especies_activas(session: Session) -> list[EspecieOpcionMascota]:
    rows = session.exec(
        select(Especie).where(Especie.activo.is_(True)).order_by(Especie.nombre)
    ).all()
    return [EspecieOpcionMascota(id=row.id or 0, nombre=row.nombre) for row in rows]


def list_razas_por_especie(session: Session, especie_id: int) -> list[RazaOpcionMascota]:
    rows = session.exec(
        select(Raza)
        .where(Raza.especie_id == especie_id, Raza.activo.is_(True))
        .order_by(Raza.nombre)
    ).all()
    return [
        RazaOpcionMascota(id=row.id or 0, nombre=row.nombre, especie_id=row.especie_id)
        for row in rows
    ]


def list_mascota_estados(session: Session) -> list[MascotaEstadoOpcion]:
    rows = session.exec(
        select(MascotaEstado).where(MascotaEstado.activo.is_(True)).order_by(MascotaEstado.id)
    ).all()
    return [MascotaEstadoOpcion(id=row.id or 0, nombre=row.nombre) for row in rows]


def get_raza_default_nombre(session: Session) -> str:
    return get_parametro_valor_por_nombre(
        session, PARAM_RAZA_DEFAULT, default=RAZA_DEFAULT_FALLBACK
    )


def get_tutor_by_id(session: Session, persona_id: int) -> TutorOpcion | None:
    persona = session.get(Persona, persona_id)
    if persona is None or not persona.es_cliente:
        return None
    return TutorOpcion(
        id=persona.id or 0,
        nombre=persona.nombre,
        apellido=persona.apellido,
        dni=persona.dni,
    )


def buscar_tutores(session: Session, q: str, *, limit: int = 20) -> list[TutorOpcion]:
    term = q.strip()
    if len(term) < 1:
        return []

    like = f"%{term}%"
    digits = "".join(ch for ch in term if ch.isdigit())

    conditions = [
        col(Persona.nombre).ilike(like),
        col(Persona.apellido).ilike(like),
        col(Persona.dni).ilike(like),
    ]
    # DNI con puntos/guiones en BD vs dígitos tipeados
    if len(digits) >= 2:
        dni_digits = func.replace(
            func.replace(func.replace(col(Persona.dni), ".", ""), "-", ""),
            " ",
            "",
        )
        conditions.append(dni_digits.like(f"%{digits}%"))

    statement = (
        select(Persona)
        .where(Persona.es_cliente.is_(True), or_(*conditions))
        .order_by(Persona.apellido, Persona.nombre)
        .limit(limit)
    )
    rows = session.exec(statement).all()
    return [
        TutorOpcion(
            id=row.id or 0,
            nombre=row.nombre,
            apellido=row.apellido,
            dni=row.dni,
        )
        for row in rows
    ]


def list_mascotas(
    session: Session,
    *,
    q: str | None,
    especie_id: int | None,
    raza_id: int | None,
    mascota_estado_id: int | None,
    cliente_id: int | None,
    page: int,
    page_size: int,
) -> MascotaListResponse:
    page = max(page, 1)
    page_size = max(min(page_size, 100), 1)

    base = (
        select(
            Mascota.id,
            Mascota.nombre,
            Especie.id,
            Especie.nombre,
            Raza.id,
            Raza.nombre,
            Persona.id,
            Persona.nombre,
            Persona.apellido,
            Persona.dni,
            MascotaEstado.id,
            MascotaEstado.nombre,
        )
        .join(Raza, Mascota.raza_id == Raza.id)
        .join(Especie, Raza.especie_id == Especie.id)
        .join(Persona, Mascota.persona_id == Persona.id)
        .join(MascotaEstado, Mascota.mascota_estado_id == MascotaEstado.id)
    )

    if mascota_estado_id is not None:
        base = base.where(Mascota.mascota_estado_id == mascota_estado_id)
    if especie_id is not None:
        base = base.where(Especie.id == especie_id)
    if raza_id is not None:
        base = base.where(Raza.id == raza_id)
    if cliente_id is not None:
        base = base.where(Persona.id == cliente_id)
    if q and q.strip():
        like = f"%{q.strip().lower()}%"
        base = base.where(
            or_(
                col(Mascota.nombre).ilike(like),
                col(Persona.dni).ilike(like),
                col(Mascota.microchip).ilike(like),
            )
        )

    count_stmt = select(func.count()).select_from(base.subquery())
    total = session.exec(count_stmt).one()

    rows = session.exec(
        base.order_by(Mascota.nombre).offset((page - 1) * page_size).limit(page_size)
    ).all()

    items = [
        MascotaListItem(
            id=row[0] or 0,
            nombre=row[1],
            especie_id=row[2] or 0,
            especie_nombre=row[3],
            raza_id=row[4] or 0,
            raza_nombre=row[5],
            persona_id=row[6] or 0,
            tutor_nombre=row[7],
            tutor_apellido=row[8],
            tutor_dni=row[9],
            mascota_estado_id=row[10] or 0,
            mascota_estado_nombre=row[11],
        )
        for row in rows
    ]
    return MascotaListResponse(items=items, total=total, page=page, page_size=page_size)


def _resolve_persona_id(session: Session, payload: MascotaCreate) -> int:
    if payload.tutor_eventual:
        raw = get_parametro_valor_por_nombre(session, PARAM_TUTOR_EVENTUAL)
        try:
            persona_id = int(raw)
        except ValueError as exc:
            raise APIError(
                500,
                "CONFIG_INVALIDA",
                "PERSONA_ID_TUTOR_EVENTUAL no es un entero válido",
            ) from exc
        persona = session.get(Persona, persona_id)
        if persona is None:
            raise APIError(
                404,
                "TUTOR_EVENTUAL_NO_ENCONTRADO",
                "No existe la persona configurada como tutor eventual",
            )
        return persona_id

    persona_id = payload.persona_id
    if persona_id is None:
        raise APIError(400, "TUTOR_REQUERIDO", "Debe indicar un tutor")
    persona = session.get(Persona, persona_id)
    if persona is None or not persona.es_cliente:
        raise APIError(404, "TUTOR_NO_ENCONTRADO", "No se encontró el tutor indicado")
    return persona_id


def create_mascota(session: Session, payload: MascotaCreate) -> MascotaCreateResponse:
    persona_id = _resolve_persona_id(session, payload)

    raza = session.get(Raza, payload.raza_id)
    if raza is None or raza.especie_id != payload.especie_id:
        raise APIError(
            400,
            "RAZA_INVALIDA",
            "La raza no pertenece a la especie seleccionada",
        )

    estado = session.get(MascotaEstado, MASCOTA_ESTADO_ACTIVA_ID)
    if estado is None:
        raise APIError(
            500,
            "ESTADO_ACTIVA_NO_ENCONTRADO",
            "No existe el estado operativo ACTIVA (id=1)",
        )

    if payload.microchip:
        existing_chip = session.exec(
            select(Mascota).where(Mascota.microchip == payload.microchip)
        ).first()
        if existing_chip is not None:
            raise APIError(409, "MICROCHIP_DUPLICADO", "Ya existe una mascota con ese microchip")

    mascota = Mascota(
        persona_id=persona_id,
        raza_id=payload.raza_id,
        nombre=payload.nombre.strip(),
        sexo=payload.sexo,
        fecha_nacimiento=payload.fecha_nacimiento,
        microchip=payload.microchip,
        alertas_medicas=payload.alertas_medicas,
        mascota_estado_id=MASCOTA_ESTADO_ACTIVA_ID,
    )
    session.add(mascota)
    session.flush()

    peso_registrado = False
    if payload.peso_inicial_kg is not None:
        session.add(
            HistorialPeso(
                mascota_id=mascota.id or 0,
                fecha=utc_now(),
                peso_kg=payload.peso_inicial_kg,
            )
        )
        peso_registrado = True

    session.commit()
    session.refresh(mascota)

    return MascotaCreateResponse(
        id=mascota.id or 0,
        nombre=mascota.nombre,
        persona_id=mascota.persona_id,
        raza_id=mascota.raza_id,
        mascota_estado_id=mascota.mascota_estado_id,
        peso_registrado=peso_registrado,
    )


def _tutor_eventual_id(session: Session) -> int | None:
    raw = get_parametro_valor_por_nombre(session, PARAM_TUTOR_EVENTUAL, default="")
    if not raw or not str(raw).strip():
        return None
    try:
        return int(str(raw).strip())
    except ValueError:
        return None


def _to_mascota_detail(session: Session, mascota: Mascota) -> MascotaDetail:
    raza = session.get(Raza, mascota.raza_id)
    if raza is None:
        raise APIError(500, "RAZA_NO_ENCONTRADA", "La mascota no tiene una raza válida")
    especie = session.get(Especie, raza.especie_id)
    if especie is None:
        raise APIError(500, "ESPECIE_NO_ENCONTRADA", "La mascota no tiene una especie válida")
    persona = session.get(Persona, mascota.persona_id)
    if persona is None:
        raise APIError(500, "TUTOR_NO_ENCONTRADO", "La mascota no tiene un tutor válido")
    estado = session.get(MascotaEstado, mascota.mascota_estado_id)
    if estado is None:
        raise APIError(500, "ESTADO_NO_ENCONTRADO", "La mascota no tiene un estado válido")

    sexo: str | None = mascota.sexo
    if sexo not in (None, "M", "H", "U"):
        sexo = None

    return MascotaDetail(
        id=mascota.id or 0,
        nombre=mascota.nombre,
        especie_id=especie.id or 0,
        especie_nombre=especie.nombre,
        raza_id=raza.id or 0,
        raza_nombre=raza.nombre,
        persona_id=persona.id or 0,
        tutor_nombre=persona.nombre,
        tutor_apellido=persona.apellido,
        tutor_dni=persona.dni,
        mascota_estado_id=estado.id or 0,
        mascota_estado_nombre=estado.nombre,
        sexo=sexo,  # type: ignore[arg-type]
        fecha_nacimiento=mascota.fecha_nacimiento,
        microchip=mascota.microchip,
        alertas_medicas=mascota.alertas_medicas,
        pelaje_id=mascota.pelaje_id,
        tamanio_id=mascota.tamanio_id,
        habitat_id=mascota.habitat_id,
        estado_reproductivo_id=mascota.estado_reproductivo_id,
        temperamento_id=mascota.temperamento_id,
    )


def get_mascota(session: Session, mascota_id: int) -> MascotaDetail:
    mascota = session.get(Mascota, mascota_id)
    if mascota is None:
        raise APIError(404, "MASCOTA_NO_ENCONTRADA", "No se encontró la mascota indicada")
    return _to_mascota_detail(session, mascota)


def _validate_catalogo_especie(
    session: Session,
    *,
    model: type,
    item_id: int | None,
    especie_id: int,
    error_code: str,
    label: str,
) -> None:
    if item_id is None:
        return
    row = session.get(model, item_id)
    if row is None or not getattr(row, "activo", False):
        raise APIError(400, error_code, f"No se encontró {label} activo indicado")
    row_especie = getattr(row, "especie_id", None)
    if row_especie is not None and row_especie != especie_id:
        raise APIError(
            400,
            error_code,
            f"El {label} no pertenece a la especie de la mascota",
        )


def update_mascota(session: Session, mascota_id: int, payload: MascotaUpdate) -> MascotaDetail:
    mascota = session.get(Mascota, mascota_id)
    if mascota is None:
        raise APIError(404, "MASCOTA_NO_ENCONTRADA", "No se encontró la mascota indicada")

    data = payload.model_dump(exclude_unset=True)
    current_raza = session.get(Raza, mascota.raza_id)
    if current_raza is None:
        raise APIError(500, "RAZA_NO_ENCONTRADA", "La mascota no tiene una raza válida")
    especie_id = current_raza.especie_id

    if "persona_id" in data:
        new_persona_id = data["persona_id"]
        if new_persona_id is None:
            raise APIError(400, "TUTOR_REQUERIDO", "Debe indicar un tutor")
        persona = session.get(Persona, new_persona_id)
        if persona is None or not persona.es_cliente:
            raise APIError(404, "TUTOR_NO_ENCONTRADO", "No se encontró el tutor indicado")
        eventual_id = _tutor_eventual_id(session)
        if (
            eventual_id is not None
            and new_persona_id == eventual_id
            and mascota.persona_id != eventual_id
        ):
            raise APIError(
                400,
                "TUTOR_EVENTUAL_NO_PERMITIDO",
                "No se puede pasar una mascota con tutor registrado al tutor eventual",
            )
        mascota.persona_id = new_persona_id

    if "raza_id" in data:
        raza_id = data["raza_id"]
        if raza_id is None:
            raise APIError(400, "RAZA_REQUERIDA", "Debe indicar una raza")
        raza = session.get(Raza, raza_id)
        if raza is None or raza.especie_id != especie_id:
            raise APIError(
                400,
                "RAZA_INVALIDA",
                "La raza no pertenece a la especie de la mascota",
            )
        mascota.raza_id = raza_id

    if "mascota_estado_id" in data:
        estado_id = data["mascota_estado_id"]
        if estado_id is None:
            raise APIError(400, "ESTADO_REQUERIDO", "Debe indicar un estado")
        estado = session.get(MascotaEstado, estado_id)
        if estado is None or not estado.activo:
            raise APIError(400, "ESTADO_INVALIDO", "No se encontró el estado indicado")
        mascota.mascota_estado_id = estado_id

    if "nombre" in data and data["nombre"] is not None:
        mascota.nombre = data["nombre"]

    if "sexo" in data:
        mascota.sexo = data["sexo"]

    if "fecha_nacimiento" in data:
        mascota.fecha_nacimiento = data["fecha_nacimiento"]

    if "microchip" in data:
        chip = data["microchip"]
        if chip:
            existing_chip = session.exec(
                select(Mascota).where(
                    Mascota.microchip == chip,
                    Mascota.id != mascota_id,
                )
            ).first()
            if existing_chip is not None:
                raise APIError(
                    409, "MICROCHIP_DUPLICADO", "Ya existe una mascota con ese microchip"
                )
        mascota.microchip = chip

    if "alertas_medicas" in data:
        mascota.alertas_medicas = data["alertas_medicas"]

    if "pelaje_id" in data:
        _validate_catalogo_especie(
            session,
            model=Pelaje,
            item_id=data["pelaje_id"],
            especie_id=especie_id,
            error_code="PELAJE_INVALIDO",
            label="pelaje",
        )
        mascota.pelaje_id = data["pelaje_id"]

    if "tamanio_id" in data:
        _validate_catalogo_especie(
            session,
            model=Tamanio,
            item_id=data["tamanio_id"],
            especie_id=especie_id,
            error_code="TAMANIO_INVALIDO",
            label="tamaño",
        )
        mascota.tamanio_id = data["tamanio_id"]

    if "habitat_id" in data:
        _validate_catalogo_especie(
            session,
            model=Habitat,
            item_id=data["habitat_id"],
            especie_id=especie_id,
            error_code="HABITAT_INVALIDO",
            label="hábitat",
        )
        mascota.habitat_id = data["habitat_id"]

    if "estado_reproductivo_id" in data:
        _validate_catalogo_especie(
            session,
            model=EstadoReproductivo,
            item_id=data["estado_reproductivo_id"],
            especie_id=especie_id,
            error_code="ESTADO_REPRODUCTIVO_INVALIDO",
            label="estado reproductivo",
        )
        mascota.estado_reproductivo_id = data["estado_reproductivo_id"]

    if "temperamento_id" in data:
        _validate_catalogo_especie(
            session,
            model=Temperamento,
            item_id=data["temperamento_id"],
            especie_id=especie_id,
            error_code="TEMPERAMENTO_INVALIDO",
            label="temperamento",
        )
        mascota.temperamento_id = data["temperamento_id"]

    session.add(mascota)
    session.commit()
    session.refresh(mascota)
    return _to_mascota_detail(session, mascota)


def list_catalogo_clinico_por_especie(
    session: Session,
    *,
    model: type,
    especie_id: int,
) -> list[CatalogoClinicoOpcion]:
    rows = session.exec(
        select(model)
        .where(model.especie_id == especie_id, model.activo.is_(True))  # type: ignore[attr-defined]
        .order_by(model.nombre)  # type: ignore[attr-defined]
    ).all()
    return [
        CatalogoClinicoOpcion(
            id=getattr(row, "id") or 0,
            nombre=getattr(row, "nombre"),
            especie_id=getattr(row, "especie_id"),
        )
        for row in rows
    ]
