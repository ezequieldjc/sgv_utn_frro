from __future__ import annotations

from datetime import datetime, timedelta
from zoneinfo import ZoneInfo

from sqlmodel import select

from app.core.security import hash_password
from app.core.time_utils import utc_now
from app.models.agenda.tipo_turno import TipoTurno
from app.models.agenda.turno import Turno
from app.models.auth.historial_contrasena import HistorialContrasena
from app.models.auth.permiso import Permiso
from app.models.auth.rol import Rol
from app.models.auth.rol_permiso import RolPermiso
from app.models.auth.usuario import Usuario
from app.models.catalogo.mascota_estado import MascotaEstado
from app.models.clinica.especie import Especie
from app.models.clinica.mascota import Mascota
from app.models.clinica.raza import Raza
from app.models.core.persona import Persona
from app.services.mascota_service import MASCOTA_ESTADO_ACTIVA_ID
from test_clientes import _seed_jwt_config

TZ = ZoneInfo("America/Argentina/Buenos_Aires")
PASSWORD = "Secret123!"
PERMISOS_RECEPCION = [
    "agenda:ver",
    "agenda:crear_turno",
    "agenda:editar_turno",
    "agenda:cancelar_turno",
]

# ---------------------------------------------------------------------------
# Helpers de seed
# ---------------------------------------------------------------------------


def _seed_usuario(
    session,
    *,
    username: str,
    permisos: list[str],
    rol_nombre: str,
    habilitado: bool = True,
    nombre: str = "Nombre",
    apellido: str = "Apellido",
) -> Usuario:
    rol = session.exec(select(Rol).where(Rol.nombre == rol_nombre)).first()
    if rol is None:
        rol = Rol(nombre=rol_nombre, descripcion=rol_nombre)
        session.add(rol)
        session.flush()
    for permiso_nombre in permisos:
        permiso = session.exec(select(Permiso).where(Permiso.nombre == permiso_nombre)).first()
        if permiso is None:
            permiso = Permiso(nombre=permiso_nombre, descripcion=permiso_nombre)
            session.add(permiso)
            session.flush()
        link = session.exec(
            select(RolPermiso).where(
                RolPermiso.rol_id == rol.id, RolPermiso.permiso_id == permiso.id
            )
        ).first()
        if link is None:
            session.add(RolPermiso(rol_id=rol.id or 0, permiso_id=permiso.id or 0))
    persona = Persona(
        nombre=nombre,
        apellido=apellido,
        celular="123456789",
        mail=f"{username}@example.com",
        es_cliente=False,
    )
    usuario = Usuario(
        persona=persona, username=username, habilitado=habilitado, rol=rol, version_token=1
    )
    historial = HistorialContrasena(
        usuario=usuario, hashed_password=hash_password(PASSWORD), debe_cambiar=False
    )
    session.add_all([persona, usuario, historial])
    session.commit()
    session.refresh(usuario)
    return usuario


def _seed_mascota(session, *, nombre: str, tutor_apellido: str = "Gomez") -> Mascota:
    if session.get(MascotaEstado, MASCOTA_ESTADO_ACTIVA_ID) is None:
        session.add(MascotaEstado(id=MASCOTA_ESTADO_ACTIVA_ID, nombre="ACTIVA", activo=True))
    especie = session.exec(select(Especie).where(Especie.nombre == "Canina")).first()
    if especie is None:
        especie = Especie(nombre="Canina", activo=True)
        session.add(especie)
        session.flush()
    raza = session.exec(select(Raza).where(Raza.nombre == "Labrador")).first()
    if raza is None:
        raza = Raza(especie_id=especie.id or 0, nombre="Labrador", activo=True)
        session.add(raza)
        session.flush()
    tutor = Persona(nombre="Ana", apellido=tutor_apellido, celular="341555000", es_cliente=True)
    session.add(tutor)
    session.flush()
    mascota = Mascota(
        persona_id=tutor.id or 0,
        raza_id=raza.id or 0,
        nombre=nombre,
        mascota_estado_id=MASCOTA_ESTADO_ACTIVA_ID,
    )
    session.add(mascota)
    session.commit()
    session.refresh(mascota)
    return mascota


