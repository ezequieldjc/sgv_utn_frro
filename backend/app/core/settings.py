from __future__ import annotations

from functools import lru_cache

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(env_file=".env", env_file_encoding="utf-8", extra="ignore")

    database_url: str = Field(default="sqlite:///./app.db", alias="DATABASE_URL")
    secret_key: str = Field(default="dev-secret-key", alias="SECRET_KEY")
    access_cookie_name: str = Field(default="access_token", alias="ACCESS_COOKIE_NAME")
    refresh_cookie_name: str = Field(default="refresh_token", alias="REFRESH_COOKIE_NAME")
    cookie_secure: bool = Field(default=False, alias="COOKIE_SECURE")
    cookie_samesite: str = Field(default="strict", alias="COOKIE_SAMESITE")
    access_token_expiration_minutes_default: int = Field(
        default=15,
        alias="ACCESS_TOKEN_EXPIRATION_MINUTES_DEFAULT",
    )
    refresh_token_expiration_minutes_default: int = Field(
        default=1440,
        alias="REFRESH_TOKEN_EXPIRATION_MINUTES_DEFAULT",
    )


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    return Settings()

