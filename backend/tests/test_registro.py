from __future__ import annotations

from sqlmodel import select

from app.core.security import verify_password
from app.models.auth.historial_contrasena import HistorialContrasena
from app.models.auth.rol import Rol
from app.models.auth.usuario import Usuario
from app.models.core.persona import Persona
from test_auth import seed_auth_data


def _seed(session) -> None:
    """Empleado jperez (DNI 30111222) con la config de JWT, más el rol CLIENTE."""
    seed_auth_data(session)
    session.add(Rol(nombre="CLIENTE", descripcion="Cliente de la clínica"))
    session.commit()


def _registro_payload(**cambios) -> dict:
    payload = {
        "nombre": "Lucía",
        "apellido": "Fernández",
        "dni": "40111222",
        "celular": "341 555-6677",
        "mail": "Lucia.Fernandez@Example.com",
        "fecha_nacimiento": "1995-04-02",
        "sexo": "F",
        "password": "MiClave123",
        "password_repetida": "MiClave123",
    }
    payload.update(cambios)
    return payload


def test_registro_crea_persona_cliente_y_usuario_cliente_juntos(client, session) -> None:
    _seed(session)

    response = client.post("/api/auth/registro", json=_registro_payload())

    assert response.status_code == 201
    assert response.json()["username"] == "lucia.fernandez@example.com"
    # No inicia sesión solo.
    assert "access_token" not in response.cookies

    usuario = session.exec(
        select(Usuario).where(Usuario.username == "lucia.fernandez@example.com")
    ).one()
    assert usuario.habilitado is True
    rol = session.get(Rol, usuario.rol_id)
    assert rol is not None and rol.nombre == "CLIENTE"

    persona = session.get(Persona, usuario.persona_id)
    assert persona is not None
    assert persona.es_cliente is True
    assert persona.dni == "40111222"
    assert persona.mail == "lucia.fernandez@example.com"
    assert persona.celular == "3415556677"
    assert persona.domicilio_id is None

    historial = session.exec(
        select(HistorialContrasena).where(HistorialContrasena.usuario_id == usuario.id)
    ).one()
    assert historial.debe_cambiar is False
    assert verify_password("MiClave123", historial.hashed_password)


def test_registro_datos_opcionales_vacios_crea_la_cuenta(client, session) -> None:
    _seed(session)
    payload = _registro_payload()
    del payload["fecha_nacimiento"]
    del payload["sexo"]

    response = client.post("/api/auth/registro", json=payload)

    assert response.status_code == 201
    persona = session.exec(select(Persona).where(Persona.dni == "40111222")).one()
    assert persona.fecha_nacimiento is None
    assert persona.sexo is None


def test_registro_despues_ingresa_con_el_mail_en_mayusculas(client, session) -> None:
    _seed(session)
    assert client.post("/api/auth/registro", json=_registro_payload()).status_code == 201

    response = client.post(
        "/api/auth/login",
        json={"username": "LUCIA.FERNANDEZ@EXAMPLE.COM", "password": "MiClave123"},
    )

    assert response.status_code == 200
    assert response.json()["usuario"]["username"] == "lucia.fernandez@example.com"


def test_registro_mail_repetido_devuelve_409_y_no_crea_nada(client, session) -> None:
    _seed(session)
    assert client.post("/api/auth/registro", json=_registro_payload()).status_code == 201

    response = client.post(
        "/api/auth/registro",
        json=_registro_payload(dni="40999888", mail="lucia.fernandez@EXAMPLE.com"),
    )

    assert response.status_code == 409
    assert response.json()["error"] == "CUENTA_EXISTENTE"
    assert session.exec(select(Persona).where(Persona.dni == "40999888")).first() is None


def test_registro_dni_repetido_devuelve_409_y_no_crea_nada(client, session) -> None:
    _seed(session)

    # 30111222 es el DNI del empleado jperez: no se permite DNI repetido en ningún alta.
    response = client.post(
        "/api/auth/registro", json=_registro_payload(dni="30111222", mail="otra@example.com")
    )

    assert response.status_code == 409
    body = response.json()
    assert body["error"] == "CUENTA_EXISTENTE"
    assert "comunicate con la clínica" in body["detalle"]
    assert session.exec(select(Usuario).where(Usuario.username == "otra@example.com")).first() is None


def test_registro_contrasenas_distintas_devuelve_422(client, session) -> None:
    _seed(session)

    response = client.post(
        "/api/auth/registro", json=_registro_payload(password_repetida="OtraClave123")
    )

    assert response.status_code == 422
    assert session.exec(select(Persona).where(Persona.dni == "40111222")).first() is None


def test_registro_contrasena_corta_devuelve_422(client, session) -> None:
    _seed(session)

    response = client.post(
        "/api/auth/registro", json=_registro_payload(password="corta", password_repetida="corta")
    )

    assert response.status_code == 422


def test_registro_sin_mail_o_con_mail_invalido_devuelve_422(client, session) -> None:
    _seed(session)
    sin_mail = _registro_payload()
    del sin_mail["mail"]

    assert client.post("/api/auth/registro", json=sin_mail).status_code == 422
    assert client.post("/api/auth/registro", json=_registro_payload(mail="no-es-mail")).status_code == 422


def test_registro_sin_dni_devuelve_422(client, session) -> None:
    _seed(session)
    payload = _registro_payload()
    del payload["dni"]

    assert client.post("/api/auth/registro", json=payload).status_code == 422


def test_login_empleado_sigue_entrando_con_su_usuario(client, session) -> None:
    _seed(session)

    response = client.post("/api/auth/login", json={"username": " jperez ", "password": "Secret123!"})

    assert response.status_code == 200
    assert response.json()["usuario"]["username"] == "jperez"


def test_login_acepta_un_usuario_de_hasta_100_caracteres(client, session) -> None:
    _seed(session)
    largo = "a" * 88 + "@example.com"

    response = client.post("/api/auth/login", json={"username": largo, "password": "x"})

    assert len(largo) == 100
    assert response.status_code == 401