def _seed_tipos(session) -> dict[str, TipoTurno]:
    tipos = {
        "consulta": TipoTurno(nombre="Consulta", duracion_min=30, activo=True),
        "cirugia": TipoTurno(nombre="Cirugía", duracion_min=90, activo=True),
        "inactivo": TipoTurno(nombre="Baño", duracion_min=30, activo=False),
    }
    session.add_all(tipos.values())
    session.commit()
    for tipo in tipos.values():
        session.refresh(tipo)
    return tipos


def _dt(value: str) -> datetime:
    """Parsea ISO 8601 aceptando el sufijo 'Z' (Python < 3.11 no lo soporta)."""
    return datetime.fromisoformat(value.replace("Z", "+00:00"))


def _login(client, username: str) -> None:
    response = client.post("/api/auth/login", json={"username": username, "password": PASSWORD})
    assert response.status_code == 200


def _proximo(dia_semana: int, hora: int, minuto: int = 0) -> datetime:
    """Fecha local futura (al menos 7 días adelante) en el día de semana pedido (0 = lunes)."""
    base = datetime.now(TZ).date() + timedelta(days=7)
    delta = (dia_semana - base.weekday()) % 7
    dia = base + timedelta(days=delta)
    return datetime(dia.year, dia.month, dia.day, hora, minuto, tzinfo=TZ)


def _setup(client, session) -> dict:
    """Escenario base: recepcionista logueada, 2 veterinarios, 2 mascotas, tipos de turno."""
    _seed_jwt_config(session)
    session.commit()
    recepcion = _seed_usuario(
        session, username="recepcion", permisos=PERMISOS_RECEPCION, rol_nombre="RECEPCION"
    )
    vet1 = _seed_usuario(
        session,
        username="vet1",
        permisos=["agenda:ver", "agenda:atender"],
        rol_nombre="VETERINARIO",
        nombre="Laura",
        apellido="Perez",
    )
    vet2 = _seed_usuario(
        session,
        username="vet2",
        permisos=["agenda:ver", "agenda:atender"],
        rol_nombre="VETERINARIO",
        nombre="Martin",
        apellido="Diaz",
    )
    m1 = _seed_mascota(session, nombre="Firulais", tutor_apellido="Gomez")
    m2 = _seed_mascota(session, nombre="Michi", tutor_apellido="Lopez")
    tipos = _seed_tipos(session)
    _login(client, "recepcion")
    return {"recepcion": recepcion, "vet1": vet1, "vet2": vet2, "m1": m1, "m2": m2, "tipos": tipos}


def _crear(client, s: dict, *, inicio: datetime, vet: str = "vet1", mascota: str = "m1",
           tipo: str = "consulta", **extra):
    payload = {
        "mascota_id": s[mascota].id,
        "veterinario_id": s[vet].id,
        "tipo_turno_id": s["tipos"][tipo].id,
        "fecha_hora_inicio": inicio.isoformat(),
        **extra,
    }
    return client.post("/api/agenda/turnos", json=payload)


def _turno_pasado(session, s: dict, *, estado: str) -> Turno:
    inicio = utc_now().replace(microsecond=0) - timedelta(days=1)
    turno = Turno(
        mascota_id=s["m1"].id,
        veterinario_id=s["vet1"].id,
        tipo_turno_id=s["tipos"]["consulta"].id,
        fecha_hora_inicio=inicio,
        fecha_hora_fin=inicio + timedelta(minutes=30),
        estado=estado,
        canal_origen="mostrador",
    )
    session.add(turno)
    session.commit()
    session.refresh(turno)
    return turno


# ---------------------------------------------------------------------------
# Autenticación y permisos
# ---------------------------------------------------------------------------


def test_listar_turnos_sin_auth_devuelve_401(client, session) -> None:
    _seed_jwt_config(session)
    session.commit()
    response = client.get(
        "/api/agenda/turnos", params={"desde": "2030-01-01T00:00:00", "hasta": "2030-01-02T00:00:00"}
    )
    assert response.status_code == 401


def test_listar_turnos_sin_permiso_ver_devuelve_403(client, session) -> None:
    _seed_jwt_config(session)
    session.commit()
    _seed_usuario(session, username="otro", permisos=["clientes:ver_listado"], rol_nombre="OTRO")
    _login(client, "otro")
    response = client.get(
        "/api/agenda/turnos", params={"desde": "2030-01-01T00:00:00", "hasta": "2030-01-02T00:00:00"}
    )
    assert response.status_code == 403


