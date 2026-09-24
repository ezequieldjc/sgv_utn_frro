from __future__ import annotations

from datetime import date
from decimal import Decimal

from sqlmodel import select

from app.models.catalogo.mascota_estado import MascotaEstado
from app.models.catalogo.pelaje import Pelaje
from app.models.clinica.especie import Especie
from app.models.clinica.historial_peso import HistorialPeso
from app.models.clinica.mascota import Mascota
from app.models.clinica.raza import Raza
from app.models.core.persona import Persona
from app.models.sys.config import Config
from app.services.mascota_service import MASCOTA_ESTADO_ACTIVA_ID
from test_clientes import _seed_jwt_config, seed_cliente, seed_usuario_con_permiso


def _seed_mascota_catalogo(session) -> tuple[Especie, Raza, Raza]:
    estado = MascotaEstado(id=MASCOTA_ESTADO_ACTIVA_ID, nombre="ACTIVA", activo=True)
    especie = Especie(nombre="Canina", activo=True)
    session.add_all([estado, especie])
    session.flush()
    raza_default = Raza(
        especie_id=especie.id or 0,
        nombre="Sin raza definida",
        activo=True,
    )
    raza_otra = Raza(especie_id=especie.id or 0, nombre="Labrador", activo=True)
    session.add_all([raza_default, raza_otra])
    session.add(
        Config(
            config_id=3,
            config_nombre="SISTEMA",
            parametro_id=1,
            parametro_nombre="PERSONA_ID_TUTOR_EVENTUAL",
            parametro_valor="0",
        )
    )
    session.add(
        Config(
            config_id=3,
            config_nombre="SISTEMA",
            parametro_id=2,
            parametro_nombre="RAZA_NOMBRE_DEFAULT",
            parametro_valor="Sin raza definida",
        )
    )
    session.commit()
    session.refresh(especie)
    session.refresh(raza_default)
    session.refresh(raza_otra)
    return especie, raza_default, raza_otra


def _login(client, username: str, password: str) -> None:
    response = client.post(
        "/api/auth/login",
        json={"username": username, "password": password},
    )
    assert response.status_code == 200


def test_list_mascotas_sin_auth_devuelve_401(client, session) -> None:
    _seed_jwt_config(session)
    session.commit()
    response = client.get("/api/mascotas")
    assert response.status_code == 401


def test_list_mascotas_sin_permiso_devuelve_403(client, session) -> None:
    _seed_jwt_config(session)
    seed_usuario_con_permiso(
        session,
        username="viewer",
        password="Secret123!",
        nombre="Vista",
        apellido="Solo",
        dni="111",
        permiso_nombre="clientes:ver_listado",
    )
    _login(client, "viewer", "Secret123!")
    response = client.get("/api/mascotas")
    assert response.status_code == 403


def test_create_y_list_mascota_con_tutor_y_peso(client, session) -> None:
    _seed_jwt_config(session)
    seed_usuario_con_permiso(
        session,
        username="admin",
        password="Secret123!",
        nombre="Admin",
        apellido="User",
        dni="222",
        permiso_nombre="*",
    )
    especie, raza_default, _ = _seed_mascota_catalogo(session)
    tutor = seed_cliente(
        session,
        nombre="Ana",
        apellido="Ruiz",
        dni="40111222",
        fecha_nacimiento=date(1990, 1, 1),
    )
    _login(client, "admin", "Secret123!")

    create_response = client.post(
        "/api/mascotas",
        json={
            "persona_id": tutor.id,
            "tutor_eventual": False,
            "nombre": "Firulais",
            "especie_id": especie.id,
            "raza_id": raza_default.id,
            "sexo": "M",
            "fecha_nacimiento": "2020-05-01",
            "peso_inicial_kg": "12.50",
            "microchip": "CHIP001",
            "alertas_medicas": None,
        },
    )
    assert create_response.status_code == 201
    created = create_response.json()
    assert created["nombre"] == "Firulais"
    assert created["mascota_estado_id"] == MASCOTA_ESTADO_ACTIVA_ID
    assert created["peso_registrado"] is True

    mascota = session.get(Mascota, created["id"])
    assert mascota is not None
    assert mascota.persona_id == tutor.id
    # ultimo_peso lo setea trigger en Postgres; en SQLite de tests puede quedar None
    pesos = session.exec(
        select(HistorialPeso).where(HistorialPeso.mascota_id == mascota.id)
    ).all()
    assert len(pesos) == 1
    assert pesos[0].peso_kg == Decimal("12.50")

    list_response = client.get("/api/mascotas")
    assert list_response.status_code == 200
    payload = list_response.json()
    assert payload["total"] == 1
    assert payload["page_size"] == 50
    assert payload["items"][0]["nombre"] == "Firulais"
    assert payload["items"][0]["tutor_dni"] == "40111222"
    assert payload["items"][0]["especie_nombre"] == "Canina"


