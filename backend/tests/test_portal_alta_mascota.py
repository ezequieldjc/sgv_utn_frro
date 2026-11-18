"""Alta de mascota desde el portal (portal:crear_mascota): el dueño sale siempre de la sesión."""

from __future__ import annotations

from datetime import date, timedelta

from sqlmodel import select

from app.models.clinica.especie import Especie
from app.models.clinica.mascota import Mascota
from app.models.clinica.raza import Raza
from app.models.sys.config import Config
from app.services.config_service import clear_config_cache
from app.services.mascota_service import MASCOTA_ESTADO_ACTIVA_ID
from test_agenda import _login, _seed_mascota, _seed_usuario
from test_clientes import _seed_jwt_config

PERMISO_PORTAL = "portal:ver"
PERMISO_CREAR_MASCOTA = "portal:crear_mascota"


def _seed_cliente(session, username: str, permisos: list[str]):
    usuario = _seed_usuario(
        session, username=username, permisos=permisos, rol_nombre=f"CLIENTE_{username}"
    )
    usuario.persona.es_cliente = True
    session.add(usuario.persona)
    session.commit()
    session.refresh(usuario)
    return usuario


def _escenario(session) -> dict:
    """Cliente con permiso de alta, otro cliente, especies (una inactiva) y razas."""
    _seed_jwt_config(session)
    session.commit()
    # Crea ACTIVA, la especie Canina y la raza Labrador (de otra persona).
    ajena = _seed_mascota(session, nombre="Ajena")
    canina = session.exec(select(Especie).where(Especie.nombre == "Canina")).one()
    labrador = session.exec(select(Raza).where(Raza.nombre == "Labrador")).one()
    felina = Especie(nombre="Felina", activo=True)
    exotica = Especie(nombre="Exótica", activo=False)
    session.add_all([felina, exotica])
    session.flush()
    siames = Raza(especie_id=felina.id or 0, nombre="Siamés", activo=True)
    caniche_inactiva = Raza(especie_id=canina.id or 0, nombre="Caniche", activo=False)
    iguana = Raza(especie_id=exotica.id or 0, nombre="Iguana", activo=True)
    session.add_all([siames, caniche_inactiva, iguana])
    session.commit()
    return {
        "cliente": _seed_cliente(session, "ana", [PERMISO_PORTAL, PERMISO_CREAR_MASCOTA]),
        "sin_permiso": _seed_cliente(session, "beto", [PERMISO_PORTAL]),
        "ajena": ajena,
        "canina": canina,
        "felina": felina,
        "exotica": exotica,
        "labrador": labrador,
        "siames": siames,
        "caniche_inactiva": caniche_inactiva,
        "iguana": iguana,
    }


def _body(e: dict, **cambios) -> dict:
    body = {
        "nombre": "Firulais",
        "especie_id": e["canina"].id,
        "raza_id": e["labrador"].id,
        "sexo": "M",
        "fecha_nacimiento": "2022-06-01",
    }
    body.update(cambios)
    return body


def test_portal_alta_mascota_queda_a_nombre_del_cliente_y_nace_activa(client, session) -> None:
    e = _escenario(session)
    _login(client, "ana")

    response = client.post("/api/portal/mascotas", json=_body(e))

    assert response.status_code == 201, response.text
    body = response.json()
    assert body["nombre"] == "Firulais"
    assert body["especie_nombre"] == "Canina"
    assert body["raza_nombre"] == "Labrador"
    mascota = session.get(Mascota, body["id"])
    assert mascota is not None
    assert mascota.persona_id == e["cliente"].persona_id
    assert mascota.mascota_estado_id == MASCOTA_ESTADO_ACTIVA_ID
    assert mascota.microchip is None
    assert mascota.ultimo_peso is None
    assert [m["nombre"] for m in client.get("/api/portal/mascotas").json()] == ["Firulais"]