def test_crear_turno_sin_permiso_crear_devuelve_403(client, session) -> None:
    s = _setup(client, session)
    _login(client, "vet1")  # vet1 solo tiene agenda:ver y agenda:atender
    response = _crear(client, s, inicio=_proximo(0, 9))
    assert response.status_code == 403


def test_cancelar_turno_sin_permiso_cancelar_devuelve_403(client, session) -> None:
    s = _setup(client, session)
    turno_id = _crear(client, s, inicio=_proximo(0, 9)).json()["id"]
    _login(client, "vet1")
    response = client.post(f"/api/agenda/turnos/{turno_id}/cancelar")
    assert response.status_code == 403


def test_cambiar_estado_sin_permiso_editar_devuelve_403(client, session) -> None:
    s = _setup(client, session)
    turno_id = _crear(client, s, inicio=_proximo(0, 9)).json()["id"]
    _login(client, "vet1")
    response = client.post(f"/api/agenda/turnos/{turno_id}/estado", json={"estado": "confirmado"})
    assert response.status_code == 403


# ---------------------------------------------------------------------------
# Alta de turno
# ---------------------------------------------------------------------------


def test_crear_turno_valido_calcula_fecha_fin_y_nace_solicitado(client, session) -> None:
    s = _setup(client, session)
    inicio = _proximo(0, 9)
    response = _crear(client, s, inicio=inicio, tipo="cirugia")
    assert response.status_code == 201
    data = response.json()
    assert data["estado"] == "solicitado"
    assert data["canal_origen"] == "mostrador"
    assert data["mascota_nombre"] == "Firulais"
    assert data["veterinario_apellido"] == "Perez"
    assert data["tipo_turno_nombre"] == "Cirugía"
    assert _dt(data["fecha_hora_inicio"]) == inicio
    assert _dt(data["fecha_hora_fin"]) == inicio + timedelta(minutes=90)


def test_crear_turno_con_estado_inicial_confirmado_y_canal_telefono(client, session) -> None:
    s = _setup(client, session)
    response = _crear(
        client, s, inicio=_proximo(1, 15), estado_inicial="confirmado", canal_origen="telefono"
    )
    assert response.status_code == 201
    assert response.json()["estado"] == "confirmado"
    assert response.json()["canal_origen"] == "telefono"


def test_crear_turno_con_canal_portal_desde_app_interna_devuelve_422(client, session) -> None:
    s = _setup(client, session)
    response = _crear(client, s, inicio=_proximo(0, 9), canal_origen="portal")
    assert response.status_code == 422


def test_crear_turno_sin_zona_horaria_se_interpreta_en_hora_local(client, session) -> None:
    s = _setup(client, session)
    inicio = _proximo(0, 9)
    response = _crear(client, s, inicio=inicio.replace(tzinfo=None))
    assert response.status_code == 201
    assert _dt(response.json()["fecha_hora_inicio"]) == inicio


def test_crear_turno_fecha_pasada_devuelve_400(client, session) -> None:
    s = _setup(client, session)
    ayer = datetime.now(TZ) - timedelta(days=1)
    inicio = ayer.replace(hour=9, minute=0, second=0, microsecond=0)
    response = _crear(client, s, inicio=inicio)
    assert response.status_code == 400
    assert response.json()["error"] == "TURNO_EN_EL_PASADO"


def test_crear_turno_domingo_devuelve_400_dia_sin_atencion(client, session) -> None:
    s = _setup(client, session)
    response = _crear(client, s, inicio=_proximo(6, 10))
    assert response.status_code == 400
    assert response.json()["error"] == "DIA_SIN_ATENCION"


def test_crear_turno_entre_franjas_devuelve_400_fuera_de_horario(client, session) -> None:
    s = _setup(client, session)
    response = _crear(client, s, inicio=_proximo(2, 13))
    assert response.status_code == 400
    assert response.json()["error"] == "TURNO_FUERA_DE_HORARIO"


def test_crear_turno_sabado_por_la_tarde_devuelve_400_fuera_de_horario(client, session) -> None:
    s = _setup(client, session)
    response = _crear(client, s, inicio=_proximo(5, 16))
    assert response.status_code == 400
    assert response.json()["error"] == "TURNO_FUERA_DE_HORARIO"


def test_crear_turno_sabado_por_la_manana_devuelve_201(client, session) -> None:
    s = _setup(client, session)
    response = _crear(client, s, inicio=_proximo(5, 11, 30))
    assert response.status_code == 201


