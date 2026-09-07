from __future__ import annotations

from typing import Literal, TypeVar

from sqlmodel import Session, SQLModel, col, select

from app.core.errors import APIError
from app.models.catalogo.estado_reproductivo import EstadoReproductivo
from app.models.catalogo.habitat import Habitat
from app.models.catalogo.mascota_estado import MascotaEstado
from app.models.catalogo.pelaje import Pelaje
from app.models.catalogo.tamanio import Tamanio
from app.models.catalogo.temperamento import Temperamento
from app.models.clinica.especie import Especie
from app.schemas.catalogos import (
    CatalogoConEspecieCreate,
    CatalogoConEspecieUpdate,
    CatalogoGlobalCreate,
    CatalogoGlobalUpdate,
    CatalogoItem,
    EspecieOpcion,
)

T = TypeVar("T", bound=SQLModel)

ActivoFilter = Literal["true", "false", "all"]


def list_especies_opciones(session: Session) -> list[EspecieOpcion]:
    # Orden por id: el DBA carga las más frecuentes primero (ids más bajos).
    rows = session.exec(select(Especie).order_by(Especie.id)).all()
    return [
        EspecieOpcion(id=row.id or 0, nombre=row.nombre, activo=row.activo) for row in rows
    ]


def _ensure_especie_exists(session: Session, especie_id: int) -> Especie:
    especie = session.get(Especie, especie_id)
    if especie is None:
        raise APIError(404, "ESPECIE_NO_ENCONTRADA", "No se encontró la especie indicada")
    return especie


def _to_item(row: SQLModel, *, con_especie: bool) -> CatalogoItem:
    especie_id = getattr(row, "especie_id", None) if con_especie else None
    especie = getattr(row, "especie", None) if con_especie else None
    return CatalogoItem(
        id=getattr(row, "id") or 0,
        nombre=getattr(row, "nombre"),
        descripcion=getattr(row, "descripcion"),
        activo=getattr(row, "activo"),
        especie_id=especie_id,
        especie_nombre=especie.nombre if especie is not None else None,
    )


def list_catalogo_con_especie(
    session: Session,
    model: type[T],
    *,
    q: str | None,
    especie_id: int | None,
    activo: ActivoFilter,
) -> list[CatalogoItem]:
    statement = select(model)
    if q and q.strip():
        term = f"%{q.strip().lower()}%"
        statement = statement.where(col(model.nombre).ilike(term))  # type: ignore[attr-defined]
    if especie_id is not None:
        statement = statement.where(model.especie_id == especie_id)  # type: ignore[attr-defined]
    if activo == "true":
        statement = statement.where(model.activo.is_(True))  # type: ignore[attr-defined]
    elif activo == "false":
        statement = statement.where(model.activo.is_(False))  # type: ignore[attr-defined]
    statement = statement.order_by(model.nombre)  # type: ignore[attr-defined]
    rows = session.exec(statement).all()
    return [_to_item(row, con_especie=True) for row in rows]


def list_catalogo_global(
    session: Session,
    model: type[T],
    *,
    q: str | None,
    activo: ActivoFilter,
) -> list[CatalogoItem]:
    statement = select(model)
    if q and q.strip():
        term = f"%{q.strip().lower()}%"
        statement = statement.where(col(model.nombre).ilike(term))  # type: ignore[attr-defined]
    if activo == "true":
        statement = statement.where(model.activo.is_(True))  # type: ignore[attr-defined]
    elif activo == "false":
        statement = statement.where(model.activo.is_(False))  # type: ignore[attr-defined]
    statement = statement.order_by(model.nombre)  # type: ignore[attr-defined]
    rows = session.exec(statement).all()
    return [_to_item(row, con_especie=False) for row in rows]


def create_catalogo_con_especie(
    session: Session,
    model: type[T],
    payload: CatalogoConEspecieCreate,
) -> CatalogoItem:
    _ensure_especie_exists(session, payload.especie_id)
    row = model(
        nombre=payload.nombre,
        descripcion=payload.descripcion,
        especie_id=payload.especie_id,
        activo=True,
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    return _to_item(row, con_especie=True)


def update_catalogo_con_especie(
    session: Session,
    model: type[T],
    item_id: int,
    payload: CatalogoConEspecieUpdate,
) -> CatalogoItem:
    row = session.get(model, item_id)
    if row is None:
        raise APIError(404, "CATALOGO_NO_ENCONTRADO", "No se encontró el registro solicitado")
    _ensure_especie_exists(session, payload.especie_id)
    row.nombre = payload.nombre  # type: ignore[attr-defined]
    row.descripcion = payload.descripcion  # type: ignore[attr-defined]
    row.especie_id = payload.especie_id  # type: ignore[attr-defined]
    session.add(row)
    session.commit()
    session.refresh(row)
    return _to_item(row, con_especie=True)


def create_catalogo_global(
    session: Session,
    model: type[T],
    payload: CatalogoGlobalCreate,
) -> CatalogoItem:
    row = model(nombre=payload.nombre, descripcion=payload.descripcion, activo=True)
    session.add(row)
    session.commit()
    session.refresh(row)
    return _to_item(row, con_especie=False)


def update_catalogo_global(
    session: Session,
    model: type[T],
    item_id: int,
    payload: CatalogoGlobalUpdate,
) -> CatalogoItem:
    row = session.get(model, item_id)
    if row is None:
        raise APIError(404, "CATALOGO_NO_ENCONTRADO", "No se encontró el registro solicitado")
    row.nombre = payload.nombre  # type: ignore[attr-defined]
    row.descripcion = payload.descripcion  # type: ignore[attr-defined]
    session.add(row)
    session.commit()
    session.refresh(row)
    return _to_item(row, con_especie=False)


def set_catalogo_activo(
    session: Session,
    model: type[T],
    item_id: int,
    activo: bool,
    *,
    con_especie: bool,
) -> CatalogoItem:
    row = session.get(model, item_id)
    if row is None:
        raise APIError(404, "CATALOGO_NO_ENCONTRADO", "No se encontró el registro solicitado")
    row.activo = activo  # type: ignore[attr-defined]
    session.add(row)
    session.commit()
    session.refresh(row)
    return _to_item(row, con_especie=con_especie)


# Tipados de ayuda para el router
CATALOGOS_CON_ESPECIE: dict[str, type[SQLModel]] = {
    "habitats": Habitat,
    "tamanios": Tamanio,
    "pelajes": Pelaje,
    "temperamentos": Temperamento,
    "estados-reproductivos": EstadoReproductivo,
}

CATALOGO_GLOBAL: dict[str, type[SQLModel]] = {
    "mascota-estados": MascotaEstado,
}
