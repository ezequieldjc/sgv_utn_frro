from __future__ import annotations

from fastapi import APIRouter

from app.schemas.config import PublicConfigResponse
from app.services.config_service import get_public_razon_social

router = APIRouter(prefix="/api/config", tags=["config"])


@router.get("/public", response_model=PublicConfigResponse)
def get_public_config() -> PublicConfigResponse:
    return PublicConfigResponse(razon_social=get_public_razon_social())