def test_crear_turno_que_excede_la_franja_devuelve_400(client, session) -> None:
    s = _setup(client, session)
    # Cirugía de 90 min a las 11:30 terminaría 13:00 (la franja cierra a las 12:00).
    response = _crear(client, s, inicio=_proximo(0, 11, 30), tipo="cirugia")
    assert response.status_code == 400
    assert response.json()["error"] == "TURNO_FUERA_DE_HORARIO"


def test_crear_turno_que_termina_justo_al_cierre_devuelve_201(client, session) -> None:
    s = _setup(client, session)
    response = _crear(client, s, inicio=_proximo(0, 18, 30), tipo="cirugia")
    assert response.status_code == 201


def test_crear_turno_fuera_de_modulo_devuelve_400(client, session) -> None:
    s = _setup(client, session)
    response = _crear(client, s, inicio=_proximo(0, 9, 15))
    assert response.status_code == 400
    assert response.json()["error"] == "TURNO_FUERA_DE_MODULO"


def test_crear_turno_tipo_inactivo_devuelve_400(client, session) -> None:
    s = _setup(client, session)
    response = _crear(client, s, inicio=_proximo(0, 9), tipo="inactivo")
    assert response.status_code == 400
    assert response.json()["error"] == "TIPO_TURNO_INACTIVO"


def test_crear_turno_mascota_inexistente_devuelve_404(client, session) -> None:
    s = _setup(client, session)
    response = client.post(
        "/api/agenda/turnos",
        json={
            "mascota_id": 9999,
            "veterinario_id": s["vet1"].id,
            "tipo_turno_id": s["tipos"]["consulta"].id,
            "fecha_hora_inicio": _proximo(0, 9).isoformat(),
        },
    )
    assert response.status_code == 404


def test_crear_turno_con_usuario_sin_permiso_atender_devuelve_400(client, session) -> None:
    s = _setup(client, session)
    response = _crear(client, s, inicio=_proximo(0, 9), vet="recepcion")
    assert response.status_code == 400
    assert response.json()["error"] == "VETERINARIO_INVALIDO"


def test_crear_turno_con_admin_comodin_como_veterinario_devuelve_400(client, session) -> None:
    s = _setup(client, session)
    s["admin"] = _seed_usuario(session, username="admin", permisos=["*"], rol_nombre="ADMIN")
    response = _crear(client, s, inicio=_proximo(0, 9), vet="admin")
    assert response.status_code == 400
    assert response.json()["error"] == "VETERINARIO_INVALIDO"


# ---------------------------------------------------------------------------
# Superposición
# ---------------------------------------------------------------------------


def test_crear_turno_mismo_veterinario_superpuesto_devuelve_409(client, session) -> None:
    s = _setup(client, session)
    assert _crear(client, s, inicio=_proximo(0, 9), tipo="cirugia").status_code == 201
    # 09:00-10:30 ocupado: un turno a las 10:00 con otra mascota se pisa.
    response = _crear(client, s, inicio=_proximo(0, 10), mascota="m2")
    assert response.status_code == 409
    assert response.json()["error"] == "TURNO_SUPERPUESTO"


def test_crear_turno_contiguo_al_anterior_devuelve_201(client, session) -> None:
    s = _setup(client, session)
    assert _crear(client, s, inicio=_proximo(0, 9)).status_code == 201
    response = _crear(client, s, inicio=_proximo(0, 9, 30), mascota="m2")
    assert response.status_code == 201


def test_crear_turno_distinto_veterinario_mismo_horario_devuelve_201(client, session) -> None:
    s = _setup(client, session)
    assert _crear(client, s, inicio=_proximo(0, 9)).status_code == 201
    response = _crear(client, s, inicio=_proximo(0, 9), vet="vet2", mascota="m2")
    assert response.status_code == 201


def test_crear_turno_misma_mascota_superpuesta_devuelve_409(client, session) -> None:
    s = _setup(client, session)
    assert _crear(client, s, inicio=_proximo(0, 9)).status_code == 201
    response = _crear(client, s, inicio=_proximo(0, 9), vet="vet2")
    assert response.status_code == 409
    assert response.json()["error"] == "MASCOTA_CON_TURNO_SUPERPUESTO"


def test_turno_cancelado_libera_el_horario(client, session) -> None:
    s = _setup(client, session)
    turno_id = _crear(client, s, inicio=_proximo(0, 9)).json()["id"]
    assert client.post(f"/api/agenda/turnos/{turno_id}/cancelar").status_code == 200
    response = _crear(client, s, inicio=_proximo(0, 9), mascota="m2")
    assert response.status_code == 201


