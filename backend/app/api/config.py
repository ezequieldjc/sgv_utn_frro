from __future__ import annotations

from fastapi import APIRouter, Cookie, Depends
from sqlmodel import Session

from app.core.errors import APIError
from app.db.session import get_session
from app.schemas.config import ConfigItem, ConfigValorUpdate, PublicConfigResponse
from app.services.authorization_service import get_current_authenticated_session
from app.services.config_service import (
    get_public_razon_social,
    list_all_configs,
    update_config_valor,
)
from app.services.permission_service import has_permission

router = APIRouter(prefix="/api/config", tags=["config"])


@router.get("/public", response_model=PublicConfigResponse)
def get_public_config() -> PublicConfigResponse:
    return PublicConfigResponse(razon_social=get_public_razon_social())


@router.get("", response_model=list[ConfigItem])
def get_configs(
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> list[ConfigItem]:
    current = get_current_authenticated_session(session, access_token)
    if not has_permission(current.permisos, "parametros:ver"):
        raise APIError(403, "PERMISOS_INSUFICIENTES", "No tenés permisos para ejecutar esta acción")
    return list_all_configs(session)


@router.patch("/{config_pk}", response_model=ConfigItem)
def patch_config_valor(
    config_pk: int,
    payload: ConfigValorUpdate,
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> ConfigItem:
    current = get_current_authenticated_session(session, access_token)
    if not has_permission(current.permisos, "parametros:editar"):
        raise APIError(403, "PERMISOS_INSUFICIENTES", "No tenés permisos para ejecutar esta acción")
    return update_config_valor(session, config_pk, payload)
