from __future__ import annotations

from datetime import date, datetime, timedelta

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
    habilitado: bool = True,
) -> Usuario:
    persona = Persona(
        nombre=nombre,
        apellido=apellido,
        dni=dni,
        sexo="M",
        fecha_nacimiento=date(1990, 1, 1),
        celular="123456789",
        mail=f"{username}@example.com",
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
        habilitado=habilitado,
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


def test_list_usuarios_sin_auth_devuelve_401(client, session) -> None:
    _seed_jwt_config(session)
    session.commit()

    response = client.get("/api/usuarios")
    assert response.status_code == 401
    assert response.json()["error"] == "TOKEN_INVALIDO"


def test_list_usuarios_sin_permiso_usuarios_ver_devuelve_403(client, session) -> None:
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

    response = client.get("/api/usuarios")
    assert response.status_code == 403
    assert response.json()["error"] == "PERMISOS_INSUFICIENTES"


def test_list_usuarios_con_permiso_devuelve_200_y_ultimo_inicio(client, session) -> None:
    _seed_jwt_config(session)
    admin = seed_usuario_con_permiso(
        session,
        username="admin",
        password="Secret123!",
        nombre="María",
        apellido="Gómez",
        dni="20111222",
        permiso_nombre="usuarios:ver",
        rol_nombre="ADMIN",
    )
    otro = seed_usuario_con_permiso(
        session,
        username="nuevo",
        password="Secret123!",
        nombre="Ana",
        apellido="Ruiz",
        dni="40111222",
        permiso_nombre="usuarios:ver",
        rol_nombre="ADMIN",
    )

    login_fecha = datetime.utcnow() - timedelta(hours=1)
    session.add(
        Login(
            usuario_id=admin.id,
            username_ingresado="admin",
            fecha=login_fecha,
            exito=True,
            ip="127.0.0.1",
        )
    )
    session.add(
        Login(
            usuario_id=admin.id,
            username_ingresado="admin",
            fecha=login_fecha - timedelta(days=1),
            exito=False,
            ip="127.0.0.1",
            razon_fallo="CLAVE_INCORRECTA",
        )
    )
    session.commit()

    login_response = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "Secret123!"},
    )
    assert login_response.status_code == 200

    response = client.get("/api/usuarios")
    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload, list)
    assert len(payload) == 2

    by_username = {item["username"]: item for item in payload}
    assert set(by_username.keys()) == {"admin", "nuevo"}

    admin_item = by_username["admin"]
    assert admin_item["id"] == admin.id
    assert admin_item["nombre"] == "María"
    assert admin_item["apellido"] == "Gómez"
    assert admin_item["habilitado"] is True
    assert admin_item["rol_id"] == admin.rol_id
    assert admin_item["rol_nombre"] == "ADMIN"
    assert admin_item["ultimo_inicio_sesion"] is not None

    nuevo_item = by_username["nuevo"]
    assert nuevo_item["id"] == otro.id
    assert nuevo_item["ultimo_inicio_sesion"] is None


def test_patch_habilitado_sin_auth_devuelve_401(client, session) -> None:
    _seed_jwt_config(session)
    session.commit()

    response = client.patch("/api/usuarios/1/habilitado", json={"habilitado": False})
    assert response.status_code == 401
    assert response.json()["error"] == "TOKEN_INVALIDO"


def test_patch_habilitado_sin_permiso_usuarios_editar_devuelve_403(client, session) -> None:
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

    response = client.patch("/api/usuarios/1/habilitado", json={"habilitado": False})
    assert response.status_code == 403
    assert response.json()["error"] == "PERMISOS_INSUFICIENTES"


def test_patch_habilitado_id_inexistente_devuelve_404(client, session) -> None:
    _seed_jwt_config(session)
    seed_usuario_con_permiso(
        session,
        username="admin",
        password="Secret123!",
        nombre="María",
        apellido="Gómez",
        dni="20111222",
        permiso_nombre="usuarios:editar",
    )

    login_response = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "Secret123!"},
    )
    assert login_response.status_code == 200

    response = client.patch("/api/usuarios/99999/habilitado", json={"habilitado": False})
    assert response.status_code == 404
    assert response.json()["error"] == "USUARIO_NO_ENCONTRADO"


