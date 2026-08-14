from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from sqlmodel import SQLModel, Session

from app.core.settings import get_settings
from app.db.session import get_engine
from app.main import app
from app.services.config_service import clear_config_cache


@pytest.fixture(autouse=True)
def test_environment(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setenv("DATABASE_URL", "sqlite://")
    monkeypatch.setenv("SECRET_KEY", "test-secret-key")
    get_settings.cache_clear()
    get_engine.cache_clear()
    clear_config_cache()


@pytest.fixture()
def engine() -> SQLModel:
    import app.models  # noqa: F401

    db_engine = get_engine()
    SQLModel.metadata.drop_all(db_engine)
    SQLModel.metadata.create_all(db_engine)
    yield db_engine
    SQLModel.metadata.drop_all(db_engine)


@pytest.fixture()
def session(engine: SQLModel) -> Session:
    with Session(engine) as db_session:
        yield db_session


@pytest.fixture()
def client() -> TestClient:
    return TestClient(app)

