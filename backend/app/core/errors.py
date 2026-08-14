from __future__ import annotations


class APIError(Exception):
    def __init__(self, status_code: int, error: str, detalle: str) -> None:
        super().__init__(detalle)
        self.status_code = status_code
        self.error = error
        self.detalle = detalle

