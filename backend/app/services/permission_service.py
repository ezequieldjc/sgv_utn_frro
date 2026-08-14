from __future__ import annotations

from sqlmodel import Session, select

from app.models.auth.permiso import Permiso
from app.models.auth.rol_permiso import RolPermiso
from app.models.auth.usuario import Usuario


def get_user_permissions(session: Session, user: Usuario) -> list[str]:
    stmt = (
        select(Permiso.nombre)
        .join(RolPermiso, RolPermiso.permiso_id == Permiso.id)
        .where(RolPermiso.rol_id == user.rol_id)
        .order_by(Permiso.nombre)
    )
    values = list(session.exec(stmt).all())
    permissions: list[str] = []
    for value in values:
        if value not in permissions:
            permissions.append(value)
    return permissions


def has_permission(permissions: list[str], required_permission: str) -> bool:
    return "*" in permissions or required_permission in permissions
