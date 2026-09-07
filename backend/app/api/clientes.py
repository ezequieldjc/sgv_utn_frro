from __future__ import annotations

from fastapi import APIRouter, Cookie, Depends, status
from sqlmodel import Session

from app.db.session import get_session
from app.schemas.clientes import ClienteCreate, ClienteCreateResponse, ClienteListItem
from app.services.authorization_service import require_permission
from app.services.cliente_service import create_cliente, list_clientes

router = APIRouter(prefix="/api/clientes", tags=["clientes"])


@router.get("", response_model=list[ClienteListItem])
def get_clientes(
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> list[ClienteListItem]:
    require_permission(session, access_token, "clientes:ver_listado")
    return list_clientes(session)


@router.post("", response_model=ClienteCreateResponse, status_code=status.HTTP_201_CREATED)
def post_cliente(
    body: ClienteCreate,
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> ClienteCreateResponse:
    require_permission(session, access_token, "clientes:crear")
    return create_cliente(session, body)
