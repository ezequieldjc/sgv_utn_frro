from __future__ import annotations

from sqlmodel import select

from app.models.auth.permiso import Permiso
from app.models.auth.rol import Rol
from app.models.auth.rol_permiso import RolPermiso
from test_usuarios import _seed_jwt_config, seed_usuario_con_permiso


def _login(client, username: str, password: str = "Secret123!") -> None:
    response = client.post("/api/auth/login", json={"username": username, "password": password})
    assert response.status_code == 200


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

    _login(client, "jperez")

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

    _login(client, "viewer")

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

    _login(client, "admin")

    response = client.get("/api/roles")
    assert response.status_code == 200
    payload = response.json()
    assert isinstance(payload, list)
    assert len(payload) >= 1
    assert "id" in payload[0]
    assert "nombre" in payload[0]


def test_list_roles_con_permiso_roles_ver_devuelve_200(client, session) -> None:
    _seed_jwt_config(session)
    seed_usuario_con_permiso(
        session,
        username="rolesviewer",
        password="Secret123!",
        nombre="Roles",
        apellido="Viewer",
        dni="30111999",
        permiso_nombre="roles:ver",
        rol_nombre="EDITOR",
    )

    _login(client, "rolesviewer")

    response = client.get("/api/roles")
    assert response.status_code == 200
    assert isinstance(response.json(), list)


def test_get_rol_detalle_sin_roles_ver_devuelve_403(client, session) -> None:
    _seed_jwt_config(session)
    usuario = seed_usuario_con_permiso(
        session,
        username="viewer",
        password="Secret123!",
        nombre="Vista",
        apellido="Solo",
        dni="30111222",
        permiso_nombre="usuarios:ver",
    )

    _login(client, "viewer")

    response = client.get(f"/api/roles/{usuario.rol_id}")
    assert response.status_code == 403
    assert response.json()["error"] == "PERMISOS_INSUFICIENTES"


def test_get_rol_detalle_y_permisos_con_roles_ver_devuelve_200(client, session) -> None:
    _seed_jwt_config(session)
    usuario = seed_usuario_con_permiso(
        session,
        username="rolesviewer",
        password="Secret123!",
        nombre="Roles",
        apellido="Viewer",
        dni="30111999",
        permiso_nombre="roles:ver",
        rol_nombre="EDITOR",
    )
    permiso_extra = Permiso(nombre="mascotas:crear", descripcion="Crear mascota")
    session.add(permiso_extra)
    session.commit()
    session.refresh(permiso_extra)
    session.add(RolPermiso(rol_id=usuario.rol_id, permiso_id=permiso_extra.id or 0))
    session.commit()

    _login(client, "rolesviewer")

    detalle = client.get(f"/api/roles/{usuario.rol_id}")
    assert detalle.status_code == 200
    body = detalle.json()
    assert body["id"] == usuario.rol_id
    assert body["nombre"] == "EDITOR"
    assert body["es_admin"] is False
    assert body["acceso_total"] is False
    assert any(item["nombre"] == "roles:ver" for item in body["permisos"])
    assert any(item["nombre"] == "mascotas:crear" for item in body["permisos"])

    catalogo = client.get("/api/permisos")
    assert catalogo.status_code == 200
    nombres = {item["nombre"] for item in catalogo.json()}
    assert "roles:ver" in nombres
    assert "mascotas:crear" in nombres


def test_get_permisos_sin_roles_ver_devuelve_403(client, session) -> None:
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

    _login(client, "viewer")

    response = client.get("/api/permisos")
    assert response.status_code == 403
    assert response.json()["error"] == "PERMISOS_INSUFICIENTES"


def test_post_rol_sin_roles_crear_devuelve_403(client, session) -> None:
    _seed_jwt_config(session)
    seed_usuario_con_permiso(
        session,
        username="rolesviewer",
        password="Secret123!",
        nombre="Roles",
        apellido="Viewer",
        dni="30111999",
        permiso_nombre="roles:ver",
        rol_nombre="EDITOR",
    )

    _login(client, "rolesviewer")

    response = client.post("/api/roles", json={"nombre": "CEO", "descripcion": "Dirección"})
    assert response.status_code == 403
    assert response.json()["error"] == "PERMISOS_INSUFICIENTES"


def test_post_rol_con_roles_crear_devuelve_201(client, session) -> None:
    _seed_jwt_config(session)
    seed_usuario_con_permiso(
        session,
        username="rolescreator",
        password="Secret123!",
        nombre="Roles",
        apellido="Creator",
        dni="30111888",
        permiso_nombre="roles:crear",
        rol_nombre="EDITOR",
    )

    _login(client, "rolescreator")

    response = client.post("/api/roles", json={"nombre": "CEO", "descripcion": "Dirección"})
    assert response.status_code == 201
    body = response.json()
    assert body["nombre"] == "CEO"
    assert body["descripcion"] == "Dirección"
    assert body["es_admin"] is False
    assert body["permisos"] == []


def test_post_rol_nombre_duplicado_devuelve_409(client, session) -> None:
    _seed_jwt_config(session)
    seed_usuario_con_permiso(
        session,
        username="rolescreator",
        password="Secret123!",
        nombre="Roles",
        apellido="Creator",
        dni="30111888",
        permiso_nombre="roles:crear",
        rol_nombre="EDITOR",
    )
    session.add(Rol(nombre="CEO", descripcion="Existente"))
    session.commit()

    _login(client, "rolescreator")

    response = client.post("/api/roles", json={"nombre": "CEO"})
    assert response.status_code == 409
    assert response.json()["error"] == "ROL_NOMBRE_DUPLICADO"


