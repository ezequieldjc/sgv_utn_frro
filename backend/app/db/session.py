from __future__ import annotations

from collections.abc import Generator
from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.pool import StaticPool
from sqlmodel import Session

from app.core.settings import get_settings

SCHEMA_TRANSLATION_MAP = {
    "auth": None,
    "core": None,
    "sys": None,
    "catalogo": None,
    "clinica": None,
}


@lru_cache(maxsize=1)
def get_engine() -> Engine:
    database_url = get_settings().database_url
    if database_url.startswith("sqlite"):
        engine = create_engine(
            database_url,
            connect_args={"check_same_thread": False},
            poolclass=StaticPool,
        )
        return engine.execution_options(schema_translate_map=SCHEMA_TRANSLATION_MAP)

    # pool_pre_ping evita conexiones muertas; pool acotado para fallar rápido
    # en vez de colgar toda la API si algo retiene conexiones.
    return create_engine(
        database_url,
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
        pool_timeout=30,
    )


def get_session() -> Generator[Session, None, None]:
    """Sesión por request: siempre se cierra al terminar (evita agotar el pool)."""
    with Session(get_engine()) as session:
        yield session
