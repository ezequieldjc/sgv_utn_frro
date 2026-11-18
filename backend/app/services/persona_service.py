"""Edición de los datos de una persona (cliente o empleado), compartida por Clientes → Editar y
Admin → Usuarios → Editar.

Reglas:

1. El DNI no se repite (409 `DNI_DUPLICADO`). Si no cambia, no se controla: los duplicados que
   ya existían no se migran.
2. Si la persona tiene un usuario con rol CLIENTE, el mail es obligatorio (422
   `MAIL_OBLIGATORIO`) y es su usuario: al cambiar el mail cambia el usuario, en minúsculas (409
   `MAIL_EN_USO` si ya lo usa otra cuenta). Ver cuenta_cliente_service.
3. Sin domicilio, la persona queda sin domicilio. Con domicilio, se actualiza el que tenía o se
   crea uno.
"""

from __future__ import annotations

from datetime import date

from sqlmodel import Session, select

from app.core.errors import APIError
from app.models.auth.rol import Rol
from app.models.auth.usuario import Usuario
from app.models.core.domicilio import Domicilio
from app.models.core.persona import Persona
from app.schemas.usuarios import DomicilioCreate, DomicilioDetalle
from app.services.cuenta_cliente_service import (
    es_rol_cliente,
    normalizar_mail,
    validar_dni_disponible,
    validar_mail_disponible,
)


def usuario_de_persona(session: Session, persona_id: int) -> Usuario | None:
    return session.exec(select(Usuario).where(Usuario.persona_id == persona_id)).first()


def es_usuario_cliente(session: Session, usuario: Usuario) -> bool:
    rol = session.get(Rol, usuario.rol_id)
    return rol is not None and es_rol_cliente(rol)


def domicilio_detalle(session: Session, domicilio_id: int | None) -> DomicilioDetalle | None:
    if domicilio_id is None:
        return None
    domicilio = session.get(Domicilio, domicilio_id)
    if domicilio is None:
        return None
    return DomicilioDetalle(
        pais=domicilio.pais,
        provincia=domicilio.provincia,
        ciudad=domicilio.ciudad,
        calle=domicilio.calle,
        altura=domicilio.altura,
        cp=domicilio.cp,
        departamento=domicilio.departamento,
        notas=domicilio.notas,
    )


def _guardar_domicilio(
    session: Session, persona: Persona, domicilio: DomicilioCreate | None
) -> None:
    if domicilio is None:
        persona.domicilio_id = None
        return
    fila = session.get(Domicilio, persona.domicilio_id) if persona.domicilio_id else None
    if fila is None:
        fila = Domicilio(
            pais=domicilio.pais,
            provincia=domicilio.provincia,
            ciudad=domicilio.ciudad,
            cp=domicilio.cp,
            calle=domicilio.calle,
            altura=domicilio.altura,
        )
    fila.pais = domicilio.pais
    fila.provincia = domicilio.provincia
    fila.ciudad = domicilio.ciudad
    fila.cp = domicilio.cp
    fila.calle = domicilio.calle
    fila.altura = domicilio.altura
    fila.departamento = domicilio.departamento
    fila.notas = domicilio.notas
    session.add(fila)
    session.flush()
    persona.domicilio_id = fila.id


def actualizar_persona(
    session: Session,
    persona: Persona,
    *,
    nombre: str,
    apellido: str,
    celular: str,
    mail: str | None,
    dni: str | None,
    sexo: str | None,
    fecha_nacimiento: date | None,
    domicilio: DomicilioCreate | None,
) -> None:
    """Actualiza la persona (y el usuario si el mail es su usuario). No hace commit."""
    if dni != persona.dni:
        validar_dni_disponible(session, dni, excluir_persona_id=persona.id)

    usuario = usuario_de_persona(session, persona.id or 0)
    if usuario is not None and es_usuario_cliente(session, usuario):
        if not mail:
            raise APIError(
                422,
                "MAIL_OBLIGATORIO",
                "El mail es obligatorio para un cliente: es su usuario para ingresar",
            )
        mail = normalizar_mail(mail)
        if mail != usuario.username:
            validar_mail_disponible(session, mail, excluir_usuario_id=usuario.id)
            usuario.username = mail
            session.add(usuario)

    persona.nombre = nombre.strip()
    persona.apellido = apellido.strip()
    persona.dni = dni
    persona.sexo = sexo
    persona.fecha_nacimiento = fecha_nacimiento
    persona.celular = celular
    persona.mail = mail
    _guardar_domicilio(session, persona, domicilio)
    session.add(persona)
    session.flush()
