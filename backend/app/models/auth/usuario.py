from datetime import datetime

from sqlalchemy import UniqueConstraint
from sqlalchemy.orm import Mapped
from sqlmodel import Field, Relationship, SQLModel


class Usuario(SQLModel, table=True):
    __tablename__ = "usuario"
    __table_args__ = (
        UniqueConstraint("persona_id", name="UQ_Usuario_Persona"),
        UniqueConstraint("username", name="UQ_Usuario_Username"),
        {"schema": "auth"},
    )

    id: int | None = Field(default=None, primary_key=True)
    persona_id: int = Field(foreign_key="core.persona.id", nullable=False)
    username: str = Field(max_length=50, nullable=False)
    habilitado: bool = Field(default=False, nullable=False)
    rol_id: int = Field(foreign_key="auth.rol.id", nullable=False)
    version_token: int = Field(default=1, nullable=False)
    fecha_creacion: datetime = Field(default_factory=datetime.utcnow, nullable=False)

    persona: Mapped["Persona"] = Relationship(back_populates="usuario")
    rol: Mapped["Rol"] = Relationship(back_populates="usuarios")
    historial_contrasenas: Mapped[list["HistorialContrasena"]] = Relationship(back_populates="usuario")
    logins: Mapped[list["Login"]] = Relationship(back_populates="usuario")