# ---------------------------------------------------------------------------
# Estados (Figura 5)
# ---------------------------------------------------------------------------


def test_transicion_solicitado_a_confirmado_devuelve_200(client, session) -> None:
    s = _setup(client, session)
    turno_id = _crear(client, s, inicio=_proximo(0, 9)).json()["id"]
    response = client.post(f"/api/agenda/turnos/{turno_id}/estado", json={"estado": "confirmado"})
    assert response.status_code == 200
    assert response.json()["estado"] == "confirmado"


def test_transicion_solicitado_a_realizado_devuelve_400(client, session) -> None:
    s = _setup(client, session)
    turno = _turno_pasado(session, s, estado="solicitado")
    response = client.post(f"/api/agenda/turnos/{turno.id}/estado", json={"estado": "realizado"})
    assert response.status_code == 400
    assert response.json()["error"] == "TRANSICION_INVALIDA"


def test_marcar_realizado_turno_futuro_devuelve_400(client, session) -> None:
    s = _setup(client, session)
    turno_id = _crear(client, s, inicio=_proximo(0, 9), estado_inicial="confirmado").json()["id"]
    response = client.post(f"/api/agenda/turnos/{turno_id}/estado", json={"estado": "realizado"})
    assert response.status_code == 400
    assert response.json()["error"] == "TURNO_NO_INICIADO"


def test_marcar_realizado_turno_confirmado_ya_iniciado_devuelve_200(client, session) -> None:
    s = _setup(client, session)
    turno = _turno_pasado(session, s, estado="confirmado")
    response = client.post(f"/api/agenda/turnos/{turno.id}/estado", json={"estado": "realizado"})
    assert response.status_code == 200
    assert response.json()["estado"] == "realizado"


def test_marcar_no_asistio_turno_confirmado_ya_iniciado_devuelve_200(client, session) -> None:
    s = _setup(client, session)
    turno = _turno_pasado(session, s, estado="confirmado")
    response = client.post(f"/api/agenda/turnos/{turno.id}/estado", json={"estado": "no_asistio"})
    assert response.status_code == 200
    assert response.json()["estado"] == "no_asistio"


def test_cancelar_turno_realizado_devuelve_400(client, session) -> None:
    s = _setup(client, session)
    turno = _turno_pasado(session, s, estado="realizado")
    response = client.post(f"/api/agenda/turnos/{turno.id}/cancelar")
    assert response.status_code == 400
    assert response.json()["error"] == "TRANSICION_INVALIDA"


def test_cancelar_turno_inexistente_devuelve_404(client, session) -> None:
    _setup(client, session)
    response = client.post("/api/agenda/turnos/9999/cancelar")
    assert response.status_code == 404


# ---------------------------------------------------------------------------
# Reprogramación
# ---------------------------------------------------------------------------


def test_reprogramar_turno_cambia_horario_y_conserva_estado(client, session) -> None:
    s = _setup(client, session)
    turno_id = _crear(client, s, inicio=_proximo(0, 9), estado_inicial="confirmado").json()["id"]
    nuevo = _proximo(1, 16)
    response = client.patch(
        f"/api/agenda/turnos/{turno_id}", json={"fecha_hora_inicio": nuevo.isoformat()}
    )
    assert response.status_code == 200
    data = response.json()
    assert _dt(data["fecha_hora_inicio"]) == nuevo
    assert data["estado"] == "confirmado"


def test_reprogramar_turno_a_tipo_mas_largo_sobre_su_propio_horario_devuelve_200(
    client, session
) -> None:
    s = _setup(client, session)
    turno_id = _crear(client, s, inicio=_proximo(0, 9)).json()["id"]
    response = client.patch(
        f"/api/agenda/turnos/{turno_id}", json={"tipo_turno_id": s["tipos"]["cirugia"].id}
    )
    assert response.status_code == 200
    data = response.json()
    fin = _dt(data["fecha_hora_fin"])
    assert fin == _proximo(0, 10, 30)


def test_reprogramar_turno_a_horario_ocupado_devuelve_409(client, session) -> None:
    s = _setup(client, session)
    assert _crear(client, s, inicio=_proximo(0, 9)).status_code == 201
    turno_id = _crear(client, s, inicio=_proximo(0, 10), mascota="m2").json()["id"]
    response = client.patch(
        f"/api/agenda/turnos/{turno_id}", json={"fecha_hora_inicio": _proximo(0, 9).isoformat()}
    )
    assert response.status_code == 409


