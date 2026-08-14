from __future__ import annotations

from sqlalchemy import func
from sqlmodel import Session, select

from app.models.auth.login import Login
from app.models.auth.rol import Rol
from app.models.auth.usuario import Usuario
from app.models.core.persona import Persona
from app.schemas.usuarios import UsuarioListItem


def list_usuarios(session: Session) -> list[UsuarioListItem]:
    ultimo_login_subq = (
        select(
            Login.usuario_id,
            func.max(Login.fecha).label("ultimo_inicio_sesion"),
        )
        .where(Login.exito.is_(True))
        .group_by(Login.usuario_id)
        .subquery()
    )

    statement = (
        select(
            Usuario.id,
            Usuario.username,
            Usuario.habilitado,
            Usuario.rol_id,
            Persona.nombre,
            Persona.apellido,
            Rol.nombre,
            ultimo_login_subq.c.ultimo_inicio_sesion,
        )
        .join(Persona, Usuario.persona_id == Persona.id)
        .join(Rol, Usuario.rol_id == Rol.id)
        .outerjoin(ultimo_login_subq, Usuario.id == ultimo_login_subq.c.usuario_id)
        .order_by(Persona.apellido, Persona.nombre)
    )

    rows = session.exec(statement).all()
    items: list[UsuarioListItem] = []
    for row in rows:
        (
            usuario_id,
            username,
            habilitado,
            rol_id,
            nombre,
            apellido,
            rol_nombre,
            ultimo_inicio_sesion,
        ) = row
        items.append(
            UsuarioListItem(
                id=usuario_id,
                username=username,
                nombre=nombre,
                apellido=apellido,
                habilitado=habilitado,
                rol_id=rol_id,
                rol_nombre=rol_nombre,
                ultimo_inicio_sesion=ultimo_inicio_sesion,
            )
        )
    return items
