from __future__ import annotations

from pydantic import BaseModel


class ErrorResponse(BaseModel):
    error: str
    detalle: str


def validar_mail_cliente(value: str) -> str:
    """Mail obligatorio de un cliente: es su usuario, así que se guarda sin espacios y en
    minúsculas."""
    normalized = value.strip().lower()
    if not normalized:
        raise ValueError("El mail es obligatorio")
    if "@" not in normalized or "." not in normalized.split("@")[-1] or " " in normalized:
        raise ValueError("El email no tiene un formato válido")
    return normalized