def test_patch_habilitado_inhabilitar_incrementa_version_token(client, session) -> None:
    _seed_jwt_config(session)
    admin = seed_usuario_con_permiso(
        session,
        username="admin",
        password="Secret123!",
        nombre="María",
        apellido="Gómez",
        dni="20111222",
        permiso_nombre="usuarios:editar",
    )
    target = seed_usuario_con_permiso(
        session,
        username="target",
        password="Secret123!",
        nombre="Ana",
        apellido="Ruiz",
        dni="40111222",
        permiso_nombre="usuarios:ver",
        rol_nombre="RECEPCION",
        habilitado=True,
    )
    assert target.version_token == 1

    login_response = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "Secret123!"},
    )
    assert login_response.status_code == 200

    disable_response = client.patch(
        f"/api/usuarios/{target.id}/habilitado",
        json={"habilitado": False},
    )
    assert disable_response.status_code == 200
    disable_payload = disable_response.json()
    assert disable_payload["id"] == target.id
    assert disable_payload["habilitado"] is False
    assert disable_payload["username"] == "target"

    session.refresh(target)
    assert target.habilitado is False
    assert target.version_token == 2

    enable_response = client.patch(
        f"/api/usuarios/{target.id}/habilitado",
        json={"habilitado": True},
    )
    assert enable_response.status_code == 200
    assert enable_response.json()["habilitado"] is True

    session.refresh(target)
    assert target.habilitado is True
    assert target.version_token == 2

    idempotent_response = client.patch(
        f"/api/usuarios/{target.id}/habilitado",
        json={"habilitado": True},
    )
    assert idempotent_response.status_code == 200
    assert idempotent_response.json()["habilitado"] is True
    session.refresh(target)
    assert target.version_token == 2
    assert admin.username == "admin"


def _usuario_create_payload(*, dni: str, rol_id: int, nombre: str = "Carlos", apellido: str = "López") -> dict:
    return {
        "nombre": nombre,
        "apellido": apellido,
        "dni": dni,
        "fecha_nacimiento": "1992-05-10",
        "sexo": "M",
        "celular": "11 5555-1234",
        "mail": "carlos@example.com",
        "domicilio": {
            "pais": "Argentina",
            "provincia": "Buenos Aires",
            "ciudad": "Rosario",
            "calle": "San Martín",
            "altura": "1234",
            "cp": "2000",
            "departamento": "A",
            "notas": None,
        },
        "rol_id": rol_id,
        "habilitado": True,
    }


def test_create_usuario_sin_auth_devuelve_401(client, session) -> None:
    _seed_jwt_config(session)
    session.commit()

    response = client.post("/api/usuarios", json=_usuario_create_payload(dni="50111222", rol_id=1))
    assert response.status_code == 401
    assert response.json()["error"] == "TOKEN_INVALIDO"


def test_create_usuario_sin_permiso_usuarios_crear_devuelve_403(client, session) -> None:
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

    response = client.post("/api/usuarios", json=_usuario_create_payload(dni="50111222", rol_id=1))
    assert response.status_code == 403
    assert response.json()["error"] == "PERMISOS_INSUFICIENTES"


