from __future__ import annotations

from functools import lru_cache

from sqlmodel import Session, select

from app.core.errors import APIError
from app.db.session import get_engine
from app.models.sys.config import Config


@lru_cache(maxsize=1)
def _load_config_index() -> dict[tuple[int, int], str]:
    from sqlmodel import Session

    with Session(get_engine()) as session:
        rows = session.exec(select(Config)).all()
        return {(row.config_id, row.parametro_id): row.parametro_valor for row in rows}


def clear_config_cache() -> None:
    _load_config_index.cache_clear()


def get_config_value(config_id: int, parametro_id: int, default: str | None = None) -> str:
    value = _load_config_index().get((config_id, parametro_id))
    if value is None:
        if default is None:
            raise APIError(500, "CONFIG_NO_ENCONTRADA", "No se encontró la configuración solicitada")
        return default
    return value


def get_public_razon_social() -> str:
    return get_config_value(2, 1, default="Yacanvet")


def get_access_token_expiration_minutes() -> int:
    return int(get_config_value(1, 1, default="15"))


def get_refresh_token_expiration_minutes() -> int:
    return int(get_config_value(1, 2, default="1440"))