def test_portal_alta_mascota_ignora_un_persona_id_en_el_body(client, session) -> None:
    e = _escenario(session)
    _login(client, "ana")

    response = client.post(
        "/api/portal/mascotas", json=_body(e, persona_id=e["ajena"].persona_id)
    )

    assert response.status_code == 201
    mascota = session.get(Mascota, response.json()["id"])
    assert mascota is not None
    assert mascota.persona_id == e["cliente"].persona_id


def test_portal_alta_mascota_sin_permiso_devuelve_403(client, session) -> None:
    e = _escenario(session)
    _login(client, "beto")

    assert client.post("/api/portal/mascotas", json=_body(e)).status_code == 403
    assert client.get("/api/portal/mascotas/especies").status_code == 403
    assert client.get(
        "/api/portal/mascotas/razas", params={"especie_id": e["canina"].id}
    ).status_code == 403


def test_portal_alta_mascota_sin_sesion_devuelve_401(client, session) -> None:
    e = _escenario(session)

    assert client.post("/api/portal/mascotas", json=_body(e)).status_code == 401


def test_portal_alta_mascota_raza_de_otra_especie_devuelve_400(client, session) -> None:
    e = _escenario(session)
    _login(client, "ana")

    response = client.post("/api/portal/mascotas", json=_body(e, raza_id=e["siames"].id))

    assert response.status_code == 400
    assert response.json()["error"] == "RAZA_INVALIDA"


def test_portal_alta_mascota_raza_o_especie_inactiva_devuelve_400(client, session) -> None:
    e = _escenario(session)
    _login(client, "ana")

    raza_inactiva = client.post(
        "/api/portal/mascotas", json=_body(e, raza_id=e["caniche_inactiva"].id)
    )
    especie_inactiva = client.post(
        "/api/portal/mascotas",
        json=_body(e, especie_id=e["exotica"].id, raza_id=e["iguana"].id),
    )

    assert raza_inactiva.status_code == 400
    assert especie_inactiva.status_code == 400
    assert especie_inactiva.json()["error"] == "ESPECIE_INVALIDA"


def test_portal_alta_mascota_fecha_futura_o_sin_nombre_devuelve_422(client, session) -> None:
    e = _escenario(session)
    _login(client, "ana")
    manana = (date.today() + timedelta(days=1)).isoformat()

    assert client.post(
        "/api/portal/mascotas", json=_body(e, fecha_nacimiento=manana)
    ).status_code == 422
    assert client.post("/api/portal/mascotas", json=_body(e, nombre="  ")).status_code == 422


def test_portal_alta_mascota_permite_dos_con_el_mismo_nombre(client, session) -> None:
    e = _escenario(session)
    _login(client, "ana")

    assert client.post("/api/portal/mascotas", json=_body(e)).status_code == 201
    assert client.post("/api/portal/mascotas", json=_body(e)).status_code == 201
    assert len(client.get("/api/portal/mascotas").json()) == 2


def test_portal_alta_mascota_ofrece_solo_especies_y_razas_activas(client, session) -> None:
    e = _escenario(session)
    _login(client, "ana")

    especies = client.get("/api/portal/mascotas/especies").json()
    razas = client.get(
        "/api/portal/mascotas/razas", params={"especie_id": e["canina"].id}
    ).json()

    assert [x["nombre"] for x in especies] == ["Canina", "Felina"]
    assert [x["nombre"] for x in razas] == ["Labrador"]


def test_portal_alta_mascota_usuario_del_tutor_eventual_devuelve_403(client, session) -> None:
    e = _escenario(session)
    session.add(
        Config(
            config_id=90,
            config_nombre="MASCOTAS",
            parametro_id=1,
            parametro_nombre="PERSONA_ID_TUTOR_EVENTUAL",
            parametro_valor=str(e["cliente"].persona_id),
        )
    )
    session.commit()
    clear_config_cache()
    _login(client, "ana")

    response = client.post("/api/portal/mascotas", json=_body(e))

    assert response.status_code == 403
    assert response.json()["error"] == "PORTAL_NO_DISPONIBLE"