def test_create_usuario_exitoso_persiste_historial_debe_cambiar(client, session) -> None:
    from app.core.security import verify_password

    _seed_jwt_config(session)
    admin = seed_usuario_con_permiso(
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

    response = client.post(
        "/api/usuarios",
        json=_usuario_create_payload(dni="50111222", rol_id=admin.rol_id or 0),
    )
    assert response.status_code == 201
    payload = response.json()
    assert payload["username"] == "clopez"
    assert payload["debe_cambiar"] is True
    assert isinstance(payload["password_temporal"], str)
    assert "-" in payload["password_temporal"]

    created = session.exec(select(Usuario).where(Usuario.id == payload["id"])).first()
    assert created is not None
    assert created.habilitado is True

    historial = session.exec(
        select(HistorialContrasena)
        .where(HistorialContrasena.usuario_id == created.id)
        .order_by(HistorialContrasena.fecha_creacion.desc())
    ).first()
    assert historial is not None
    assert historial.debe_cambiar is True
    assert verify_password(payload["password_temporal"], historial.hashed_password)

    persona = session.get(Persona, created.persona_id)
    assert persona is not None
    assert persona.dni == "50111222"
    assert persona.celular == "1155551234"
    assert persona.domicilio_id is not None


def test_create_usuario_dni_duplicado_devuelve_409(client, session) -> None:
    _seed_jwt_config(session)
    admin = seed_usuario_con_permiso(
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

    response = client.post(
        "/api/usuarios",
        json=_usuario_create_payload(dni="20111222", rol_id=admin.rol_id or 0),
    )
    assert response.status_code == 409
    assert response.json()["error"] == "DNI_DUPLICADO"


def test_create_usuario_rol_inexistente_devuelve_404(client, session) -> None:
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

    response = client.post(
        "/api/usuarios",
        json=_usuario_create_payload(dni="50111222", rol_id=99999),
    )
    assert response.status_code == 404
    assert response.json()["error"] == "ROL_NO_ENCONTRADO"


def test_create_usuario_username_colision_asigna_sufijo_numerico(client, session) -> None:
    _seed_jwt_config(session)
    admin = seed_usuario_con_permiso(
        session,
        username="clopez",
        password="Secret123!",
        nombre="Clara",
        apellido="López",
        dni="20111222",
        permiso_nombre="usuarios:crear",
    )

    login_response = client.post(
        "/api/auth/login",
        json={"username": "clopez", "password": "Secret123!"},
    )
    assert login_response.status_code == 200

    response = client.post(
        "/api/usuarios",
        json=_usuario_create_payload(dni="50111222", rol_id=admin.rol_id or 0),
    )
    assert response.status_code == 201
    assert response.json()["username"] == "clopez2"


def test_create_usuario_dni_no_numerico_devuelve_422(client, session) -> None:
    _seed_jwt_config(session)
    admin = seed_usuario_con_permiso(
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

    payload = _usuario_create_payload(dni="ABC123", rol_id=admin.rol_id or 0)
    response = client.post("/api/usuarios", json=payload)
    assert response.status_code == 422


def test_create_usuario_cp_no_numerico_devuelve_422(client, session) -> None:
    _seed_jwt_config(session)
    admin = seed_usuario_con_permiso(
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

    payload = _usuario_create_payload(dni="50111222", rol_id=admin.rol_id or 0)
    payload["domicilio"]["cp"] = "ABC"
    response = client.post("/api/usuarios", json=payload)
    assert response.status_code == 422


def test_create_usuario_mail_invalido_devuelve_422(client, session) -> None:
    _seed_jwt_config(session)
    admin = seed_usuario_con_permiso(
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

    payload = _usuario_create_payload(dni="50111222", rol_id=admin.rol_id or 0)
    payload["mail"] = "sin-arroba"
    response = client.post("/api/usuarios", json=payload)
    assert response.status_code == 422


def test_create_usuario_con_permiso_wildcard_devuelve_201(client, session) -> None:
    _seed_jwt_config(session)
    admin = seed_usuario_con_permiso(
        session,
        username="admin",
        password="Secret123!",
        nombre="María",
        apellido="Gómez",
        dni="20111222",
        permiso_nombre="*",
    )

    login_response = client.post(
        "/api/auth/login",
        json={"username": "admin", "password": "Secret123!"},
    )
    assert login_response.status_code == 200

    response = client.post(
        "/api/usuarios",
        json=_usuario_create_payload(dni="50111222", rol_id=admin.rol_id or 0),
    )
    assert response.status_code == 201
    assert response.json()["username"] == "clopez"
