from __future__ import annotations

from pathlib import Path

import pytest
from fastapi import APIRouter, FastAPI
from fastapi.testclient import TestClient

from app.core.frontend import registrar_frontend


@pytest.fixture()
def dist(tmp_path: Path) -> Path:
    (tmp_path / "assets").mkdir()
    (tmp_path / "index.html").write_text("<html>SGV</html>", encoding="utf-8")
    (tmp_path / "assets" / "index-abc123.js").write_text("console.log(1)", encoding="utf-8")
    (tmp_path / "icon.png").write_bytes(b"png")
    return tmp_path


@pytest.fixture()
def client(dist: Path) -> TestClient:
    app = FastAPI()
    router = APIRouter(prefix="/api")

    @router.get("/ping")
    def ping() -> dict[str, bool]:
        return {"ok": True}

    app.include_router(router)
    assert registrar_frontend(app, dist) is True
    return TestClient(app)


def test_sin_dist_no_registra_nada(tmp_path: Path) -> None:
    app = FastAPI()
    assert registrar_frontend(app, tmp_path / "no-existe") is False
    assert TestClient(app).get("/").status_code == 404


def test_raiz_y_rutas_del_router_devuelven_index(client: TestClient) -> None:
    for ruta in ("/", "/agenda", "/consultas/7"):
        res = client.get(ruta)
        assert res.status_code == 200
        assert "SGV" in res.text
        assert res.headers["cache-control"] == "no-cache"


def test_sirve_assets_y_archivos_de_public(client: TestClient) -> None:
    assert client.get("/assets/index-abc123.js").text == "console.log(1)"
    assert client.get("/icon.png").content == b"png"


def test_la_api_sigue_respondiendo(client: TestClient) -> None:
    assert client.get("/api/ping").json() == {"ok": True}


def test_api_inexistente_da_404_y_no_el_frontend(client: TestClient) -> None:
    res = client.get("/api/no-existe")
    assert res.status_code == 404
    assert "SGV" not in res.text


def test_no_sale_de_la_carpeta_dist(client: TestClient) -> None:
    res = client.get("/..%2F..%2Fetc%2Fpasswd")
    assert res.status_code == 200
    assert "SGV" in res.text
