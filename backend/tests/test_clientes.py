from __future__ import annotations

from datetime import date

from sqlmodel import select

from app.core.security import hash_password
from app.models.auth.historial_contrasena import HistorialContrasena
from app.models.auth.permiso import Permiso
from app.models.auth.rol import Rol
from app.models.auth.rol_permiso import RolPermiso
from app.models.auth.usuario import Usuario
from app.models.core.domicilio import Domicilio
from app.models.core.persona import Persona
from app.models.sys.config import Config
from app.services.cliente_service import calcular_edad_truncada


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


def seed_usuario_con_permiso(
    session,
    *,
    username: str,
    password: str,
    nombre: str,
    apellido: str,
    dni: str,
    permiso_nombre: str,
    rol_nombre: str = "ADMIN",
) -> Usuario:
    persona = Persona(
        nombre=nombre,
        apellido=apellido,
        dni=dni,
        sexo="M",
        fecha_nacimiento=date(1990, 1, 1),
        celular="123456789",
        mail=f"{username}@example.com",
        es_cliente=False,
    )
    rol = session.exec(select(Rol).where(Rol.nombre == rol_nombre)).first()
    if rol is None:
        rol = Rol(nombre=rol_nombre, descripcion=rol_nombre)

    permiso = session.exec(select(Permiso).where(Permiso.nombre == permiso_nombre)).first()
    if permiso is None:
        permiso = Permiso(nombre=permiso_nombre, descripcion=permiso_nombre)

    usuario = Usuario(
        persona=persona,
        username=username,
        habilitado=True,
        rol=rol,
        version_token=1,
    )
    historial = HistorialContrasena(
        usuario=usuario,
        hashed_password=hash_password(password),
        debe_cambiar=False,
    )

    session.add_all([persona, rol, permiso, usuario, historial])
    session.commit()
    session.refresh(rol)
    session.refresh(permiso)
    session.refresh(usuario)

    existing_link = session.exec(
        select(RolPermiso).where(
            RolPermiso.rol_id == rol.id,
            RolPermiso.permiso_id == permiso.id,
        )
    ).first()
    if existing_link is None:
        session.add(RolPermiso(rol_id=rol.id or 0, permiso_id=permiso.id or 0))
        session.commit()

    return usuario


def seed_cliente(
    session,
    *,
    nombre: str,
    apellido: str,
    dni: str,
    fecha_nacimiento: date,
    ciudad: str | None = "Rosario",
    es_cliente: bool = True,
) -> Persona:
    domicilio = None
    if ciudad is not None:
        domicilio = Domicilio(
            pais="Argentina",
            provincia="Santa Fe",
            ciudad=ciudad,
            cp="2000",
            calle="San Martín",
            altura="100",
        )
        session.add(domicilio)
        session.flush()

    persona = Persona(
        nombre=nombre,
        apellido=apellido,
        dni=dni,
        sexo="F",
        fecha_nacimiento=fecha_nacimiento,
        celular="3415551234",
        domicilio_id=domicilio.id if domicilio else None,
        es_cliente=es_cliente,
    )
    session.add(persona)
    session.commit()
    session.refresh(persona)
    return persona


def test_calcular_edad_truncada() -> None:
    nacimiento = date(1989, 9, 10)
    assert calcular_edad_truncada(nacimiento, hoy=date(2026, 9, 9)) == 36
    assert calcular_edad_truncada(nacimiento, hoy=date(2026, 9, 10)) == 37


def test_list_clientes_sin_auth_devuelve_401(client, session) -> None:
    _seed_jwt_config(session)
    session.commit()

    response = client.get("/api/clientes")
    assert response.status_code == 401
    assert response.json()["error"] == "TOKEN_INVALIDO"


def test_list_clientes_sin_permiso_devuelve_403(client, session) -> None:
    _seed_jwt_config(session)
    seed_usuario_con_permiso(
        session,
        username="jperez",
        password="Secret123!",
        nombre="Juan",
        apellido="Pérez",
        dni="30111222",
        permiso_nombre="usuarios:ver",
    )

    login_response = client.post(
        "/api/auth/login",
        json={"username": "jperez", "password": "Secret123!"},
    )
    assert login_response.status_code == 200

    response = client.get("/api/clientes")
    assert response.status_code == 403
    assert response.json()["error"] == "PERMISOS_INSUFICIENTES"


