from __future__ import annotations

from sqlmodel import Session, col, select

from app.core.errors import APIError
from app.models.auth.permiso import Permiso
from app.models.auth.rol import Rol
from app.models.auth.rol_permiso import RolPermiso
from app.models.auth.usuario import Usuario
from app.schemas.roles import (
    PermisoItem,
    RolCreate,
    RolDetail,
    RolListItem,
    RolPermisosUpdate,
)

ADMIN_ROLE_NAME = "ADMIN"
WILDCARD_PERMISSION = "*"


def is_admin_role_name(nombre: str) -> bool:
    return nombre.casefold() == ADMIN_ROLE_NAME.casefold()


def list_roles(session: Session) -> list[RolListItem]:
    rows = session.exec(select(Rol).order_by(Rol.nombre)).all()
    return [RolListItem(id=rol.id or 0, nombre=rol.nombre) for rol in rows]


def list_permisos(session: Session) -> list[PermisoItem]:
    rows = session.exec(select(Permiso).order_by(Permiso.nombre)).all()
    return [
        PermisoItem(id=permiso.id or 0, nombre=permiso.nombre, descripcion=permiso.descripcion)
        for permiso in rows
    ]


def _permisos_de_rol(session: Session, rol_id: int) -> list[Permiso]:
    return list(
        session.exec(
            select(Permiso)
            .join(RolPermiso, RolPermiso.permiso_id == Permiso.id)
            .where(RolPermiso.rol_id == rol_id)
            .order_by(Permiso.nombre)
        ).all()
    )


def _to_detail(session: Session, rol: Rol) -> RolDetail:
    permisos = _permisos_de_rol(session, rol.id or 0)
    nombres = {permiso.nombre for permiso in permisos}
    es_admin = is_admin_role_name(rol.nombre)
    return RolDetail(
        id=rol.id or 0,
        nombre=rol.nombre,
        descripcion=rol.descripcion,
        es_admin=es_admin,
        acceso_total=es_admin or WILDCARD_PERMISSION in nombres,
        permisos=[
            PermisoItem(id=permiso.id or 0, nombre=permiso.nombre, descripcion=permiso.descripcion)
            for permiso in permisos
        ],
    )


def get_rol_detail(session: Session, rol_id: int) -> RolDetail:
    rol = session.get(Rol, rol_id)
    if rol is None:
        raise APIError(404, "ROL_NO_ENCONTRADO", "No se encontró el rol solicitado")
    return _to_detail(session, rol)


def create_rol(session: Session, payload: RolCreate) -> RolDetail:
    nombre = payload.nombre.strip()
    if not nombre:
        raise APIError(422, "NOMBRE_INVALIDO", "El nombre del rol es obligatorio")
    if is_admin_role_name(nombre):
        raise APIError(400, "ROL_RESERVADO", "El rol ADMIN es de sistema y no se puede crear")

    existing = session.exec(select(Rol).where(Rol.nombre == nombre)).first()
    if existing is not None:
        raise APIError(409, "ROL_NOMBRE_DUPLICADO", "Ya existe un rol con ese nombre")

    descripcion = payload.descripcion.strip() if payload.descripcion else None
    if descripcion == "":
        descripcion = None

    rol = Rol(nombre=nombre, descripcion=descripcion)
    session.add(rol)
    session.commit()
    session.refresh(rol)
    return _to_detail(session, rol)


def _bump_version_token_for_rol(session: Session, rol_id: int) -> None:
    usuarios = session.exec(select(Usuario).where(Usuario.rol_id == rol_id)).all()
    for usuario in usuarios:
        usuario.version_token += 1
        session.add(usuario)


def update_rol_permisos(
    session: Session,
    rol_id: int,
    payload: RolPermisosUpdate,
) -> RolDetail:
    rol = session.get(Rol, rol_id)
    if rol is None:
        raise APIError(404, "ROL_NO_ENCONTRADO", "No se encontró el rol solicitado")
    if is_admin_role_name(rol.nombre):
        raise APIError(
            403,
            "ROL_ADMIN_INMUTABLE",
            "El rol ADMIN no se puede modificar desde esta pantalla",
        )

    unique_ids = list(dict.fromkeys(payload.permiso_ids))
    if unique_ids:
        encontrados = session.exec(select(Permiso).where(col(Permiso.id).in_(unique_ids))).all()
        encontrados_by_id = {permiso.id: permiso for permiso in encontrados}
        faltantes = [permiso_id for permiso_id in unique_ids if permiso_id not in encontrados_by_id]
        if faltantes:
            raise APIError(404, "PERMISO_NO_ENCONTRADO", "Uno o más permisos no existen")
        for permiso in encontrados:
            if permiso.nombre == WILDCARD_PERMISSION:
                raise APIError(
                    400,
                    "COMODIN_NO_PERMITIDO",
                    "El comodín * no se puede asignar manualmente a roles operativos",
                )

    actuales = session.exec(select(RolPermiso).where(RolPermiso.rol_id == rol_id)).all()
    actuales_ids = {link.permiso_id for link in actuales}
    deseados_ids = set(unique_ids)

    for link in actuales:
        if link.permiso_id not in deseados_ids:
            session.delete(link)

    for permiso_id in deseados_ids - actuales_ids:
        session.add(RolPermiso(rol_id=rol_id, permiso_id=permiso_id))

    _bump_version_token_for_rol(session, rol_id)
    session.commit()
    session.refresh(rol)
    return _to_detail(session, rol)
