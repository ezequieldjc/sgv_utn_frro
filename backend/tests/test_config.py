from __future__ import annotations

from sqlmodel import select

from app.models.sys.config import Config
from app.services.config_service import clear_config_cache, get_config_value
from test_usuarios import _seed_jwt_config, seed_usuario_con_permiso


def _login(client, username: str, password: str = "Secret123!") -> None:
    response = client.post("/api/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200


def _seed_branding(session, *, razon_social: str = "Clinica Test") -> Config:
    existing = session.exec(
        select(Config).where(
            Config.config_id == 2,
            Config.parametro_id == 1,
        )
    ).first()
    if existing is not None:
        existing.parametro_valor = razon_social
        existing.config_nombre = "BRANDING"
        existing.parametro_nombre = "RAZON_SOCIAL"
        session.add(existing)
        session.commit()
        session.refresh(existing)
        clear_config_cache()
        return existing

    row = Config(
        config_id=2,
        config_nombre="BRANDING",
        parametro_id=1,
        parametro_nombre="RAZON_SOCIAL",
        parametro_valor=razon_social,
    )
    session.add(row)
    session.commit()
    session.refresh(row)
    clear_config_cache()
    return row


def test_get_public_config_devuelve_razon_social(client, session) -> None:
    _seed_branding(session, razon_social="Clinica Test")

    response = client.get("/api/config/public")
    assert response.status_code == 200
    assert response.json()["razon_social"] == "Clinica Test"


def test_get_config_sin_auth_devuelve_401(client, session) -> None:
    _seed_jwt_config(session)
    session.commit()
    clear_config_cache()

    response = client.get("/api/config")
    assert response.status_code == 401
    assert response.json()["error"] == "TOKEN_INVALIDO"


def test_get_config_sin_parametros_ver_devuelve_403(client, session) -> None:
    _seed_jwt_config(session)
    seed_usuario_con_permiso(
        session,
        username="viewer",
        password="Secret123!",
        nombre="Vista",
        apellido="Solo",
        dni="30111222",
        permiso_nombre="usuarios:ver",
        rol_nombre="EDITOR",
    )

    _login(client, "viewer")

    response = client.get("/api/config")
    assert response.status_code == 403
    assert response.json()["error"] == "PERMISOS_INSUFICIENTES"


def test_get_config_con_parametros_ver_devuelve_200_lista_completa(client, session) -> None:
    _seed_jwt_config(session)
    branding = _seed_branding(session)
    seed_usuario_con_permiso(
        session,
        username="paramviewer",
        password="Secret123!",
        nombre="Params",
        apellido="Viewer",
        dni="30111999",
        permiso_nombre="parametros:ver",
        rol_nombre="EDITOR",
    )

    _login(client, "paramviewer")

    response = client.get("/api/config")
    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload, list)
    assert len(payload) >= 3
    nombres = {item["parametro_nombre"] for item in payload}
    assert "ACCESS_TOKEN_EXPIRACION" in nombres
    assert "RAZON_SOCIAL" in nombres
    assert any(item["id"] == branding.id for item in payload)


def test_patch_config_sin_parametros_editar_devuelve_403(client, session) -> None:
    _seed_jwt_config(session)
    branding = _seed_branding(session)
    seed_usuario_con_permiso(
        session,
        username="paramviewer",
        password="Secret123!",
        nombre="Params",
        apellido="Viewer",
        dni="30111999",
        permiso_nombre="parametros:ver",
        rol_nombre="EDITOR",
    )

    _login(client, "paramviewer")

    response = client.patch(
        f"/api/config/{branding.id}",
        json={"parametro_valor": "Nueva Clinica"},
    )
    assert response.status_code == 403
    assert response.json()["error"] == "PERMISOS_INSUFICIENTES"


def test_patch_config_valor_vacio_devuelve_400(client, session) -> None:
    _seed_jwt_config(session)
    branding = _seed_branding(session)
    seed_usuario_con_permiso(
        session,
        username="parameditor",
        password="Secret123!",
        nombre="Params",
        apellido="Editor",
        dni="30111888",
        permiso_nombre="parametros:editar",
        rol_nombre="EDITOR",
    )

    _login(client, "parameditor")

    response = client.patch(
        f"/api/config/{branding.id}",
        json={"parametro_valor": "   "},
    )
    assert response.status_code == 400
    assert response.json()["error"] == "VALOR_INVALIDO"


def test_patch_access_token_no_numerico_devuelve_400(client, session) -> None:
    _seed_jwt_config(session)
    clear_config_cache()
    seed_usuario_con_permiso(
        session,
        username="parameditor",
        password="Secret123!",
        nombre="Params",
        apellido="Editor",
        dni="30111888",
        permiso_nombre="parametros:editar",
        rol_nombre="EDITOR",
    )
    access_row = session.exec(
        select(Config).where(Config.parametro_nombre == "ACCESS_TOKEN_EXPIRACION")
    ).one()

    _login(client, "parameditor")

    response = client.patch(
        f"/api/config/{access_row.id}",
        json={"parametro_valor": "abc"},
    )
    assert response.status_code == 400
    assert response.json()["error"] == "VALOR_INVALIDO"


def test_patch_access_token_valido_persiste_y_invalida_cache(client, session) -> None:
    _seed_jwt_config(session)
    clear_config_cache()
    seed_usuario_con_permiso(
        session,
        username="parameditor",
        password="Secret123!",
        nombre="Params",
        apellido="Editor",
        dni="30111888",
        permiso_nombre="parametros:editar",
        rol_nombre="EDITOR",
    )
    access_row = session.exec(
        select(Config).where(Config.parametro_nombre == "ACCESS_TOKEN_EXPIRACION")
    ).one()
    assert get_config_value(1, 1) == "15"

    _login(client, "parameditor")

    response = client.patch(
        f"/api/config/{access_row.id}",
        json={"parametro_valor": " 30 "},
    )
    assert response.status_code == 200
    body = response.json()
    assert body["parametro_valor"] == "30"
    assert get_config_value(1, 1) == "30"


def test_patch_razon_social_actualiza_public(client, session) -> None:
    _seed_jwt_config(session)
    branding = _seed_branding(session, razon_social="Vieja")
    seed_usuario_con_permiso(
        session,
        username="parameditor",
        password="Secret123!",
        nombre="Params",
        apellido="Editor",
        dni="30111888",
        permiso_nombre="parametros:editar",
        rol_nombre="EDITOR",
    )

    _login(client, "parameditor")

    response = client.patch(
        f"/api/config/{branding.id}",
        json={"parametro_valor": "Nueva Razon"},
    )
    assert response.status_code == 200
    assert response.json()["parametro_valor"] == "Nueva Razon"

    public = client.get("/api/config/public")
    assert public.status_code == 200
    assert public.json()["razon_social"] == "Nueva Razon"