def test_post_rol_nombre_admin_devuelve_400_reservado(client, session) -> None:
    _seed_jwt_config(session)
    seed_usuario_con_permiso(
        session,
        username="rolescreator",
        password="Secret123!",
        nombre="Roles",
        apellido="Creator",
        dni="30111888",
        permiso_nombre="roles:crear",
        rol_nombre="EDITOR",
    )

    _login(client, "rolescreator")

    response = client.post("/api/roles", json={"nombre": "admin"})
    assert response.status_code == 400
    assert response.json()["error"] == "ROL_RESERVADO"


def test_put_rol_permisos_sin_roles_editar_devuelve_403(client, session) -> None:
    _seed_jwt_config(session)
    usuario = seed_usuario_con_permiso(
        session,
        username="rolesviewer",
        password="Secret123!",
        nombre="Roles",
        apellido="Viewer",
        dni="30111999",
        permiso_nombre="roles:ver",
        rol_nombre="EDITOR",
    )
    target = Rol(nombre="CLIENTE", descripcion="Cliente")
    session.add(target)
    session.commit()
    session.refresh(target)

    _login(client, "rolesviewer")

    response = client.put(f"/api/roles/{target.id}/permisos", json={"permiso_ids": []})
    assert response.status_code == 403
    assert response.json()["error"] == "PERMISOS_INSUFICIENTES"
    assert usuario.id is not None


def test_put_rol_permisos_sincroniza_matriz_y_bumpea_version_token(client, session) -> None:
    _seed_jwt_config(session)
    editor = seed_usuario_con_permiso(
        session,
        username="roleseditor",
        password="Secret123!",
        nombre="Roles",
        apellido="Editor",
        dni="30111777",
        permiso_nombre="roles:editar",
        rol_nombre="EDITOR",
    )
    target_rol = Rol(nombre="CLIENTE", descripcion="Cliente")
    session.add(target_rol)
    session.commit()
    session.refresh(target_rol)

    afectado = seed_usuario_con_permiso(
        session,
        username="cliente1",
        password="Secret123!",
        nombre="Cliente",
        apellido="Uno",
        dni="40111222",
        permiso_nombre="mascotas:ver_listado",
        rol_nombre="CLIENTE",
    )
    assert afectado.rol_id == target_rol.id
    assert afectado.version_token == 1

    permiso_a = session.exec(select(Permiso).where(Permiso.nombre == "mascotas:ver_listado")).one()
    permiso_b = Permiso(nombre="clientes:ver_listado", descripcion="Ver clientes")
    session.add(permiso_b)
    session.commit()
    session.refresh(permiso_b)

    _login(client, "roleseditor")

    response = client.put(
        f"/api/roles/{target_rol.id}/permisos",
        json={"permiso_ids": [permiso_a.id, permiso_b.id]},
    )
    assert response.status_code == 200
    body = response.json()
    nombres = {item["nombre"] for item in body["permisos"]}
    assert nombres == {"mascotas:ver_listado", "clientes:ver_listado"}

    session.refresh(afectado)
    assert afectado.version_token == 2

    links = session.exec(select(RolPermiso).where(RolPermiso.rol_id == target_rol.id)).all()
    assert {link.permiso_id for link in links} == {permiso_a.id, permiso_b.id}
    assert editor.id is not None


def test_put_rol_permisos_sobre_admin_devuelve_rol_admin_inmutable(client, session) -> None:
    _seed_jwt_config(session)
    seed_usuario_con_permiso(
        session,
        username="roleseditor",
        password="Secret123!",
        nombre="Roles",
        apellido="Editor",
        dni="30111777",
        permiso_nombre="roles:editar",
        rol_nombre="EDITOR",
    )
    admin_rol = session.exec(select(Rol).where(Rol.nombre == "ADMIN")).first()
    if admin_rol is None:
        admin_rol = Rol(nombre="ADMIN", descripcion="Administrador")
        session.add(admin_rol)
        session.commit()
        session.refresh(admin_rol)

    permiso = Permiso(nombre="mascotas:crear", descripcion="Crear")
    session.add(permiso)
    session.commit()
    session.refresh(permiso)

    _login(client, "roleseditor")

    response = client.put(
        f"/api/roles/{admin_rol.id}/permisos",
        json={"permiso_ids": [permiso.id]},
    )
    assert response.status_code == 403
    assert response.json()["error"] == "ROL_ADMIN_INMUTABLE"


def test_put_rol_permisos_con_comodin_devuelve_400(client, session) -> None:
    _seed_jwt_config(session)
    seed_usuario_con_permiso(
        session,
        username="roleseditor",
        password="Secret123!",
        nombre="Roles",
        apellido="Editor",
        dni="30111777",
        permiso_nombre="roles:editar",
        rol_nombre="EDITOR",
    )
    target = Rol(nombre="CEO", descripcion="Dirección")
    session.add(target)
    session.commit()
    session.refresh(target)

    comodín = Permiso(nombre="*", descripcion="Acceso total")
    session.add(comodín)
    session.commit()
    session.refresh(comodín)

    _login(client, "roleseditor")

    response = client.put(
        f"/api/roles/{target.id}/permisos",
        json={"permiso_ids": [comodín.id]},
    )
    assert response.status_code == 400
    assert response.json()["error"] == "COMODIN_NO_PERMITIDO"
