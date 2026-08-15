from __future__ import annotations

from sqlmodel import Session, select

from app.models.auth.rol import Rol
from app.schemas.roles import RolListItem


def list_roles(session: Session) -> list[RolListItem]:
    rows = session.exec(select(Rol).order_by(Rol.nombre)).all()
    return [RolListItem(id=rol.id or 0, nombre=rol.nombre) for rol in rows]
