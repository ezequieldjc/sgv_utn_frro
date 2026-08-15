#!/usr/bin/env python3
"""
Seed script: crea rol admin, persona, usuario admin, historial_contrasena y registros mínimos en sys.config.
Usar desde backend/: python -m venv .venv; source .venv/bin/activate; pip install -r requirements.txt; python scripts/seed_admin.py
"""
import os
import sys
from datetime import date

from passlib.context import CryptContext
from sqlmodel import Session, select, create_engine

# Ajustar path para importar app
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT not in sys.path:
    sys.path.insert(0, ROOT)

from app.models.core.persona import Persona
from app.models.auth.rol import Rol
from app.models.auth.usuario import Usuario
from app.models.auth.historial_contrasena import HistorialContrasena
from app.models.sys.config import Config

# Cargar .env desde backend/.env si existe
from dotenv import load_dotenv
load_dotenv(os.path.join(ROOT, '.env'))

DATABASE_URL = os.getenv("DATABASE_URL")
if not DATABASE_URL:
    print("ERROR: DATABASE_URL no encontrado en el entorno. Setealo en backend/.env o exportalo antes de ejecutar.")
    sys.exit(1)

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

engine = create_engine(DATABASE_URL)

print("Conectando a:", DATABASE_URL)

with Session(engine) as session:
    # crear esquemas/tablas si faltan (seguro si alembic no se ejecutó)
    from sqlmodel import SQLModel

    SQLModel.metadata.create_all(engine)

    # 1) Rol admin
    stmt = select(Rol).where(Rol.nombre == "admin")
    admin_rol = session.exec(stmt).first()
    if not admin_rol:
        admin_rol = Rol(nombre="admin", descripcion="Administrador del sistema")
        session.add(admin_rol)
        session.commit()
        session.refresh(admin_rol)
        print("Rol admin creado, id=", admin_rol.id)
    else:
        print("Rol admin ya existe, id=", admin_rol.id)

    # 2) Persona
    default_dni = os.getenv('ADMIN_DNI', '00000000')
    default_cel = os.getenv('ADMIN_CEL', '0000000000')
    admin_nombre = os.getenv('ADMIN_NOMBRE', 'Admin')
    admin_apellido = os.getenv('ADMIN_APELLIDO', 'Admin')

    stmt = select(Persona).where(Persona.dni == default_dni)
    persona = session.exec(stmt).first()
    if not persona:
        persona = Persona(
            nombre=admin_nombre,
            apellido=admin_apellido,
            dni=default_dni,
            sexo="M",
            fecha_nacimiento=date(1990, 1, 1),
            celular=default_cel,
        )
        session.add(persona)
        session.commit()
        session.refresh(persona)
        print("Persona creada, id=", persona.id)
    else:
        print("Persona existente id=", persona.id)

    # 3) Usuario
    admin_username = os.getenv('ADMIN_USERNAME', 'admin')
    stmt = select(Usuario).where(Usuario.username == admin_username)
    usuario = session.exec(stmt).first()
    if not usuario:
        usuario = Usuario(persona_id=persona.id, username=admin_username, habilitado=True, rol_id=admin_rol.id)
        session.add(usuario)
        session.commit()
        session.refresh(usuario)
        print("Usuario creado id=", usuario.id)
    else:
        print("Usuario existente id=", usuario.id)

    # 4) Historial de contrasena (hash)
    raw_password = os.getenv('ADMIN_PASSWORD')
    if not raw_password:
        print("ERROR: ADMIN_PASSWORD no encontrado en el entorno. Setealo antes de ejecutar para crear la contraseña del admin.")
        print("Si el usuario ya existe, podés crear el registro manualmente o exportar ADMIN_PASSWORD y volver a ejecutar.")
        sys.exit(1)

    stmt = select(HistorialContrasena).where(HistorialContrasena.usuario_id == usuario.id).order_by(HistorialContrasena.fecha_creacion.desc())
    existing = session.exec(stmt).first()
    if existing:
        print("Historial de contraseña ya existe para usuario", usuario.id)
    else:
        hashed = pwd_context.hash(raw_password)
        h = HistorialContrasena(usuario_id=usuario.id, hashed_password=hashed)
        session.add(h)
        session.commit()
        print("Historial de contraseña creado para usuario", usuario.id)

    # 5) Configuracion minima en sys.config
    # Usaremos config_id=1, parametro_id 1..3
    defaults = [
        (1, 'system', 1, 'razon_social', os.getenv('RAZON_SOCIAL', 'Mi Clínica')),
        (1, 'system', 2, 'access_token_expires_minutes', os.getenv('ACCESS_TOKEN_EXPIRES_MINUTES', '15')),
        (1, 'system', 3, 'refresh_token_expires_days', os.getenv('REFRESH_TOKEN_EXPIRES_DAYS', '7')),
    ]
    for cfg in defaults:
        config_id, config_nombre, parametro_id, parametro_nombre, parametro_valor = cfg
        stmt = select(Config).where(Config.config_id == config_id, Config.parametro_id == parametro_id)
        found = session.exec(stmt).first()
        if found:
            print(f"Config {parametro_nombre} ya existe: {found.parametro_valor}")
        else:
            c = Config(config_id=config_id, config_nombre=config_nombre, parametro_id=parametro_id, parametro_nombre=parametro_nombre, parametro_valor=parametro_valor)
            session.add(c)
            session.commit()
            print(f"Config creado {parametro_nombre}={parametro_valor}")

print("Seed completado.")
