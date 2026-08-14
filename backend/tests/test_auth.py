from __future__ import annotations

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


def seed_auth_data(session, *, enabled: bool = True, version_token: int = 1) -> Usuario:
    persona = Persona(
        nombre="Juan",
        apellido="Pérez",
        dni="30111222",
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
        hashed_password=hash_password("Secret123!"),
        debe_cambiar=False,
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


def test_login_success(client, session) -> None:
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


def test_login_failed_registers_audit(client, session) -> None:
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


def test_login_blocks_disabled_user(client, session) -> None:
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


def test_me_blocks_revoked_token(client, session) -> None:
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
