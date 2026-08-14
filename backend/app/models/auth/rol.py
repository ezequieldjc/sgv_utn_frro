from sqlalchemy import UniqueConstraint
from sqlalchemy.orm import Mapped
from sqlmodel import Field, Relationship, SQLModel

from app.models.auth.rol_permiso import RolPermiso


class Rol(SQLModel, table=True):
    __tablename__ = "rol"
    __table_args__ = (
        UniqueConstraint("nombre", name="UQ_Rol_Nombre"),
        {"schema": "auth"},
    )

    id: int | None = Field(default=None, primary_key=True)
    nombre: str = Field(max_length=50, nullable=False)
    descripcion: str | None = Field(default=None, max_length=255)

    usuarios: Mapped[list["Usuario"]] = Relationship(back_populates="rol")
    permisos: Mapped[list["Permiso"]] = Relationship(back_populates="roles", link_model=RolPermiso)