def test_list_clientes_con_permiso_devuelve_solo_es_cliente_true(client, session) -> None:
    _seed_jwt_config(session)
    seed_usuario_con_permiso(
        session,
        username="admin",
        password="Secret123!",
        nombre="María",
        apellido="Gómez",
        dni="20111222",
        permiso_nombre="clientes:ver_listado",
    )
    cliente = seed_cliente(
        session,
        nombre="Ana",
        apellido="Ruiz",
        dni="40111222",
        fecha_nacimiento=date(1989, 9, 10),
        ciudad="Rosario",
        es_cliente=True,
    )
    seed_cliente(
        session,
        nombre="Pedro",
        apellido="SoloEmpleado",
        dni="50111222",
        fecha_nacimiento=date(1985, 1, 1),
        ciudad="Córdoba",
        es_cliente=False,
    )

    login_response = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "Secret123!"},
    )
    assert login_response.status_code == 200

    response = client.get("/api/clientes")
    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload, list)
    assert len(payload) == 1

    item = payload[0]
    assert item["id"] == cliente.id
    assert item["nombre"] == "Ana"
    assert item["apellido"] == "Ruiz"
    assert item["dni"] == "40111222"
    assert item["sexo"] == "F"
    assert item["celular"] == "3415551234"
    assert item["ciudad"] == "Rosario"
    assert item["edad"] == calcular_edad_truncada(date(1989, 9, 10))
    assert item["fecha_alta"] is not None


def test_list_clientes_con_wildcard_devuelve_200(client, session) -> None:
    _seed_jwt_config(session)
    seed_usuario_con_permiso(
        session,
        username="admin",
        password="Secret123!",
        nombre="María",
        apellido="Gómez",
        dni="20111222",
        permiso_nombre="*",
    )
    seed_cliente(
        session,
        nombre="Ana",
        apellido="Ruiz",
        dni="40111222",
        fecha_nacimiento=date(1995, 5, 20),
        ciudad=None,
        es_cliente=True,
    )

    login_response = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "Secret123!"},
    )
    assert login_response.status_code == 200

    response = client.get("/api/clientes")
    assert response.status_code == 200
    payload = response.json()
    assert len(payload) == 1
    assert payload[0]["ciudad"] is None
    assert payload[0]["edad"] == calcular_edad_truncada(date(1995, 5, 20))


def _cliente_create_payload(
    *,
    dni: str | None = "60111222",
    mail: str | None = "Laura@Example.com",
) -> dict:
    payload = {
        "nombre": "Laura",
        "apellido": "Martínez",
        "dni": dni,
        "fecha_nacimiento": "1990-03-15",
        "sexo": "F",
        "celular": "11 4444-5555",
        "domicilio": {
            "pais": "Argentina",
            "provincia": "Buenos Aires",
            "ciudad": "La Plata",
            "calle": "Calle 7",
            "altura": "500",
            "cp": "1900",
            "departamento": None,
            "notas": None,
        },
    }
    if mail is not None:
        payload["mail"] = mail
    return payload


def _login_recepcion(client, session, *, con_rol_cliente: bool = True) -> None:
    _seed_jwt_config(session)
    seed_usuario_con_permiso(
        session,
        username="admin",
        password="Secret123!",
        nombre="María",
        apellido="Gómez",
        dni="20111222",
        permiso_nombre="clientes:crear",
    )
    if con_rol_cliente:
        session.add(Rol(nombre="CLIENTE", descripcion="Cliente de la clínica"))
        session.commit()
    login_response = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "Secret123!"},
    )
    assert login_response.status_code == 200


def test_create_cliente_sin_auth_devuelve_401(client, session) -> None:
    _seed_jwt_config(session)
    session.commit()

    response = client.post("/api/clientes", json=_cliente_create_payload())
    assert response.status_code == 401
    assert response.json()["error"] == "TOKEN_INVALIDO"


def test_create_cliente_sin_permiso_devuelve_403(client, session) -> None:
    _seed_jwt_config(session)
    seed_usuario_con_permiso(
        session,
        username="viewer",
        password="Secret123!",
        nombre="Vista",
        apellido="Solo",
        dni="30111222",
        permiso_nombre="clientes:ver_listado",
    )

    login_response = client.post(
        "/api/auth/login",
        json={"username": "viewer", "password": "Secret123!"},
    )
    assert login_response.status_code == 200

    response = client.post("/api/clientes", json=_cliente_create_payload())
    assert response.status_code == 403
    assert response.json()["error"] == "PERMISOS_INSUFICIENTES"


def test_create_cliente_crea_siempre_usuario_cliente_con_mail_en_minusculas(
    client, session
) -> None:
    from app.core.security import verify_password

    _login_recepcion(client, session)

    response = client.post("/api/clientes", json=_cliente_create_payload())
    assert response.status_code == 201
    payload = response.json()
    assert payload["nombre"] == "Laura"
    assert payload["dni"] == "60111222"
    assert payload["username"] == "laura@example.com"
    assert "-" in payload["password_temporal"]

    persona = session.get(Persona, payload["id"])
    assert persona is not None
    assert persona.es_cliente is True
    assert persona.mail == "laura@example.com"
    assert persona.celular == "1144445555"
    assert persona.domicilio_id is not None

    usuario = session.exec(select(Usuario).where(Usuario.persona_id == persona.id)).one()
    assert usuario.username == "laura@example.com"
    assert usuario.habilitado is True
    rol = session.get(Rol, usuario.rol_id)
    assert rol is not None and rol.nombre == "CLIENTE"

    historial = session.exec(
        select(HistorialContrasena).where(HistorialContrasena.usuario_id == usuario.id)
    ).one()
    assert historial.debe_cambiar is True
    assert verify_password(payload["password_temporal"], historial.hashed_password)