def test_create_mascota_tutor_eventual(client, session) -> None:
    _seed_jwt_config(session)
    seed_usuario_con_permiso(
        session,
        username="admin",
        password="Secret123!",
        nombre="Admin",
        apellido="User",
        dni="222",
        permiso_nombre="mascotas:crear",
    )
    especie, raza_default, _ = _seed_mascota_catalogo(session)
    tutor_eventual = Persona(
        nombre="Tutor",
        apellido="Eventual",
        dni=None,
        celular="000",
        es_cliente=True,
    )
    session.add(tutor_eventual)
    session.commit()
    session.refresh(tutor_eventual)

    config = session.exec(
        select(Config).where(Config.parametro_nombre == "PERSONA_ID_TUTOR_EVENTUAL")
    ).first()
    assert config is not None
    config.parametro_valor = str(tutor_eventual.id)
    session.add(config)
    session.commit()

    _login(client, "admin", "Secret123!")
    response = client.post(
        "/api/mascotas",
        json={
            "tutor_eventual": True,
            "nombre": "Michi",
            "especie_id": especie.id,
            "raza_id": raza_default.id,
        },
    )
    assert response.status_code == 201
    body = response.json()
    assert body["persona_id"] == tutor_eventual.id
    assert body["peso_registrado"] is False


def test_create_mascota_raza_de_otra_especie_devuelve_400(client, session) -> None:
    _seed_jwt_config(session)
    seed_usuario_con_permiso(
        session,
        username="admin",
        password="Secret123!",
        nombre="Admin",
        apellido="User",
        dni="222",
        permiso_nombre="mascotas:crear",
    )
    especie, _, _ = _seed_mascota_catalogo(session)
    otra_especie = Especie(nombre="Felina", activo=True)
    session.add(otra_especie)
    session.flush()
    raza_felina = Raza(especie_id=otra_especie.id or 0, nombre="Siames", activo=True)
    session.add(raza_felina)
    tutor = seed_cliente(
        session,
        nombre="Ana",
        apellido="Ruiz",
        dni="40111222",
        fecha_nacimiento=date(1990, 1, 1),
    )
    _login(client, "admin", "Secret123!")

    response = client.post(
        "/api/mascotas",
        json={
            "persona_id": tutor.id,
            "nombre": "X",
            "especie_id": especie.id,
            "raza_id": raza_felina.id,
        },
    )
    assert response.status_code == 400
    assert response.json()["error"] == "RAZA_INVALIDA"


def test_list_mascotas_filtra_por_cliente_id(client, session) -> None:
    _seed_jwt_config(session)
    seed_usuario_con_permiso(
        session,
        username="admin",
        password="Secret123!",
        nombre="Admin",
        apellido="User",
        dni="222",
        permiso_nombre="*",
    )
    especie, raza_default, _ = _seed_mascota_catalogo(session)
    tutor_a = seed_cliente(
        session,
        nombre="Ana",
        apellido="A",
        dni="111",
        fecha_nacimiento=date(1990, 1, 1),
    )
    tutor_b = seed_cliente(
        session,
        nombre="Beto",
        apellido="B",
        dni="222",
        fecha_nacimiento=date(1991, 1, 1),
    )
    session.add_all(
        [
            Mascota(
                persona_id=tutor_a.id or 0,
                raza_id=raza_default.id or 0,
                nombre="A1",
                mascota_estado_id=MASCOTA_ESTADO_ACTIVA_ID,
            ),
            Mascota(
                persona_id=tutor_b.id or 0,
                raza_id=raza_default.id or 0,
                nombre="B1",
                mascota_estado_id=MASCOTA_ESTADO_ACTIVA_ID,
            ),
        ]
    )
    session.commit()
    _login(client, "admin", "Secret123!")

    response = client.get(f"/api/mascotas?cliente_id={tutor_a.id}")
    assert response.status_code == 200
    payload = response.json()
    assert payload["total"] == 1
    assert payload["items"][0]["nombre"] == "A1"


