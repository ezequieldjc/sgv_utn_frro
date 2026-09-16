from __future__ import annotations

from app.models.catalogo.habitat import Habitat
from app.models.catalogo.mascota_estado import MascotaEstado
from app.models.clinica.especie import Especie
from app.models.sys.config import Config
from test_usuarios import seed_usuario_con_permiso


def _seed_jwt_config(session) -> None:
    session.add_all(
        [
            Config(
                config_id=1,
                config_nombre="JWT",
                parametro_id=1,
                parametro_nombre="ACCESS_TOKEN_EXPIRACION",
                parametro_valor="15",
            ),
            Config(
                config_id=1,
                config_nombre="JWT",
                parametro_id=2,
                parametro_nombre="REFRESH_TOKEN_EXPIRACION",
                parametro_valor="1440",
            ),
            Config(
                config_id=2,
                config_nombre="BRANDING",
                parametro_id=1,
                parametro_nombre="RAZON_SOCIAL",
                parametro_valor="Yacanvet",
            ),
        ]
    )


def _login(client, username: str, password: str) -> None:
    response = client.post(
        "/api/auth/login",
        json={"username": username, "password": password},
    )
    assert response.status_code == 200


def test_list_habitats_sin_auth_devuelve_401(client, session) -> None:
    _seed_jwt_config(session)
    session.commit()
    response = client.get("/api/catalogos/habitats")
    assert response.status_code == 401


def test_list_habitats_sin_permiso_devuelve_403(client, session) -> None:
    _seed_jwt_config(session)
    seed_usuario_con_permiso(
        session,
        username="sinperm",
        password="Secret1!",
        nombre="Sin",
        apellido="Permiso",
        dni="111",
        permiso_nombre="usuarios:ver",
    )
    _login(client, "sinperm", "Secret1!")
    response = client.get("/api/catalogos/habitats")
    assert response.status_code == 403


def test_habitat_crud_y_baja_logica(client, session) -> None:
    _seed_jwt_config(session)
    seed_usuario_con_permiso(
        session,
        username="catadmin",
        password="Secret1!",
        nombre="Cat",
        apellido="Admin",
        dni="222",
        permiso_nombre="*",
    )
    especie = Especie(nombre="Canino", descripcion=None, activo=True)
    session.add(especie)
    session.commit()
    session.refresh(especie)

    _login(client, "catadmin", "Secret1!")

    create = client.post(
        "/api/catalogos/habitats",
        json={"nombre": "Interior", "descripcion": "Casa", "especie_id": especie.id},
    )
    assert create.status_code == 201
    body = create.json()
    assert body["nombre"] == "Interior"
    assert body["especie_nombre"] == "Canino"
    assert body["activo"] is True
    item_id = body["id"]

    listed = client.get("/api/catalogos/habitats?activo=true")
    assert listed.status_code == 200
    assert any(row["id"] == item_id for row in listed.json())

    baja = client.patch(f"/api/catalogos/habitats/{item_id}/activo", json={"activo": False})
    assert baja.status_code == 200
    assert baja.json()["activo"] is False

    activos = client.get("/api/catalogos/habitats?activo=true")
    assert all(row["id"] != item_id for row in activos.json())

    inactivos = client.get("/api/catalogos/habitats?activo=false")
    assert any(row["id"] == item_id for row in inactivos.json())

    reactivar = client.patch(
        f"/api/catalogos/habitats/{item_id}/activo", json={"activo": True}
    )
    assert reactivar.status_code == 200
    assert reactivar.json()["activo"] is True


def test_mascota_estado_global_crud(client, session) -> None:
    _seed_jwt_config(session)
    seed_usuario_con_permiso(
        session,
        username="catadmin2",
        password="Secret1!",
        nombre="Cat",
        apellido="Admin2",
        dni="333",
        permiso_nombre="*",
    )
    _login(client, "catadmin2", "Secret1!")

    create = client.post(
        "/api/catalogos/mascota-estados",
        json={"nombre": "Viva", "descripcion": None},
    )
    assert create.status_code == 201
    body = create.json()
    assert body["nombre"] == "Viva"
    assert body["especie_id"] is None
    assert "especie_nombre" in body

    listed = client.get("/api/catalogos/mascota-estados")
    assert listed.status_code == 200
    assert any(row["nombre"] == "Viva" for row in listed.json())


def test_especies_opciones_incluye_inactivas(client, session) -> None:
    _seed_jwt_config(session)
    seed_usuario_con_permiso(
        session,
        username="catadmin3",
        password="Secret1!",
        nombre="Cat",
        apellido="Admin3",
        dni="444",
        permiso_nombre="catalogos:ver",
    )
    session.add_all(
        [
            Especie(nombre="Canino", activo=True),
            Especie(nombre="Felino", activo=False),
        ]
    )
    session.commit()
    _login(client, "catadmin3", "Secret1!")

    response = client.get("/api/catalogos/especies-opciones")
    assert response.status_code == 200
    payload = response.json()
    nombres = {row["nombre"] for row in payload}
    assert nombres == {"Canino", "Felino"}
    ids = [row["id"] for row in payload]
    assert ids == sorted(ids)
