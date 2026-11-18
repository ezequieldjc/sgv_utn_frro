from __future__ import annotations

from typing import Literal

from fastapi import APIRouter, Cookie, Depends, Query, Response, status
from sqlmodel import Session

from app.db.session import get_session
from app.schemas.agenda import MascotaAgendaOpcion
from app.schemas.consultas import (
    ConsultaCreate,
    ConsultaDetalle,
    ConsultaFirmar,
    ConsultaListResponse,
    ConsultaUpdate,
    DictadoCreate,
    PatologiaOpcion,
    SignoCreate,
    SignoUpdate,
    SintomaOpcion,
    SugerenciasResponse,
)
from app.services.authorization_service import require_any_permission, require_permission
from app.services.consulta_service import (
    actualizar_consulta,
    actualizar_signo,
    agregar_signo,
    crear_consulta,
    descartar_consulta,
    eliminar_signo,
    firmar_consulta,
    get_detalle,
    get_sugerencias,
    listar_consultas,
    listar_patologias,
    listar_sintomas,
    registrar_dictado,
)
from app.services.receta_service import generar_receta_pdf
from app.services.turno_service import buscar_mascotas

router = APIRouter(prefix="/api/consultas", tags=["consultas"])

# Quien atiende (abre, dicta y corrige el borrador).
PERMISOS_EDICION = ("consultas:crear", "consultas:editar_historia_clinica")
# Quien puede ver una consulta o la historia clínica.
PERMISOS_LECTURA = (
    "consultas:crear",
    "consultas:ver_historia_clinica",
    "consultas:ver_historial",
)
PERMISOS_HISTORIAL = ("consultas:ver_historial", "consultas:ver_historia_clinica")
# Quien puede descargar la receta de una consulta firmada.
PERMISOS_RECETA = (*PERMISOS_LECTURA, "recetas:crear", "recetas:ver_historial")


@router.get("/catalogos/sintomas", response_model=list[SintomaOpcion])
def get_catalogo_sintomas(
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> list[SintomaOpcion]:
    require_any_permission(session, access_token, *PERMISOS_LECTURA)
    return listar_sintomas(session)


@router.get("/mascotas", response_model=list[MascotaAgendaOpcion])
def get_mascotas_para_consulta(
    q: str = Query(default=""),
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> list[MascotaAgendaOpcion]:
    """Buscador de pacientes para abrir una consulta sin turno."""
    require_permission(session, access_token, "consultas:crear")
    return buscar_mascotas(session, q)


@router.get("/catalogos/patologias", response_model=list[PatologiaOpcion])
def get_catalogo_patologias(
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> list[PatologiaOpcion]:
    require_any_permission(session, access_token, *PERMISOS_LECTURA)
    return listar_patologias(session)


@router.get("", response_model=ConsultaListResponse)
def get_consultas(
    mascota_id: int | None = Query(default=None),
    estado: Literal["borrador", "firmada"] | None = Query(default=None),
    page: int = Query(default=1, ge=1),
    page_size: int = Query(default=50, ge=1, le=100),
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> ConsultaListResponse:
    require_any_permission(session, access_token, *PERMISOS_HISTORIAL)
    return listar_consultas(
        session, mascota_id=mascota_id, estado=estado, page=page, page_size=page_size
    )


@router.post("", response_model=ConsultaDetalle, status_code=status.HTTP_201_CREATED)
def post_consulta(
    body: ConsultaCreate,
    response: Response,
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> ConsultaDetalle:
    sesion = require_permission(session, access_token, "consultas:crear")
    detalle, creada = crear_consulta(session, body, sesion.usuario.id)
    if not creada:
        response.status_code = status.HTTP_200_OK
    return detalle


@router.get("/{consulta_id}", response_model=ConsultaDetalle)
def get_consulta(
    consulta_id: int,
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> ConsultaDetalle:
    require_any_permission(session, access_token, *PERMISOS_LECTURA)
    return get_detalle(session, consulta_id)


@router.patch("/{consulta_id}", response_model=ConsultaDetalle)
def patch_consulta(
    consulta_id: int,
    body: ConsultaUpdate,
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> ConsultaDetalle:
    require_any_permission(session, access_token, *PERMISOS_EDICION)
    return actualizar_consulta(session, consulta_id, body)


@router.delete("/{consulta_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_consulta(
    consulta_id: int,
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> Response:
    require_any_permission(session, access_token, *PERMISOS_EDICION)
    descartar_consulta(session, consulta_id)
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/{consulta_id}/dictados", response_model=ConsultaDetalle)
def post_dictado(
    consulta_id: int,
    body: DictadoCreate,
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> ConsultaDetalle:
    require_any_permission(session, access_token, *PERMISOS_EDICION)
    return registrar_dictado(session, consulta_id, body)


@router.post("/{consulta_id}/signos", response_model=ConsultaDetalle)
def post_signo(
    consulta_id: int,
    body: SignoCreate,
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> ConsultaDetalle:
    require_any_permission(session, access_token, *PERMISOS_EDICION)
    return agregar_signo(session, consulta_id, body)


@router.patch("/{consulta_id}/signos/{signo_id}", response_model=ConsultaDetalle)
def patch_signo(
    consulta_id: int,
    signo_id: int,
    body: SignoUpdate,
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> ConsultaDetalle:
    require_any_permission(session, access_token, *PERMISOS_EDICION)
    return actualizar_signo(session, consulta_id, signo_id, body)


@router.delete("/{consulta_id}/signos/{signo_id}", response_model=ConsultaDetalle)
def delete_signo(
    consulta_id: int,
    signo_id: int,
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> ConsultaDetalle:
    require_any_permission(session, access_token, *PERMISOS_EDICION)
    return eliminar_signo(session, consulta_id, signo_id)


@router.get("/{consulta_id}/sugerencias", response_model=SugerenciasResponse)
def get_sugerencias_consulta(
    consulta_id: int,
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> SugerenciasResponse:
    require_any_permission(session, access_token, *PERMISOS_LECTURA)
    return get_sugerencias(session, consulta_id)


@router.post("/{consulta_id}/firmar", response_model=ConsultaDetalle)
def post_firmar(
    consulta_id: int,
    body: ConsultaFirmar,
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> ConsultaDetalle:
    sesion = require_permission(session, access_token, "consultas:firmar")
    return firmar_consulta(session, consulta_id, body, sesion.usuario.id)


@router.get(
    "/{consulta_id}/receta.pdf",
    response_class=Response,
    responses={200: {"content": {"application/pdf": {}}}},
)
def get_receta_pdf(
    consulta_id: int,
    access_token: str | None = Cookie(default=None),
    session: Session = Depends(get_session),
) -> Response:
    require_any_permission(session, access_token, *PERMISOS_RECETA)
    contenido, nombre = generar_receta_pdf(session, consulta_id)
    return Response(
        content=contenido,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="{nombre}"'},
    )