def test_get_tutor_by_id_devuelve_cliente(client, session) -> None:
    _seed_jwt_config(session)
    seed_usuario_con_permiso(
        session,
        username="admin",
        password="Secret123!",
        nombre="Admin",
        apellido="User",
        dni="222",
        permiso_nombre="mascotas:crear",
    )
    tutor = seed_cliente(
        session,
        nombre="Ana",
        apellido="Ruiz",
        dni="40111222",
        fecha_nacimiento=date(1990, 1, 1),
    )
    _login(client, "admin", "Secret123!")

    response = client.get(f"/api/mascotas/tutores/{tutor.id}")
    assert response.status_code == 200
    body = response.json()
    assert body["id"] == tutor.id
    assert body["dni"] == "40111222"


def test_get_tutor_by_id_inexistente_devuelve_404(client, session) -> None:
    _seed_jwt_config(session)
    seed_usuario_con_permiso(
        session,
        username="admin",
        password="Secret123!",
        nombre="Admin",
        apellido="User",
        dni="222",
        permiso_nombre="mascotas:crear",
    )
    _login(client, "admin", "Secret123!")

    response = client.get("/api/mascotas/tutores/999999")
    assert response.status_code == 404
    assert response.json()["error"] == "TUTOR_NO_ENCONTRADO"


def test_buscar_tutores_excluye_usuarios_no_clientes(client, session) -> None:
    _seed_jwt_config(session)
    seed_usuario_con_permiso(
        session,
        username="admin",
        password="Secret123!",
        nombre="Ezequiel",
        apellido="Admin",
        dni="999",
        permiso_nombre="mascotas:crear",
    )
    seed_cliente(
        session,
        nombre="Ezequiel",
        apellido="Cliente",
        dni="30111222",
        fecha_nacimiento=date(1990, 1, 1),
    )
    _login(client, "admin", "Secret123!")

    response = client.get("/api/mascotas/tutores?q=Ezequiel")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["apellido"] == "Cliente"


def test_buscar_tutores_por_dni_devuelve_coincidencias(client, session) -> None:
    _seed_jwt_config(session)
    seed_usuario_con_permiso(
        session,
        username="admin",
        password="Secret123!",
        nombre="Admin",
        apellido="User",
        dni="222",
        permiso_nombre="mascotas:crear",
    )
    seed_cliente(
        session,
        nombre="Ana",
        apellido="Ruiz",
        dni="40.111.222",
        fecha_nacimiento=date(1990, 1, 1),
    )
    seed_cliente(
        session,
        nombre="Beto",
        apellido="Lopez",
        dni="50999888",
        fecha_nacimiento=date(1991, 1, 1),
    )
    _login(client, "admin", "Secret123!")

    por_digitos = client.get("/api/mascotas/tutores?q=40111222")
    assert por_digitos.status_code == 200
    body = por_digitos.json()
    assert len(body) == 1
    assert body[0]["apellido"] == "Ruiz"
    assert body[0]["dni"] == "40.111.222"

    por_nombre = client.get("/api/mascotas/tutores?q=Beto")
    assert por_nombre.status_code == 200
    assert por_nombre.json()[0]["dni"] == "50999888"


def _crear_mascota_basica(client, *, especie_id: int, raza_id: int, persona_id: int, nombre: str = "Firulais"):
    response = client.post(
        "/api/mascotas",
        json={
            "persona_id": persona_id,
            "tutor_eventual": False,
            "nombre": nombre,
            "especie_id": especie_id,
            "raza_id": raza_id,
            "sexo": "M",
            "fecha_nacimiento": "2020-05-01",
            "peso_inicial_kg": None,
            "microchip": None,
            "alertas_medicas": None,
        },
    )
    assert response.status_code == 201
    return response.json()


def test_get_mascota_sin_auth_devuelve_401(client, session) -> None:
    _seed_jwt_config(session)
    session.commit()
    response = client.get("/api/mascotas/1")
    assert response.status_code == 401


def test_get_mascota_sin_permiso_devuelve_403(client, session) -> None:
    _seed_jwt_config(session)
    seed_usuario_con_permiso(
        session,
        username="viewer",
        password="Secret123!",
        nombre="Vista",
        apellido="Solo",
        dni="111",
        permiso_nombre="mascotas:ver_listado",
    )
    _login(client, "viewer", "Secret123!")
    response = client.get("/api/mascotas/1")
    assert response.status_code == 403


def test_patch_mascota_sin_auth_devuelve_401(client, session) -> None:
    _seed_jwt_config(session)
    session.commit()
    response = client.patch("/api/mascotas/1", json={"nombre": "Nuevo"})
    assert response.status_code == 401


