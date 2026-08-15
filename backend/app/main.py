from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.auth import router as auth_router
from app.api.config import router as config_router
from app.api.roles import router as roles_router
from app.api.usuarios import router as usuarios_router
from app.core.errors import APIError
from app.schemas.common import ErrorResponse


app = FastAPI(title="UTN FRRO SVG API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
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
app.include_router(usuarios_router)
