from __future__ import annotations

from datetime import date

from sqlmodel import Session, select

from app.core.errors import APIError
from app.models.core.domicilio import Domicilio
from app.models.core.persona import Persona
from app.schemas.clientes import (
    ClienteCreate,
    ClienteCreateResponse,
    ClienteCuenta,
    ClienteDetail,
    ClienteListItem,
    ClienteUpdate,
)
from app.services.cuenta_cliente_service import ROL_CLIENTE_NOMBRE, crear_cuenta_cliente
from app.services.persona_service import (
    actualizar_persona,
    domicilio_detalle,
    usuario_de_persona,
)

__all__ = [
    "ROL_CLIENTE_NOMBRE",
    "calcular_edad_truncada",
    "create_cliente",
    "get_cliente",
    "list_clientes",
    "update_cliente",
]


def calcular_edad_truncada(
    fecha_nacimiento: date | None, hoy: date | None = None
) -> int | None:
    if fecha_nacimiento is None:
        return None
    referencia = hoy or date.today()
    años = referencia.year - fecha_nacimiento.year
    if (referencia.month, referencia.day) < (fecha_nacimiento.month, fecha_nacimiento.day):
        años -= 1
    return max(años, 0)


def list_clientes(session: Session) -> list[ClienteListItem]:
    statement = (
        select(
            Persona.id,
            Persona.nombre,
            Persona.apellido,
            Persona.dni,
            Persona.sexo,
            Persona.celular,
            Persona.fecha_alta,
            Persona.fecha_nacimiento,
            Domicilio.ciudad,
        )
        .outerjoin(Domicilio, Persona.domicilio_id == Domicilio.id)
        .where(Persona.es_cliente.is_(True))
        .order_by(Persona.apellido, Persona.nombre)
    )

    rows = session.exec(statement).all()
    hoy = date.today()
    return [
        ClienteListItem(
            id=row[0] or 0,
            nombre=row[1],
            apellido=row[2],
            dni=row[3],
            sexo=row[4],
            celular=row[5],
            fecha_alta=row[6],
            ciudad=row[8],
            edad=calcular_edad_truncada(row[7], hoy),
        )
        for row in rows
    ]


def create_cliente(session: Session, payload: ClienteCreate) -> ClienteCreateResponse:
    """Alta desde recepción: siempre crea el usuario CLIENTE (el mail es el usuario) con una
    contraseña temporal que la pantalla le muestra a la recepción."""
    cuenta = crear_cuenta_cliente(
        session,
        nombre=payload.nombre,
        apellido=payload.apellido,
        celular=payload.celular,
        mail=payload.mail,
        dni=payload.dni,
        sexo=payload.sexo,
        fecha_nacimiento=payload.fecha_nacimiento,
        domicilio=payload.domicilio,
    )
    session.commit()
    session.refresh(cuenta.persona)
    session.refresh(cuenta.usuario)

    return ClienteCreateResponse(
        id=cuenta.persona.id or 0,
        nombre=cuenta.persona.nombre,
        apellido=cuenta.persona.apellido,
        dni=cuenta.persona.dni,
        username=cuenta.usuario.username,
        password_temporal=cuenta.password_temporal or "",
    )


def _get_persona_cliente(session: Session, cliente_id: int) -> Persona:
    persona = session.get(Persona, cliente_id)
    if persona is None or not persona.es_cliente:
        raise APIError(404, "CLIENTE_NO_ENCONTRADO", "No se encontró el cliente solicitado")
    return persona


def get_cliente(session: Session, cliente_id: int) -> ClienteDetail:
    persona = _get_persona_cliente(session, cliente_id)
    usuario = usuario_de_persona(session, persona.id or 0)
    return ClienteDetail(
        id=persona.id or 0,
        nombre=persona.nombre,
        apellido=persona.apellido,
        dni=persona.dni,
        sexo=persona.sexo,
        fecha_nacimiento=persona.fecha_nacimiento,
        celular=persona.celular,
        mail=persona.mail,
        fecha_alta=persona.fecha_alta,
        domicilio=domicilio_detalle(session, persona.domicilio_id),
        cuenta=(
            ClienteCuenta(
                usuario_id=usuario.id or 0,
                username=usuario.username,
                habilitado=usuario.habilitado,
            )
            if usuario is not None
            else None
        ),
    )


def update_cliente(session: Session, cliente_id: int, payload: ClienteUpdate) -> ClienteDetail:
    """Edición desde Clientes. Si cambia el mail, cambia también el usuario del cliente."""
    persona = _get_persona_cliente(session, cliente_id)
    actualizar_persona(
        session,
        persona,
        nombre=payload.nombre,
        apellido=payload.apellido,
        celular=payload.celular,
        mail=payload.mail,
        dni=payload.dni,
        sexo=payload.sexo,
        fecha_nacimiento=payload.fecha_nacimiento,
        domicilio=payload.domicilio,
    )
    session.commit()
    return get_cliente(session, cliente_id)