def test_patch_mascota_sin_permiso_devuelve_403(client, session) -> None:
    _seed_jwt_config(session)
    seed_usuario_con_permiso(
        session,
        username="viewer",
        password="Secret123!",
        nombre="Vista",
        apellido="Solo",
        dni="111",
        permiso_nombre="mascotas:ver_listado",
    )
    _login(client, "viewer", "Secret123!")
    response = client.patch("/api/mascotas/1", json={"nombre": "Nuevo"})
    assert response.status_code == 403


def test_get_mascota_inexistente_devuelve_404(client, session) -> None:
    _seed_jwt_config(session)
    seed_usuario_con_permiso(
        session,
        username="editor",
        password="Secret123!",
        nombre="Editor",
        apellido="User",
        dni="333",
        permiso_nombre="mascotas:editar",
    )
    _login(client, "editor", "Secret123!")
    response = client.get("/api/mascotas/999999")
    assert response.status_code == 404
    assert response.json()["error"] == "MASCOTA_NO_ENCONTRADA"


def test_patch_mascota_inexistente_devuelve_404(client, session) -> None:
    _seed_jwt_config(session)
    seed_usuario_con_permiso(
        session,
        username="editor",
        password="Secret123!",
        nombre="Editor",
        apellido="User",
        dni="333",
        permiso_nombre="mascotas:editar",
    )
    _login(client, "editor", "Secret123!")
    response = client.patch("/api/mascotas/999999", json={"nombre": "Nuevo"})
    assert response.status_code == 404
    assert response.json()["error"] == "MASCOTA_NO_ENCONTRADA"


def test_get_y_patch_mascota_ok(client, session) -> None:
    _seed_jwt_config(session)
    seed_usuario_con_permiso(
        session,
        username="admin",
        password="Secret123!",
        nombre="Admin",
        apellido="User",
        dni="222",
        permiso_nombre="*",
    )
    especie, raza_default, raza_otra = _seed_mascota_catalogo(session)
    tutor = seed_cliente(
        session,
        nombre="Ana",
        apellido="Ruiz",
        dni="40111222",
        fecha_nacimiento=date(1990, 1, 1),
    )
    otro_tutor = seed_cliente(
        session,
        nombre="Beto",
        apellido="Lopez",
        dni="50999888",
        fecha_nacimiento=date(1991, 1, 1),
    )
    _login(client, "admin", "Secret123!")
    created = _crear_mascota_basica(
        client,
        especie_id=especie.id or 0,
        raza_id=raza_default.id or 0,
        persona_id=tutor.id or 0,
    )

    get_response = client.get(f"/api/mascotas/{created['id']}")
    assert get_response.status_code == 200
    detail = get_response.json()
    assert detail["nombre"] == "Firulais"
    assert detail["especie_id"] == especie.id
    assert detail["persona_id"] == tutor.id
    assert "ultimo_peso" not in detail

    patch_response = client.patch(
        f"/api/mascotas/{created['id']}",
        json={
            "nombre": "Max",
            "persona_id": otro_tutor.id,
            "raza_id": raza_otra.id,
            "sexo": "H",
            "microchip": "CHIPEDIT",
        },
    )
    assert patch_response.status_code == 200
    updated = patch_response.json()
    assert updated["nombre"] == "Max"
    assert updated["persona_id"] == otro_tutor.id
    assert updated["tutor_apellido"] == "Lopez"
    assert updated["raza_id"] == raza_otra.id
    assert updated["sexo"] == "H"
    assert updated["microchip"] == "CHIPEDIT"
    assert updated["especie_id"] == especie.id


def test_patch_mascota_raza_de_otra_especie_devuelve_400(client, session) -> None:
    _seed_jwt_config(session)
    seed_usuario_con_permiso(
        session,
        username="admin",
        password="Secret123!",
        nombre="Admin",
        apellido="User",
        dni="222",
        permiso_nombre="*",
    )
    especie, raza_default, _ = _seed_mascota_catalogo(session)
    otra_especie = Especie(nombre="Felina", activo=True)
    session.add(otra_especie)
    session.flush()
    raza_felina = Raza(especie_id=otra_especie.id or 0, nombre="Siames", activo=True)
    session.add(raza_felina)
    session.commit()
    session.refresh(raza_felina)

    tutor = seed_cliente(
        session,
        nombre="Ana",
        apellido="Ruiz",
        dni="40111222",
        fecha_nacimiento=date(1990, 1, 1),
    )
    _login(client, "admin", "Secret123!")
    created = _crear_mascota_basica(
        client,
        especie_id=especie.id or 0,
        raza_id=raza_default.id or 0,
        persona_id=tutor.id or 0,
    )

    response = client.patch(
        f"/api/mascotas/{created['id']}",
        json={"raza_id": raza_felina.id},
    )
    assert response.status_code == 400
    assert response.json()["error"] == "RAZA_INVALIDA"


