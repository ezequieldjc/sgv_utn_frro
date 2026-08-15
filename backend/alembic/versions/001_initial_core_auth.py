"""initial core auth sys with domicilio and fecha_nacimiento

Revision ID: 001_initial_core_auth
Revises:
Create Date: 2026-08-14

Baseline del schema actual (core + auth + sys), incluyendo core.domicilio,
persona.fecha_nacimiento, persona.sexo obligatorio y persona.domicilio_id.

Si la base ya tiene estas tablas/columnas (creadas a mano), no corras upgrade:
usá `alembic stamp head` para marcar esta revisión como aplicada.
"""

from __future__ import annotations

from typing import Sequence, Union

import sqlalchemy as sa
from alembic import op

revision: str = "001_initial_core_auth"
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.execute("CREATE SCHEMA IF NOT EXISTS core")
    op.execute("CREATE SCHEMA IF NOT EXISTS auth")
    op.execute("CREATE SCHEMA IF NOT EXISTS sys")

    op.create_table(
        "domicilio",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("pais", sa.String(length=50), nullable=False),
        sa.Column("provincia", sa.String(length=50), nullable=False),
        sa.Column("ciudad", sa.String(length=50), nullable=False),
        sa.Column("cp", sa.String(length=10), nullable=False),
        sa.Column("calle", sa.String(length=100), nullable=False),
        sa.Column("altura", sa.String(length=10), nullable=False),
        sa.Column("departamento", sa.String(length=20), nullable=True),
        sa.Column("notas", sa.Text(), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        schema="core",
    )

    op.create_table(
        "persona",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nombre", sa.String(length=100), nullable=False),
        sa.Column("apellido", sa.String(length=100), nullable=False),
        sa.Column("dni", sa.String(length=20), nullable=False),
        sa.Column("sexo", sa.String(length=1), nullable=False),
        sa.Column("fecha_nacimiento", sa.Date(), nullable=False),
        sa.Column("domicilio_id", sa.Integer(), nullable=True),
        sa.Column("mail", sa.String(length=100), nullable=True),
        sa.Column("celular", sa.String(length=30), nullable=False),
        sa.Column("fecha_alta", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["domicilio_id"], ["core.domicilio.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("dni", name="UQ_Persona_DNI"),
        schema="core",
    )

    op.create_table(
        "rol",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nombre", sa.String(length=50), nullable=False),
        sa.Column("descripcion", sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("nombre", name="UQ_Rol_Nombre"),
        schema="auth",
    )

    op.create_table(
        "permiso",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("nombre", sa.String(length=50), nullable=False),
        sa.Column("descripcion", sa.String(length=255), nullable=True),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("nombre", name="UQ_Permiso_Nombre"),
        schema="auth",
    )

    op.create_table(
        "rol_permiso",
        sa.Column("rol_id", sa.Integer(), nullable=False),
        sa.Column("permiso_id", sa.Integer(), nullable=False),
        sa.ForeignKeyConstraint(["permiso_id"], ["auth.permiso.id"]),
        sa.ForeignKeyConstraint(["rol_id"], ["auth.rol.id"]),
        sa.PrimaryKeyConstraint("rol_id", "permiso_id"),
        schema="auth",
    )

    op.create_table(
        "usuario",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("persona_id", sa.Integer(), nullable=False),
        sa.Column("username", sa.String(length=50), nullable=False),
        sa.Column("habilitado", sa.Boolean(), nullable=False),
        sa.Column("rol_id", sa.Integer(), nullable=False),
        sa.Column("version_token", sa.Integer(), nullable=False),
        sa.Column("fecha_creacion", sa.DateTime(), nullable=False),
        sa.ForeignKeyConstraint(["persona_id"], ["core.persona.id"]),
        sa.ForeignKeyConstraint(["rol_id"], ["auth.rol.id"]),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("persona_id", name="UQ_Usuario_Persona"),
        sa.UniqueConstraint("username", name="UQ_Usuario_Username"),
        schema="auth",
    )

    op.create_table(
        "historial_contrasena",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("usuario_id", sa.Integer(), nullable=False),
        sa.Column("hashed_password", sa.String(length=255), nullable=False),
        sa.Column("fecha_creacion", sa.DateTime(), nullable=False),
        sa.Column("debe_cambiar", sa.Boolean(), nullable=False),
        sa.ForeignKeyConstraint(["usuario_id"], ["auth.usuario.id"]),
        sa.PrimaryKeyConstraint("id"),
        schema="auth",
    )

    op.create_table(
        "login",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("usuario_id", sa.Integer(), nullable=True),
        sa.Column("username_ingresado", sa.String(length=50), nullable=False),
        sa.Column("fecha", sa.DateTime(), nullable=False),
        sa.Column("exito", sa.Boolean(), nullable=False),
        sa.Column("ip", sa.String(length=45), nullable=False),
        sa.Column("razon_fallo", sa.String(length=50), nullable=True),
        sa.ForeignKeyConstraint(["usuario_id"], ["auth.usuario.id"]),
        sa.PrimaryKeyConstraint("id"),
        schema="auth",
    )

    op.create_table(
        "config",
        sa.Column("id", sa.Integer(), nullable=False),
        sa.Column("config_id", sa.Integer(), nullable=False),
        sa.Column("config_nombre", sa.String(length=100), nullable=False),
        sa.Column("parametro_id", sa.Integer(), nullable=False),
        sa.Column("parametro_nombre", sa.String(length=100), nullable=False),
        sa.Column("parametro_valor", sa.String(length=255), nullable=False),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("config_id", "parametro_id", name="UQ_Config_IDID"),
        schema="sys",
    )


def downgrade() -> None:
    op.drop_table("config", schema="sys")
    op.drop_table("login", schema="auth")
    op.drop_table("historial_contrasena", schema="auth")
    op.drop_table("usuario", schema="auth")
    op.drop_table("rol_permiso", schema="auth")
    op.drop_table("permiso", schema="auth")
    op.drop_table("rol", schema="auth")
    op.drop_table("persona", schema="core")
    op.drop_table("domicilio", schema="core")