def test_reprogramar_turno_cancelado_devuelve_400(client, session) -> None:
    s = _setup(client, session)
    turno_id = _crear(client, s, inicio=_proximo(0, 9)).json()["id"]
    client.post(f"/api/agenda/turnos/{turno_id}/cancelar")
    response = client.patch(
        f"/api/agenda/turnos/{turno_id}", json={"fecha_hora_inicio": _proximo(1, 9).isoformat()}
    )
    assert response.status_code == 400
    assert response.json()["error"] == "TURNO_NO_REPROGRAMABLE"


def test_reprogramar_turno_sin_datos_devuelve_422(client, session) -> None:
    s = _setup(client, session)
    turno_id = _crear(client, s, inicio=_proximo(0, 9)).json()["id"]
    response = client.patch(f"/api/agenda/turnos/{turno_id}", json={})
    assert response.status_code == 422


# ---------------------------------------------------------------------------
# Consultas
# ---------------------------------------------------------------------------


def test_listar_turnos_filtra_por_rango_y_veterinario(client, session) -> None:
    s = _setup(client, session)
    _crear(client, s, inicio=_proximo(0, 9))
    _crear(client, s, inicio=_proximo(0, 9), vet="vet2", mascota="m2")
    _crear(client, s, inicio=_proximo(2, 9))  # otro día, fuera del rango
    lunes = _proximo(0, 0)
    params = {"desde": lunes.isoformat(), "hasta": (lunes + timedelta(days=1)).isoformat()}

    todos = client.get("/api/agenda/turnos", params=params)
    assert todos.status_code == 200
    assert len(todos.json()["items"]) == 2

    solo_vet1 = client.get("/api/agenda/turnos", params={**params, "veterinario_id": s["vet1"].id})
    assert [t["veterinario_id"] for t in solo_vet1.json()["items"]] == [s["vet1"].id]


def test_listar_turnos_rango_mayor_a_62_dias_devuelve_400(client, session) -> None:
    _setup(client, session)
    response = client.get(
        "/api/agenda/turnos",
        params={"desde": "2030-01-01T00:00:00", "hasta": "2030-04-01T00:00:00"},
    )
    assert response.status_code == 400
    assert response.json()["error"] == "RANGO_DEMASIADO_AMPLIO"


def test_get_turno_inexistente_devuelve_404(client, session) -> None:
    _setup(client, session)
    response = client.get("/api/agenda/turnos/9999")
    assert response.status_code == 404


def test_listar_veterinarios_excluye_comodin_deshabilitados_y_sin_permiso(client, session) -> None:
    s = _setup(client, session)
    _seed_usuario(session, username="admin", permisos=["*"], rol_nombre="ADMIN")
    _seed_usuario(
        session,
        username="vet_baja",
        permisos=["agenda:atender"],
        rol_nombre="VETERINARIO",
        habilitado=False,
    )
    response = client.get("/api/agenda/veterinarios")
    assert response.status_code == 200
    ids = {v["id"] for v in response.json()}
    assert ids == {s["vet1"].id, s["vet2"].id}


def test_listar_tipos_turno_devuelve_solo_activos(client, session) -> None:
    _setup(client, session)
    response = client.get("/api/agenda/tipos-turno")
    assert response.status_code == 200
    assert {t["nombre"] for t in response.json()} == {"Consulta", "Cirugía"}


def test_buscar_mascotas_por_apellido_del_tutor(client, session) -> None:
    _setup(client, session)
    response = client.get("/api/agenda/mascotas", params={"q": "lope"})
    assert response.status_code == 200
    assert [m["nombre"] for m in response.json()] == ["Michi"]


def test_horario_devuelve_franjas_por_defecto(client, session) -> None:
    _setup(client, session)
    response = client.get("/api/agenda/horario")
    assert response.status_code == 200
    data = response.json()
    assert data["duracion_modulo_min"] == 30
    dias = {d["dia_semana"]: d["franjas"] for d in data["dias"]}
    assert dias[0] == [{"desde": "08:00", "hasta": "12:00"}, {"desde": "15:00", "hasta": "20:00"}]
    assert dias[5] == [{"desde": "08:00", "hasta": "12:00"}]
    assert dias[6] == []


