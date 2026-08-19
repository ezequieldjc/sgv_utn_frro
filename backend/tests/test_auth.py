from __future__ import annotations

from datetime import date

from sqlmodel import select

from app.core.security import hash_password
from app.models.auth.historial_contrasena import HistorialContrasena
from app.models.auth.login import Login
from app.models.auth.permiso import Permiso
from app.models.auth.rol import Rol
from app.models.auth.rol_permiso import RolPermiso
from app.models.auth.usuario import Usuario
from app.models.core.persona import Persona
from app.models.sys.config import Config


def seed_auth_data(
    session,
    *,
    enabled: bool = True,
    version_token: int = 1,
    debe_cambiar: bool = False,
    password: str = "Secret123!",
) -> Usuario:
    persona = Persona(
        nombre="Juan",
        apellido="Pérez",
        dni="30111222",
        sexo="M",
        fecha_nacimiento=date(1990, 1, 15),
        celular="123456789",
        mail="juan@example.com",
    )
    rol = Rol(nombre="ADMIN", descripcion="Administrador")
    permiso = Permiso(nombre="pacientes:read", descripcion="Lectura de pacientes")
    usuario = Usuario(
        persona=persona,
        username="jperez",
        habilitado=enabled,
        rol=rol,
        version_token=version_token,
    )
    historial = HistorialContrasena(
        usuario=usuario,
        hashed_password=hash_password(password),
        debe_cambiar=debe_cambiar,
    )
    config_access = Config(
        config_id=1,
        config_nombre="JWT",
        parametro_id=1,
        parametro_nombre="ACCESS_TOKEN_EXPIRACION",
        parametro_valor="15",
    )
    config_refresh = Config(
        config_id=1,
        config_nombre="JWT",
        parametro_id=2,
        parametro_nombre="REFRESH_TOKEN_EXPIRACION",
        parametro_valor="1440",
    )
    config_branding = Config(
        config_id=2,
        config_nombre="BRANDING",
        parametro_id=1,
        parametro_nombre="RAZON_SOCIAL",
        parametro_valor="Yacanvet",
    )

    session.add_all([persona, rol, permiso, usuario, historial, config_access, config_refresh, config_branding])
    session.commit()
    session.add(RolPermiso(rol_id=rol.id or 0, permiso_id=permiso.id or 0))
    session.commit()
    session.refresh(usuario)
    return usuario


def test_login_credenciales_validas_devuelve_200_setea_cookies_y_registra_auditoria(client, session) -> None:
    user = seed_auth_data(session)

    response = client.post(
        "/api/auth/login",
        json={"username": "jperez", "password": "Secret123!"},
        headers={"X-Forwarded-For": "203.0.113.10, 10.0.0.1"},
    )

    assert response.status_code == 200
    assert response.json() == {
        "usuario": {"id": user.id, "username": "jperez", "nombre": "Juan", "apellido": "Pérez"},
        "permisos": ["pacientes:read"],
    }
    assert client.cookies.get("access_token")
    assert client.cookies.get("refresh_token")

    me_response = client.get("/api/auth/me")
    assert me_response.status_code == 200
    assert me_response.json() == response.json()

    attempts = session.exec(select(Login)).all()
    assert len(attempts) == 1
    assert attempts[0].exito is True
    assert attempts[0].razon_fallo is None
    assert attempts[0].ip == "203.0.113.10"


def test_login_clave_incorrecta_devuelve_401_y_registra_auditoria(client, session) -> None:
    seed_auth_data(session)

    response = client.post(
        "/api/auth/login",
        json={"username": "jperez", "password": "bad-password"},
    )

    assert response.status_code == 401
    assert response.json()["error"] == "CREDENCIALES_INVALIDAS"

    attempts = session.exec(select(Login)).all()
    assert len(attempts) == 1
    assert attempts[0].exito is False
    assert attempts[0].razon_fallo == "CLAVE_INCORRECTA"


def test_login_usuario_deshabilitado_devuelve_403_y_registra_auditoria(client, session) -> None:
    seed_auth_data(session, enabled=False)

    response = client.post(
        "/api/auth/login",
        json={"username": "jperez", "password": "Secret123!"},
    )

    assert response.status_code == 403
    assert response.json()["error"] == "USUARIO_DESHABILITADO"

    attempts = session.exec(select(Login)).all()
    assert len(attempts) == 1
    assert attempts[0].exito is False
    assert attempts[0].razon_fallo == "USUARIO_DESHABILITADO"


def test_me_version_token_desactualizado_devuelve_401(client, session) -> None:
    user = seed_auth_data(session)

    login_response = client.post(
        "/api/auth/login",
        json={"username": "jperez", "password": "Secret123!"},
    )
    assert login_response.status_code == 200

    user.version_token += 1
    session.add(user)
    session.commit()

    me_response = client.get("/api/auth/me")
    assert me_response.status_code == 401
    assert me_response.json()["error"] == "TOKEN_INVALIDO"


def test_login_usuario_inexistente_devuelve_401_y_registra_auditoria(client, session) -> None:
    response = client.post(
        "/api/auth/login",
        json={"username": "noexiste", "password": "Secret123!"},
    )

    assert response.status_code == 401
    assert response.json()["error"] == "CREDENCIALES_INVALIDAS"

    attempts = session.exec(select(Login)).all()
    assert len(attempts) == 1
    assert attempts[0].exito is False
    assert attempts[0].razon_fallo == "USUARIO_INEXISTENTE"
    assert attempts[0].username_ingresado == "noexiste"


