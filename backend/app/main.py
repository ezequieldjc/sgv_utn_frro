from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.agenda import router as agenda_router
from app.api.auth import router as auth_router
from app.api.catalogos import router as catalogos_router
from app.api.clientes import router as clientes_router
from app.api.consultas import router as consultas_router
from app.api.config import router as config_router
from app.api.mascotas import router as mascotas_router
from app.api.stock import router as stock_router
from app.api.ventas import router as ventas_router
from app.api.permisos import router as permisos_router
from app.api.portal import router as portal_router
from app.api.recetas import router as recetas_router
from app.api.recordatorios import router as recordatorios_router
from app.api.roles import router as roles_router
from app.api.usuarios import router as usuarios_router
from app.api.vacunas import router as vacunas_router
from app.core.errors import APIError
from app.core.frontend import registrar_frontend
from app.core.settings import get_settings
from app.schemas.common import ErrorResponse


app = FastAPI(title="UTN FRRO SVG API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        origen.strip().rstrip("/")
        for origen in get_settings().cors_origins.split(",")
        if origen.strip()
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    # El frontend lee el nombre del PDF de la receta cuando la API está en otro origen.
    expose_headers=["Content-Disposition"],
)


@app.exception_handler(APIError)
async def api_error_handler(_: Request, exc: APIError) -> JSONResponse:
    return JSONResponse(
        status_code=exc.status_code,
        content=ErrorResponse(error=exc.error, detalle=exc.detalle).model_dump(),
    )


app.include_router(auth_router)
app.include_router(config_router)
app.include_router(roles_router)
app.include_router(permisos_router)
app.include_router(usuarios_router)
app.include_router(catalogos_router)
app.include_router(clientes_router)
app.include_router(mascotas_router)
app.include_router(consultas_router)
app.include_router(agenda_router)
app.include_router(stock_router)
app.include_router(ventas_router)
app.include_router(portal_router)
app.include_router(vacunas_router)
app.include_router(recordatorios_router)
app.include_router(recetas_router)

# Va al final: la ruta comodín del frontend no tiene que tapar ninguna ruta de la API.
registrar_frontend(app)
