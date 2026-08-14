from __future__ import annotations

from sqlalchemy import UniqueConstraint
from sqlmodel import Field, SQLModel


class Config(SQLModel, table=True):
    __tablename__ = "config"
    __table_args__ = (
        UniqueConstraint("config_id", "parametro_id", name="UQ_Config_IDID"),
        {"schema": "sys"},
    )

    id: int | None = Field(default=None, primary_key=True)
    config_id: int = Field(nullable=False)
    config_nombre: str = Field(max_length=100, nullable=False)
    parametro_id: int = Field(nullable=False)
    parametro_nombre: str = Field(max_length=100, nullable=False)
    parametro_valor: str = Field(max_length=255, nullable=False)