def _disponibilidad(client, s: dict, *, fecha, tipo: str = "consulta", **extra):
    response = client.get(
        "/api/agenda/disponibilidad",
        params={
            "veterinario_id": s["vet1"].id,
            "fecha": fecha.isoformat(),
            "tipo_turno_id": s["tipos"][tipo].id,
            **extra,
        },
    )
    assert response.status_code == 200
    return response.json()["franjas"]


def _por_inicio(franjas: list[dict]) -> dict[datetime, dict]:
    return {_dt(f["fecha_hora_inicio"]): f for f in franjas}


def test_disponibilidad_devuelve_todos_los_modulos_y_marca_ocupado_por_veterinario(
    client, session
) -> None:
    s = _setup(client, session)
    _crear(client, s, inicio=_proximo(0, 9))
    franjas = _disponibilidad(client, s, fecha=_proximo(0, 0).date())
    # 8 módulos a la mañana + 10 a la tarde: se devuelven todos, libres o no.
    assert len(franjas) == 18
    assert sum(f["disponible"] for f in franjas) == 17
    ocupada = _por_inicio(franjas)[_proximo(0, 9)]
    assert ocupada["disponible"] is False
    assert ocupada["motivo"] == "OCUPADO_VETERINARIO"
    assert "Firulais" in ocupada["detalle"] and "Laura Perez" in ocupada["detalle"]
    libre = _por_inicio(franjas)[_proximo(0, 8, 30)]
    assert libre["disponible"] is True and libre["motivo"] is None


def test_disponibilidad_cirugia_marca_inicios_que_exceden_la_franja(client, session) -> None:
    s = _setup(client, session)
    franjas = _disponibilidad(client, s, fecha=_proximo(0, 0).date(), tipo="cirugia")
    assert len(franjas) == 18
    # Mañana: 08:00..10:30 entran (6). Tarde: 15:00..18:30 entran (8).
    assert sum(f["disponible"] for f in franjas) == 14
    excede = _por_inicio(franjas)[_proximo(0, 11)]
    assert excede["motivo"] == "EXCEDE_HORARIO"
    assert "12:30" in excede["detalle"] and "12:00" in excede["detalle"]


def test_disponibilidad_con_mascota_marca_turno_de_la_mascota_con_otro_veterinario(
    client, session
) -> None:
    s = _setup(client, session)
    _crear(client, s, inicio=_proximo(0, 10), vet="vet2")
    franjas = _disponibilidad(
        client, s, fecha=_proximo(0, 0).date(), mascota_id=s["m1"].id
    )
    ocupada = _por_inicio(franjas)[_proximo(0, 10)]
    assert ocupada["motivo"] == "OCUPADO_MASCOTA"
    assert "Firulais" in ocupada["detalle"] and "Martin Diaz" in ocupada["detalle"]


def test_disponibilidad_sin_mascota_no_considera_turnos_de_otros_veterinarios(
    client, session
) -> None:
    s = _setup(client, session)
    _crear(client, s, inicio=_proximo(0, 10), vet="vet2")
    franjas = _disponibilidad(client, s, fecha=_proximo(0, 0).date())
    assert _por_inicio(franjas)[_proximo(0, 10)]["disponible"] is True


def test_disponibilidad_excluir_turno_libera_su_propio_horario(client, session) -> None:
    s = _setup(client, session)
    turno_id = _crear(client, s, inicio=_proximo(0, 9)).json()["id"]
    franjas = _disponibilidad(
        client, s, fecha=_proximo(0, 0).date(), excluir_turno_id=turno_id
    )
    assert _por_inicio(franjas)[_proximo(0, 9)]["disponible"] is True


def test_disponibilidad_dia_pasado_marca_todo_como_pasado(client, session) -> None:
    s = _setup(client, session)
    dia = datetime.now(TZ).date() - timedelta(days=1)
    while dia.weekday() > 4:  # último día hábil (lunes a viernes) anterior a hoy
        dia -= timedelta(days=1)
    franjas = _disponibilidad(client, s, fecha=dia)
    assert len(franjas) == 18
    assert {f["motivo"] for f in franjas} == {"PASADO"}


def test_disponibilidad_domingo_devuelve_lista_vacia(client, session) -> None:
    s = _setup(client, session)
    assert _disponibilidad(client, s, fecha=_proximo(6, 0).date()) == []
