from datetime import datetime

from sqlalchemy.orm import Mapped
from sqlmodel import Field, Relationship, SQLModel


class Login(SQLModel, table=True):
    __tablename__ = "login"
    __table_args__ = {"schema": "auth"}

    id: int | None = Field(default=None, primary_key=True)
    usuario_id: int | None = Field(default=None, foreign_key="auth.usuario.id")
    username_ingresado: str = Field(max_length=50, nullable=False)
    fecha: datetime = Field(default_factory=datetime.utcnow, nullable=False)
    exito: bool = Field(nullable=False)
    ip: str = Field(max_length=45, nullable=False)
    razon_fallo: str | None = Field(default=None, max_length=50)

    usuario: Mapped["Usuario"] = Relationship(back_populates="logins")
