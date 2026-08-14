from datetime import datetime

from sqlalchemy.orm import Mapped
from sqlmodel import Field, Relationship, SQLModel


class HistorialContrasena(SQLModel, table=True):
    __tablename__ = "historial_contrasena"
    __table_args__ = {"schema": "auth"}

    id: int | None = Field(default=None, primary_key=True)
    usuario_id: int = Field(foreign_key="auth.usuario.id", nullable=False)
    hashed_password: str = Field(max_length=255, nullable=False)
    fecha_creacion: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    debe_cambiar: bool = Field(default=False, nullable=False)

    usuario: Mapped["Usuario"] = Relationship(back_populates="historial_contrasenas")
