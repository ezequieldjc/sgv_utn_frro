from __future__ import annotations

from datetime import date

from sqlmodel import Session, select

from app.core.errors import APIError
from app.core.security import hash_password
from app.models.auth.historial_contrasena import HistorialContrasena
from app.models.auth.rol import Rol
from app.models.auth.usuario import Usuario
from app.models.core.domicilio import Domicilio
from app.models.core.persona import Persona
from app.schemas.clientes import ClienteCreate, ClienteCreateResponse, ClienteListItem
from app.services.usuario_service import allocate_username, generate_temp_password

ROL_CLIENTE_NOMBRE = "CLIENTE"


def calcular_edad_truncada(fecha_nacimiento: date, hoy: date | None = None) -> int:
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
    existing_dni = session.exec(select(Persona).where(Persona.dni == payload.dni)).first()
    if existing_dni is not None:
        raise APIError(409, "DNI_DUPLICADO", "Ya existe una persona con ese DNI")

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
        es_cliente=True,
    )
    session.add(persona)
    session.flush()

    username: str | None = None
    password_temporal: str | None = None

    if payload.crear_usuario:
        rol = session.exec(select(Rol).where(Rol.nombre == ROL_CLIENTE_NOMBRE)).first()
        if rol is None:
            raise APIError(404, "ROL_NO_ENCONTRADO", "No se encontró el rol CLIENTE")

        username = allocate_username(session, payload.nombre, payload.apellido)
        password_temporal = generate_temp_password()

        usuario = Usuario(
            persona_id=persona.id or 0,
            username=username,
            habilitado=payload.habilitado,
            rol_id=rol.id or 0,
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
    session.refresh(persona)

    return ClienteCreateResponse(
        id=persona.id or 0,
        nombre=persona.nombre,
        apellido=persona.apellido,
        dni=persona.dni,
        usuario_creado=payload.crear_usuario,
        username=username,
        password_temporal=password_temporal,
    )
