from __future__ import annotations

import secrets
import string
import unicodedata

from sqlalchemy import func
from sqlmodel import Session, select

from app.core.errors import APIError
from app.core.security import hash_password
from app.models.auth.historial_contrasena import HistorialContrasena
from app.models.auth.login import Login
from app.models.auth.rol import Rol
from app.models.auth.usuario import Usuario
from app.models.core.domicilio import Domicilio
from app.models.core.persona import Persona
from app.schemas.usuarios import (
    UsuarioCreate,
    UsuarioCreateResponse,
    UsuarioListItem,
    UsuarioRestablecerResponse,
)


def _strip_accents(value: str) -> str:
    normalized = unicodedata.normalize("NFKD", value)
    return "".join(ch for ch in normalized if not unicodedata.combining(ch))


def build_username_base(nombre: str, apellido: str) -> str:
    nombre_clean = _strip_accents(nombre).strip().lower()
    apellido_clean = _strip_accents(apellido).replace(" ", "").lower()
    if not nombre_clean or not apellido_clean:
        raise APIError(400, "USERNAME_INVALIDO", "No se pudo generar el nombre de usuario")
    return f"{nombre_clean[0]}{apellido_clean}"


def allocate_username(session: Session, nombre: str, apellido: str) -> str:
    base = build_username_base(nombre, apellido)[:50]
    candidate = base
    suffix = 2
    while session.exec(select(Usuario).where(Usuario.username == candidate)).first() is not None:
        suffix_str = str(suffix)
        max_base_len = 50 - len(suffix_str)
        candidate = f"{base[:max_base_len]}{suffix_str}"
        suffix += 1
        if suffix > 9999:
            raise APIError(409, "USERNAME_AGOTADO", "No se pudo generar un username único")
    return candidate


def generate_temp_password(length: int = 10) -> str:
    alphabet = string.ascii_letters + string.digits
    left = "".join(secrets.choice(alphabet) for _ in range(4))
    right = "".join(secrets.choice(alphabet) for _ in range(length - 5))
    return f"{left}-{right}"


def _ultimo_login_subquery():
    return (
        select(
            Login.usuario_id,
            func.max(Login.fecha).label("ultimo_inicio_sesion"),
        )
        .where(Login.exito.is_(True))
        .group_by(Login.usuario_id)
        .subquery()
    )


def _row_to_list_item(row: tuple) -> UsuarioListItem:
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
    return UsuarioListItem(
        id=usuario_id,
        username=username,
        nombre=nombre,
        apellido=apellido,
        habilitado=habilitado,
        rol_id=rol_id,
        rol_nombre=rol_nombre,
        ultimo_inicio_sesion=ultimo_inicio_sesion,
    )


def list_usuarios(session: Session) -> list[UsuarioListItem]:
    ultimo_login_subq = _ultimo_login_subquery()

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
    return [_row_to_list_item(row) for row in rows]


def get_usuario_list_item(session: Session, usuario_id: int) -> UsuarioListItem:
    ultimo_login_subq = _ultimo_login_subquery()

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
        .where(Usuario.id == usuario_id)
    )

    row = session.exec(statement).first()
    if row is None:
        raise APIError(404, "USUARIO_NO_ENCONTRADO", "No se encontró el usuario solicitado")
    return _row_to_list_item(row)


def set_usuario_habilitado(
    session: Session,
    usuario_id: int,
    habilitado: bool,
) -> UsuarioListItem:
    usuario = session.get(Usuario, usuario_id)
    if usuario is None:
        raise APIError(404, "USUARIO_NO_ENCONTRADO", "No se encontró el usuario solicitado")

    if usuario.habilitado != habilitado:
        usuario.habilitado = habilitado
        if not habilitado:
            usuario.version_token += 1
        session.add(usuario)
        session.commit()

    return get_usuario_list_item(session, usuario_id)


def create_usuario(session: Session, payload: UsuarioCreate) -> UsuarioCreateResponse:
    existing_dni = session.exec(select(Persona).where(Persona.dni == payload.dni)).first()
    if existing_dni is not None:
        raise APIError(409, "DNI_DUPLICADO", "Ya existe una persona con ese DNI")

    rol = session.get(Rol, payload.rol_id)
    if rol is None:
        raise APIError(404, "ROL_NO_ENCONTRADO", "No se encontró el rol solicitado")

    username = allocate_username(session, payload.nombre, payload.apellido)
    password_temporal = generate_temp_password()

    domicilio = Domicilio(
        pais=payload.domicilio.pais,
        provincia=payload.domicilio.provincia,
        ciudad=payload.domicilio.ciudad,
        cp=payload.domicilio.cp,
        calle=payload.domicilio.calle,
        altura=payload.domicilio.altura,
        departamento=payload.domicilio.departamento,
        notas=payload.domicilio.notas,
    )
    session.add(domicilio)
    session.flush()

    persona = Persona(
        nombre=payload.nombre.strip(),
        apellido=payload.apellido.strip(),
        dni=payload.dni,
        sexo=payload.sexo,
        fecha_nacimiento=payload.fecha_nacimiento,
        domicilio_id=domicilio.id,
        mail=payload.mail,
        celular=payload.celular,
    )
    session.add(persona)
    session.flush()

    usuario = Usuario(
        persona_id=persona.id or 0,
        username=username,
        habilitado=payload.habilitado,
        rol_id=payload.rol_id,
        version_token=1,
    )
    session.add(usuario)
    session.flush()

    historial = HistorialContrasena(
        usuario_id=usuario.id or 0,
        hashed_password=hash_password(password_temporal),
        debe_cambiar=True,
    )
    session.add(historial)
    session.commit()
    session.refresh(usuario)

    return UsuarioCreateResponse(
        id=usuario.id or 0,
        username=usuario.username,
        password_temporal=password_temporal,
        debe_cambiar=True,
    )


def restablecer_contrasena(session: Session, usuario_id: int) -> UsuarioRestablecerResponse:
    usuario = session.get(Usuario, usuario_id)
    if usuario is None:
        raise APIError(404, "USUARIO_NO_ENCONTRADO", "No se encontró el usuario solicitado")

    password_temporal = generate_temp_password()
    historial = HistorialContrasena(
        usuario_id=usuario.id or 0,
        hashed_password=hash_password(password_temporal),
        debe_cambiar=True,
    )
    usuario.version_token += 1
    session.add(historial)
    session.add(usuario)
    session.commit()
    session.refresh(usuario)

    return UsuarioRestablecerResponse(
        mensaje="Contraseña restablecida exitosamente",
        usuario_id=usuario.id or 0,
        username=usuario.username,
        password_temporal=password_temporal,
    )
