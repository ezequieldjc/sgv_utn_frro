from __future__ import annotations

from functools import lru_cache

from sqlalchemy import create_engine
from sqlalchemy.engine import Engine
from sqlalchemy.pool import StaticPool
from sqlmodel import Session

from app.core.settings import get_settings

SCHEMA_TRANSLATION_MAP = {"auth": None, "core": None, "sys": None}


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

    return create_engine(database_url, pool_pre_ping=True)


def get_session() -> Session:
    return Session(get_engine())

