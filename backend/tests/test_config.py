from __future__ import annotations

from app.models.sys.config import Config
from app.services.config_service import clear_config_cache


def test_get_public_config_devuelve_razon_social(client, session) -> None:
    session.add(
        Config(
            config_id=2,
            config_nombre="BRANDING",
            parametro_id=1,
            parametro_nombre="RAZON_SOCIAL",
            parametro_valor="Clinica Test",
        )
    )
    session.commit()
    clear_config_cache()

    response = client.get("/api/config/public")
    assert response.status_code == 200
    assert response.json()["razon_social"] == "Clinica Test"