def test_create_cliente_sin_mail_devuelve_422(client, session) -> None:
    _login_recepcion(client, session)

    response = client.post("/api/clientes", json=_cliente_create_payload(mail=None))
    assert response.status_code == 422
    assert session.exec(select(Persona).where(Persona.dni == "60111222")).first() is None


def test_create_cliente_mail_vacio_devuelve_422(client, session) -> None:
    _login_recepcion(client, session)

    response = client.post("/api/clientes", json=_cliente_create_payload(mail="   "))
    assert response.status_code == 422


def test_create_cliente_mail_de_otro_usuario_devuelve_409(client, session) -> None:
    _login_recepcion(client, session)
    primero = client.post("/api/clientes", json=_cliente_create_payload(dni="60111222"))
    assert primero.status_code == 201

    response = client.post(
        "/api/clientes",
        json=_cliente_create_payload(dni="60999888", mail="LAURA@example.com "),
    )
    assert response.status_code == 409
    assert response.json()["error"] == "MAIL_EN_USO"
    assert session.exec(select(Persona).where(Persona.dni == "60999888")).first() is None


def test_create_cliente_dni_duplicado_devuelve_409(client, session) -> None:
    _login_recepcion(client, session)
    seed_cliente(
        session,
        nombre="Ana",
        apellido="Ruiz",
        dni="60111222",
        fecha_nacimiento=date(1990, 1, 1),
    )

    response = client.post("/api/clientes", json=_cliente_create_payload(dni="60111222"))
    assert response.status_code == 409
    assert response.json()["error"] == "DNI_DUPLICADO"
    personas = session.exec(select(Persona).where(Persona.dni == "60111222")).all()
    assert len(personas) == 1


def test_create_cliente_sin_dni_ni_domicilio_persiste_nulls(client, session) -> None:
    _login_recepcion(client, session)

    payload = {
        "nombre": "Cliente",
        "apellido": "Rápido",
        "celular": "341 555-0000",
        "mail": "rapido@example.com",
    }
    response = client.post("/api/clientes", json=payload)

    assert response.status_code == 201
    body = response.json()
    assert body["dni"] is None
    persona = session.get(Persona, body["id"])
    assert persona is not None
    assert persona.dni is None
    assert persona.sexo is None
    assert persona.fecha_nacimiento is None
    assert persona.domicilio_id is None
    assert persona.celular == "3415550000"
    assert persona.es_cliente is True


def test_create_cliente_dos_sin_dni_no_se_consideran_duplicados(client, session) -> None:
    _login_recepcion(client, session)

    for mail in ("uno@example.com", "dos@example.com"):
        response = client.post(
            "/api/clientes",
            json={"nombre": "Sin", "apellido": "Dni", "celular": "341", "mail": mail},
        )
        assert response.status_code == 201


def test_create_cliente_sin_rol_cliente_devuelve_404(client, session) -> None:
    _login_recepcion(client, session, con_rol_cliente=False)

    response = client.post("/api/clientes", json=_cliente_create_payload())
    assert response.status_code == 404
    assert response.json()["error"] == "ROL_NO_ENCONTRADO"
    assert session.exec(select(Persona).where(Persona.dni == "60111222")).first() is None


def test_cliente_creado_puede_ingresar_con_el_mail_en_mayusculas(client, session) -> None:
    _login_recepcion(client, session)
    alta = client.post("/api/clientes", json=_cliente_create_payload()).json()

    response = client.post(
        "/api/auth/login",
        json={"username": "  LAURA@EXAMPLE.COM ", "password": alta["password_temporal"]},
    )
    # Contraseña temporal: entra al cambio obligatorio, que también acepta el mail en mayúsculas.
    assert response.status_code == 403
    assert response.json()["error"] == "DEBE_CAMBIAR_CONTRASENA"

    cambio = client.post(
        "/api/auth/cambiar-contrasena-obligatorio",
        json={
            "username": "Laura@Example.com",
            "password_actual": alta["password_temporal"],
            "password_nueva": "NuevaClave123",
        },
    )
    assert cambio.status_code == 200

    login = client.post(
        "/api/auth/login",
        json={"username": "LAURA@example.com", "password": "NuevaClave123"},
    )
    assert login.status_code == 200
    assert login.json()["usuario"]["username"] == "laura@example.com"
