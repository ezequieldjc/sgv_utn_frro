from __future__ import annotations

from functools import lru_cache

from sqlmodel import Session, col, select

from app.core.errors import APIError
from app.db.session import get_engine
from app.models.sys.config import Config
from app.schemas.config import ConfigItem, ConfigValorUpdate

INTEGER_PARAMETROS = frozenset(
    {
        "ACCESS_TOKEN_EXPIRACION",
        "REFRESH_TOKEN_EXPIRACION",
        "PERSONA_ID_TUTOR_EVENTUAL",
    }
)


def normalize_and_validate_parametro_valor(parametro_nombre: str, raw_valor: str) -> str:
    valor = raw_valor.strip()
    if not valor:
        raise APIError(400, "VALOR_INVALIDO", "El valor del parámetro no puede estar vacío")
    if len(valor) > 255:
        raise APIError(400, "VALOR_INVALIDO", "El valor del parámetro supera los 255 caracteres")

    if parametro_nombre in INTEGER_PARAMETROS:
        try:
            numero = int(valor)
        except ValueError as exc:
            raise APIError(
                400,
                "VALOR_INVALIDO",
                f"El parámetro '{parametro_nombre}' debe ser un entero positivo",
            ) from exc
        if numero < 1:
            raise APIError(
                400,
                "VALOR_INVALIDO",
                f"El parámetro '{parametro_nombre}' debe ser un entero >= 1",
            )
        return str(numero)

    return valor


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


def get_parametro_valor_por_nombre(
    session: Session, parametro_nombre: str, *, default: str | None = None
) -> str:
    row = session.exec(
        select(Config).where(Config.parametro_nombre == parametro_nombre)
    ).first()
    if row is None:
        if default is None:
            raise APIError(
                500,
                "CONFIG_NO_ENCONTRADA",
                f"No se encontró el parámetro de configuración '{parametro_nombre}'",
            )
        return default
    return row.parametro_valor


def _to_item(row: Config) -> ConfigItem:
    return ConfigItem(
        id=row.id or 0,
        config_id=row.config_id,
        config_nombre=row.config_nombre,
        parametro_id=row.parametro_id,
        parametro_nombre=row.parametro_nombre,
        parametro_valor=row.parametro_valor,
    )


def list_all_configs(session: Session) -> list[ConfigItem]:
    rows = session.exec(
        select(Config).order_by(col(Config.config_nombre), col(Config.parametro_id))
    ).all()
    return [_to_item(row) for row in rows]


def update_config_valor(session: Session, config_pk: int, payload: ConfigValorUpdate) -> ConfigItem:
    row = session.get(Config, config_pk)
    if row is None:
        raise APIError(404, "CONFIG_NO_ENCONTRADA", "No se encontró la configuración solicitada")

    normalized = normalize_and_validate_parametro_valor(row.parametro_nombre, payload.parametro_valor)
    row.parametro_valor = normalized
    session.add(row)
    session.commit()
    session.refresh(row)
    clear_config_cache()
    return _to_item(row)