def test_login_sin_historial_contrasena_devuelve_401(client, session) -> None:
    persona = Persona(
        nombre="Ana",
        apellido="SinClave",
        dni="40111222",
        sexo="F",
        fecha_nacimiento=date(1991, 3, 20),
        celular="123456789",
        mail="ana@example.com",
    )
    rol = Rol(nombre="ADMIN", descripcion="Administrador")
    usuario = Usuario(
        persona=persona,
        username="asinclave",
        habilitado=True,
        rol=rol,
        version_token=1,
    )
    session.add_all([persona, rol, usuario])
    session.commit()

    response = client.post(
        "/api/auth/login",
        json={"username": "asinclave", "password": "Secret123!"},
    )

    assert response.status_code == 401
    assert response.json()["error"] == "CREDENCIALES_INVALIDAS"

    attempts = session.exec(select(Login)).all()
    assert len(attempts) == 1
    assert attempts[0].exito is False
    assert attempts[0].razon_fallo == "SIN_HISTORIAL_CONTRASENA"


def test_me_sin_cookie_devuelve_401(client, session) -> None:
    seed_auth_data(session)

    response = client.get("/api/auth/me")
    assert response.status_code == 401
    assert response.json()["error"] == "TOKEN_INVALIDO"


def test_logout_elimina_cookies_devuelve_204(client, session) -> None:
    seed_auth_data(session)

    login_response = client.post(
        "/api/auth/login",
        json={"username": "jperez", "password": "Secret123!"},
    )
    assert login_response.status_code == 200
    assert client.cookies.get("access_token")
    assert client.cookies.get("refresh_token")

    logout_response = client.post("/api/auth/logout")
    assert logout_response.status_code == 204
    assert client.cookies.get("access_token") in (None, "")
    assert client.cookies.get("refresh_token") in (None, "")


def test_login_debe_cambiar_contrasena_devuelve_403_sin_cookies_y_registra_auditoria(
    client, session
) -> None:
    seed_auth_data(session, debe_cambiar=True)

    response = client.post(
        "/api/auth/login",
        json={"username": "jperez", "password": "Secret123!"},
    )

    assert response.status_code == 403
    assert response.json()["error"] == "DEBE_CAMBIAR_CONTRASENA"
    assert response.json()["detalle"] == "Debe actualizar su contraseña para continuar."
    assert client.cookies.get("access_token") in (None, "")
    assert client.cookies.get("refresh_token") in (None, "")

    attempts = session.exec(select(Login)).all()
    assert len(attempts) == 1
    assert attempts[0].exito is False
    assert attempts[0].razon_fallo == "DEBE_CAMBIAR_CONTRASENA"


def test_cambiar_contrasena_obligatorio_password_actual_incorrecta_devuelve_401(
    client, session
) -> None:
    seed_auth_data(session, debe_cambiar=True)

    response = client.post(
        "/api/auth/cambiar-contrasena-obligatorio",
        json={
            "username": "jperez",
            "password_actual": "bad-password",
            "password_nueva": "NuevaClave1",
        },
    )

    assert response.status_code == 401
    assert response.json()["error"] == "CREDENCIALES_INVALIDAS"


def test_cambiar_contrasena_obligatorio_sin_debe_cambiar_devuelve_400(client, session) -> None:
    seed_auth_data(session, debe_cambiar=False)

    response = client.post(
        "/api/auth/cambiar-contrasena-obligatorio",
        json={
            "username": "jperez",
            "password_actual": "Secret123!",
            "password_nueva": "NuevaClave1",
        },
    )

    assert response.status_code == 400
    assert response.json()["error"] == "CAMBIO_NO_REQUERIDO"


def test_cambiar_contrasena_obligatorio_exitoso_inserta_historial_y_permite_login(
    client, session
) -> None:
    from app.core.security import verify_password

    user = seed_auth_data(session, debe_cambiar=True)
    assert user.version_token == 1
    historial_original_id = session.exec(
        select(HistorialContrasena).where(HistorialContrasena.usuario_id == user.id)
    ).first()
    assert historial_original_id is not None
    original_id = historial_original_id.id

    response = client.post(
        "/api/auth/cambiar-contrasena-obligatorio",
        json={
            "username": "jperez",
            "password_actual": "Secret123!",
            "password_nueva": "NuevaClave1",
        },
    )
    assert response.status_code == 200
    assert "mensaje" in response.json()

    session.refresh(user)
    assert user.version_token == 2

    historiales = session.exec(
        select(HistorialContrasena)
        .where(HistorialContrasena.usuario_id == user.id)
        .order_by(HistorialContrasena.id.desc())
    ).all()
    assert len(historiales) == 2
    latest = historiales[0]
    assert latest.debe_cambiar is False
    assert verify_password("NuevaClave1", latest.hashed_password)
    assert historiales[1].id == original_id
    assert historiales[1].debe_cambiar is True

    login_old = client.post(
        "/api/auth/login",
        json={"username": "jperez", "password": "Secret123!"},
    )
    assert login_old.status_code == 401

    login_new = client.post(
        "/api/auth/login",
        json={"username": "jperez", "password": "NuevaClave1"},
    )
    assert login_new.status_code == 200
    assert client.cookies.get("access_token")