def test_patch_mascota_rechaza_paso_a_tutor_eventual(client, session) -> None:
    _seed_jwt_config(session)
    seed_usuario_con_permiso(
        session,
        username="admin",
        password="Secret123!",
        nombre="Admin",
        apellido="User",
        dni="222",
        permiso_nombre="*",
    )
    especie, raza_default, _ = _seed_mascota_catalogo(session)
    tutor_real = seed_cliente(
        session,
        nombre="Ana",
        apellido="Ruiz",
        dni="40111222",
        fecha_nacimiento=date(1990, 1, 1),
    )
    tutor_eventual = Persona(
        nombre="Tutor",
        apellido="Eventual",
        dni="00000000",
        celular="000",
        es_cliente=True,
    )
    session.add(tutor_eventual)
    session.flush()
    session.refresh(tutor_eventual)
    config = session.exec(
        select(Config).where(Config.parametro_nombre == "PERSONA_ID_TUTOR_EVENTUAL")
    ).first()
    assert config is not None
    config.parametro_valor = str(tutor_eventual.id)
    session.add(config)
    session.commit()

    _login(client, "admin", "Secret123!")
    created = _crear_mascota_basica(
        client,
        especie_id=especie.id or 0,
        raza_id=raza_default.id or 0,
        persona_id=tutor_real.id or 0,
    )

    response = client.patch(
        f"/api/mascotas/{created['id']}",
        json={"persona_id": tutor_eventual.id},
    )
    assert response.status_code == 400
    assert response.json()["error"] == "TUTOR_EVENTUAL_NO_PERMITIDO"


def test_patch_mascota_pelaje_de_otra_especie_devuelve_400(client, session) -> None:
    _seed_jwt_config(session)
    seed_usuario_con_permiso(
        session,
        username="admin",
        password="Secret123!",
        nombre="Admin",
        apellido="User",
        dni="222",
        permiso_nombre="*",
    )
    especie, raza_default, _ = _seed_mascota_catalogo(session)
    otra_especie = Especie(nombre="Felina", activo=True)
    session.add(otra_especie)
    session.flush()
    pelaje_ajeno = Pelaje(
        especie_id=otra_especie.id or 0,
        nombre="Corto felino",
        activo=True,
    )
    session.add(pelaje_ajeno)
    session.commit()
    session.refresh(pelaje_ajeno)

    tutor = seed_cliente(
        session,
        nombre="Ana",
        apellido="Ruiz",
        dni="40111222",
        fecha_nacimiento=date(1990, 1, 1),
    )
    _login(client, "admin", "Secret123!")
    created = _crear_mascota_basica(
        client,
        especie_id=especie.id or 0,
        raza_id=raza_default.id or 0,
        persona_id=tutor.id or 0,
    )

    response = client.patch(
        f"/api/mascotas/{created['id']}",
        json={"pelaje_id": pelaje_ajeno.id},
    )
    assert response.status_code == 400
    assert response.json()["error"] == "PELAJE_INVALIDO"


def test_list_catalogo_pelajes_filtra_por_especie(client, session) -> None:
    _seed_jwt_config(session)
    seed_usuario_con_permiso(
        session,
        username="editor",
        password="Secret123!",
        nombre="Editor",
        apellido="User",
        dni="333",
        permiso_nombre="mascotas:editar",
    )
    especie, _, _ = _seed_mascota_catalogo(session)
    otra_especie = Especie(nombre="Felina", activo=True)
    session.add(otra_especie)
    session.flush()
    pelaje_ok = Pelaje(especie_id=especie.id or 0, nombre="Largo", activo=True)
    pelaje_otro = Pelaje(especie_id=otra_especie.id or 0, nombre="Corto", activo=True)
    session.add_all([pelaje_ok, pelaje_otro])
    session.commit()
    session.refresh(pelaje_ok)

    _login(client, "editor", "Secret123!")
    response = client.get(f"/api/mascotas/catalogos/pelajes?especie_id={especie.id}")
    assert response.status_code == 200
    body = response.json()
    assert len(body) == 1
    assert body[0]["id"] == pelaje_ok.id
    assert body[0]["nombre"] == "Largo"
