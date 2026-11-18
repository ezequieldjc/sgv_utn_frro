"""Cuentas de cliente: el cliente y su usuario CLIENTE se crean siempre juntos.

Reglas (detalle en docs/prompts botones/cuentas_cliente.md):

1. Un cliente (`core.persona.es_cliente = true`) siempre tiene un usuario con rol CLIENTE, y un
   usuario con rol CLIENTE siempre es un cliente. Los tres caminos de alta pasan por
   `crear_cuenta_cliente`: Clientes → Nuevo cliente, Admin → Usuarios con rol CLIENTE y el
   registro desde el login. Única excepción: la persona del tutor eventual, que no tiene usuario.
2. El usuario del cliente es su mail, guardado en minúsculas. Por eso el mail es obligatorio para
   los clientes. En la base `persona.mail` sigue aceptando vacío: la regla es de la app. Los
   empleados siguen entrando con su usuario de siempre.
3. No se repite el DNI de una persona ni el mail de un usuario: 409.
"""

from __future__ import annotations

from dataclasses import dataclass
from datetime import date

from sqlalchemy import func
from sqlmodel import Session, select

from app.core.errors import APIError
from app.core.security import generate_temp_password, hash_password
from app.models.auth.historial_contrasena import HistorialContrasena
from app.models.auth.rol import Rol
from app.models.auth.usuario import Usuario
from app.models.core.domicilio import Domicilio
from app.models.core.persona import Persona
from app.schemas.usuarios import DomicilioCreate

ROL_CLIENTE_NOMBRE = "CLIENTE"


@dataclass(slots=True)
class CuentaClienteCreada:
    persona: Persona
    usuario: Usuario
    # Solo en el alta interna (recepción o admin): la clave que se le pasa al cliente.
    password_temporal: str | None


def normalizar_mail(mail: str) -> str:
    return mail.strip().lower()


def obtener_rol_cliente(session: Session) -> Rol:
    rol = session.exec(select(Rol).where(Rol.nombre == ROL_CLIENTE_NOMBRE)).first()
    if rol is None:
        raise APIError(404, "ROL_NO_ENCONTRADO", "No se encontró el rol CLIENTE")
    return rol


def es_rol_cliente(rol: Rol) -> bool:
    """Dice si el rol *objetivo* de un alta es CLIENTE, para saber qué se crea.

    No autoriza a nadie: el permiso del que da el alta se valida aparte (Permission-First).
    """
    return rol.nombre.strip().upper() == ROL_CLIENTE_NOMBRE


def validar_dni_disponible(session: Session, dni: str | None) -> None:
    if not dni:
        return
    if session.exec(select(Persona.id).where(Persona.dni == dni)).first() is not None:
        raise APIError(409, "DNI_DUPLICADO", "Ya existe una persona con ese DNI")


def validar_mail_disponible(session: Session, mail: str) -> None:
    existente = session.exec(
        select(Usuario.id).where(func.lower(Usuario.username) == normalizar_mail(mail))
    ).first()
    if existente is not None:
        raise APIError(409, "MAIL_EN_USO", "Ya existe una cuenta con ese mail")


def crear_cuenta_cliente(
    session: Session,
    *,
    nombre: str,
    apellido: str,
    celular: str,
    mail: str,
    dni: str | None = None,
    sexo: str | None = None,
    fecha_nacimiento: date | None = None,
    domicilio: DomicilioCreate | None = None,
    habilitado: bool = True,
    password: str | None = None,
) -> CuentaClienteCreada:
    """Crea la persona (cliente), su domicilio si viene y su usuario CLIENTE. No hace commit.

    Sin `password` (alta interna) se genera una contraseña temporal con `debe_cambiar = true`.
    Con `password` (registro) la eligió el cliente y no tiene que cambiarla.
    """
    mail_normalizado = normalizar_mail(mail)
    validar_dni_disponible(session, dni)
    validar_mail_disponible(session, mail_normalizado)
    rol = obtener_rol_cliente(session)

    domicilio_id: int | None = None
    if domicilio is not None:
        fila_domicilio = Domicilio(
            pais=domicilio.pais,
            provincia=domicilio.provincia,
            ciudad=domicilio.ciudad,
            cp=domicilio.cp,
            calle=domicilio.calle,
            altura=domicilio.altura,
            departamento=domicilio.departamento,
            notas=domicilio.notas,
        )
        session.add(fila_domicilio)
        session.flush()
        domicilio_id = fila_domicilio.id

    persona = Persona(
        nombre=nombre.strip(),
        apellido=apellido.strip(),
        dni=dni,
        sexo=sexo,
        fecha_nacimiento=fecha_nacimiento,
        domicilio_id=domicilio_id,
        mail=mail_normalizado,
        celular=celular,
        es_cliente=True,
    )
    session.add(persona)
    session.flush()

    usuario = Usuario(
        persona_id=persona.id or 0,
        username=mail_normalizado,
        habilitado=habilitado,
        rol_id=rol.id or 0,
        version_token=1,
    )
    session.add(usuario)
    session.flush()

    password_temporal = None if password is not None else generate_temp_password()
    session.add(
        HistorialContrasena(
            usuario_id=usuario.id or 0,
            hashed_password=hash_password(password if password is not None else password_temporal),
            debe_cambiar=password is None,
        )
    )
    session.flush()

    return CuentaClienteCreada(
        persona=persona, usuario=usuario, password_temporal=password_temporal
    )
