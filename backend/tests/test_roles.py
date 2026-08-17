from __future__ import annotations

from test_usuarios import _seed_jwt_config, seed_usuario_con_permiso


def test_list_roles_sin_auth_devuelve_401(client, session) -> None:
    _seed_jwt_config(session)
    session.commit()

    response = client.get("/api/roles")
    assert response.status_code == 401
    assert response.json()["error"] == "TOKEN_INVALIDO"


def test_list_roles_sin_permiso_crear_ni_ver_devuelve_403(client, session) -> None:
    _seed_jwt_config(session)
    seed_usuario_con_permiso(
        session,
        username="jperez",
        password="Secret123!",
        nombre="Juan",
        apellido="Pérez",
        dni="30111222",
        permiso_nombre="pacientes:read",
    )

    login_response = client.post(
        "/api/auth/login",
        json={"username": "jperez", "password": "Secret123!"},
    )
    assert login_response.status_code == 200

    response = client.get("/api/roles")
    assert response.status_code == 403
    assert response.json()["error"] == "PERMISOS_INSUFICIENTES"


def test_list_roles_con_permiso_usuarios_ver_devuelve_200(client, session) -> None:
    _seed_jwt_config(session)
    seed_usuario_con_permiso(
        session,
        username="viewer",
        password="Secret123!",
        nombre="Vista",
        apellido="Solo",
        dni="30111222",
        permiso_nombre="usuarios:ver",
    )

    login_response = client.post(
        "/api/auth/login",
        json={"username": "viewer", "password": "Secret123!"},
    )
    assert login_response.status_code == 200

    response = client.get("/api/roles")
    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload, list)
    assert len(payload) >= 1
    assert "id" in payload[0]
    assert "nombre" in payload[0]


def test_list_roles_con_permiso_usuarios_crear_devuelve_200(client, session) -> None:
    _seed_jwt_config(session)
    seed_usuario_con_permiso(
        session,
        username="admin",
        password="Secret123!",
        nombre="María",
        apellido="Gómez",
        dni="20111222",
        permiso_nombre="usuarios:crear",
    )

    login_response = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "Secret123!"},
    )
    assert login_response.status_code == 200

    response = client.get("/api/roles")
    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload, list)
    assert len(payload) >= 1
    assert "id" in payload[0]
    assert "nombre" in payload[0]
