"""Sirve el frontend compilado (Vite) desde la misma app de FastAPI.

En producción el workflow compila `frontend/` y copia `frontend/dist` a `backend/static`.
Así el frontend y la API comparten dominio: no hace falta CORS y las cookies de sesión
(HttpOnly, SameSite=Strict) funcionan en todos los navegadores, Safari incluido.

En desarrollo la carpeta no existe y no se registra nada: el frontend se sigue corriendo
con `npm run dev` (Vite en el puerto 5173, con proxy de /api hacia el backend).
"""

from __future__ import annotations

from pathlib import Path

from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles

# Rutas que son del backend: nunca se responden con el index.html del frontend.
PREFIJOS_BACKEND = ("api", "docs", "redoc", "openapi.json")

DIST_POR_DEFECTO = Path(__file__).resolve().parents[2] / "static"


def registrar_frontend(app: FastAPI, dist_dir: Path | str | None = None) -> bool:
    """Registra el frontend en `app` si existe `dist_dir/index.html`. Devuelve si lo registró.

    Llamarla después de incluir todos los routers de la API: la ruta comodín va última.
    """
    dist = Path(dist_dir) if dist_dir else DIST_POR_DEFECTO
    dist = dist.resolve()
    index = dist / "index.html"
    if not index.is_file():
        return False

    # Archivos con hash en el nombre (JS/CSS): se pueden cachear sin problema.
    assets = dist / "assets"
    if assets.is_dir():
        app.mount("/assets", StaticFiles(directory=assets), name="frontend-assets")

    @app.get("/{ruta:path}", include_in_schema=False)
    async def frontend(ruta: str) -> FileResponse:
        primer_segmento = ruta.split("/", 1)[0]
        if primer_segmento in PREFIJOS_BACKEND:
            # Una ruta /api/... que no existe tiene que dar 404, no la pantalla del frontend.
            raise HTTPException(status_code=404, detail="Not Found")

        # Archivos sueltos de frontend/public (icon.png, login_background.jpg, ...).
        if ruta:
            archivo = (dist / ruta).resolve()
            if archivo.is_relative_to(dist) and archivo.is_file():
                return FileResponse(archivo)

        # Cualquier otra ruta (/agenda, /consultas/7, ...) la resuelve React Router.
        # index.html sin caché, para que cada despliegue nuevo se vea al recargar.
        return FileResponse(index, headers={"Cache-Control": "no-cache"})

    return True
