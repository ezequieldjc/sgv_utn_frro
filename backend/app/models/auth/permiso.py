from sqlalchemy import UniqueConstraint
from sqlalchemy.orm import Mapped
from sqlmodel import Field, Relationship, SQLModel

from app.models.auth.rol_permiso import RolPermiso


class Permiso(SQLModel, table=True):
    __tablename__ = "permiso"
    __table_args__ = (
        UniqueConstraint("nombre", name="UQ_Permiso_Nombre"),
        {"schema": "auth"},
    )

    id: int | None = Field(default=None, primary_key=True)
    nombre: str = Field(max_length=50, nullable=False)
    descripcion: str | None = Field(default=None, max_length=255)

    roles: Mapped[list["Rol"]] = Relationship(back_populates="permisos", link_model=RolPermiso)
