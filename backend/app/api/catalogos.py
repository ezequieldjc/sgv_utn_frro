from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Cookie, Depends, Query, status
from sqlmodel import Session, SQLModel

from app.db.session import get_session
from app.models.catalogo.estado_reproductivo import EstadoReproductivo
from app.models.catalogo.habitat import Habitat
from app.models.catalogo.mascota_estado import MascotaEstado
from app.models.catalogo.pelaje import Pelaje
from app.models.catalogo.tamanio import Tamanio
from app.models.catalogo.temperamento import Temperamento
from app.schemas.catalogos import (
    CatalogoActivoUpdate,
    CatalogoConEspecieCreate,
    CatalogoConEspecieUpdate,
    CatalogoGlobalCreate,
    CatalogoGlobalUpdate,
    CatalogoItem,
    EspecieOpcion,
)
from app.services.authorization_service import require_permission
from app.services.catalogo_service import (
    create_catalogo_con_especie,
    create_catalogo_global,
    list_catalogo_con_especie,
    list_catalogo_global,
    list_especies_opciones,
    set_catalogo_activo,
    update_catalogo_con_especie,
    update_catalogo_global,
)

router = APIRouter(prefix="/api/catalogos", tags=["catalogos"])

ActivoQuery = Literal["true", "false", "all"]


@router.get("/especies-opciones", response_model=list[EspecieOpcion])
def get_especies_opciones(
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> list[EspecieOpcion]:
    require_permission(session, access_token, "catalogos:ver")
    return list_especies_opciones(session)


def _register_con_especie(path: str, model: type[SQLModel]) -> None:
    @router.get(f"/{path}", response_model=list[CatalogoItem])
    def list_items(
        q: str | None = Query(default=None),
        especie_id: int | None = Query(default=None),
        activo: ActivoQuery = Query(default="true"),
        access_token: str | None = Cookie(default=None),
        session: Session = Depends(get_session),
    ) -> list[CatalogoItem]:
        require_permission(session, access_token, "catalogos:ver")
        return list_catalogo_con_especie(
            session, model, q=q, especie_id=especie_id, activo=activo
        )

    @router.post(f"/{path}", response_model=CatalogoItem, status_code=status.HTTP_201_CREATED)
    def create_item(
        body: CatalogoConEspecieCreate,
        access_token: str | None = Cookie(default=None),
        session: Session = Depends(get_session),
    ) -> CatalogoItem:
        require_permission(session, access_token, "catalogos:crear")
        return create_catalogo_con_especie(session, model, body)

    @router.put(f"/{path}/{{item_id}}", response_model=CatalogoItem)
    def update_item(
        item_id: int,
        body: CatalogoConEspecieUpdate,
        access_token: str | None = Cookie(default=None),
        session: Session = Depends(get_session),
    ) -> CatalogoItem:
        require_permission(session, access_token, "catalogos:editar")
        return update_catalogo_con_especie(session, model, item_id, body)

    @router.patch(f"/{path}/{{item_id}}/activo", response_model=CatalogoItem)
    def patch_activo(
        item_id: int,
        body: CatalogoActivoUpdate,
        access_token: str | None = Cookie(default=None),
        session: Session = Depends(get_session),
    ) -> CatalogoItem:
        if body.activo:
            require_permission(session, access_token, "catalogos:editar")
        else:
            require_permission(session, access_token, "catalogos:eliminar")
        return set_catalogo_activo(
            session, model, item_id, body.activo, con_especie=True
        )

    list_items.__name__ = f"list_{path.replace('-', '_')}"
    create_item.__name__ = f"create_{path.replace('-', '_')}"
    update_item.__name__ = f"update_{path.replace('-', '_')}"
    patch_activo.__name__ = f"patch_{path.replace('-', '_')}_activo"


def _register_global(path: str, model: type[SQLModel]) -> None:
    @router.get(f"/{path}", response_model=list[CatalogoItem])
    def list_items(
        q: str | None = Query(default=None),
        activo: ActivoQuery = Query(default="true"),
        access_token: str | None = Cookie(default=None),
        session: Session = Depends(get_session),
    ) -> list[CatalogoItem]:
        require_permission(session, access_token, "catalogos:ver")
        return list_catalogo_global(session, model, q=q, activo=activo)

    @router.post(f"/{path}", response_model=CatalogoItem, status_code=status.HTTP_201_CREATED)
    def create_item(
        body: CatalogoGlobalCreate,
        access_token: str | None = Cookie(default=None),
        session: Session = Depends(get_session),
    ) -> CatalogoItem:
        require_permission(session, access_token, "catalogos:crear")
        return create_catalogo_global(session, model, body)

    @router.put(f"/{path}/{{item_id}}", response_model=CatalogoItem)
    def update_item(
        item_id: int,
        body: CatalogoGlobalUpdate,
        access_token: str | None = Cookie(default=None),
        session: Session = Depends(get_session),
    ) -> CatalogoItem:
        require_permission(session, access_token, "catalogos:editar")
        return update_catalogo_global(session, model, item_id, body)

    @router.patch(f"/{path}/{{item_id}}/activo", response_model=CatalogoItem)
    def patch_activo(
        item_id: int,
        body: CatalogoActivoUpdate,
        access_token: str | None = Cookie(default=None),
        session: Session = Depends(get_session),
    ) -> CatalogoItem:
        if body.activo:
            require_permission(session, access_token, "catalogos:editar")
        else:
            require_permission(session, access_token, "catalogos:eliminar")
        return set_catalogo_activo(
            session, model, item_id, body.activo, con_especie=False
        )

    list_items.__name__ = f"list_{path.replace('-', '_')}"
    create_item.__name__ = f"create_{path.replace('-', '_')}"
    update_item.__name__ = f"update_{path.replace('-', '_')}"
    patch_activo.__name__ = f"patch_{path.replace('-', '_')}_activo"


_register_con_especie("habitats", Habitat)
_register_con_especie("tamanios", Tamanio)
_register_con_especie("pelajes", Pelaje)
_register_con_especie("temperamentos", Temperamento)
_register_con_especie("estados-reproductivos", EstadoReproductivo)
_register_global("mascota-estados", MascotaEstado)
