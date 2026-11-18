from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import CheckConstraint, Column, DateTime
from sqlmodel import Field, SQLModel

from app.core.time_utils import utc_now


class TratamientoPreventivo(SQLModel, table=True):
    """Vacuna o desparasitación aplicada a una mascota.

    DDL en scripts/clinica/008_vacunas_recordatorios.sql. Si se aplicó en la clínica apunta al
    producto del stock (y a la venta, si se cobró); una dosis anterior (libreta, otra
    veterinaria) solo guarda `nombre_producto` y no mueve stock.

    `fecha_proxima_dosis` es cuándo vence la protección (la "fecha_vencimiento" de la 3ra
    entrega) y es lo que dispara el recordatorio. `refuerzo_de_id` apunta a la dosis anterior
    que esta aplicación completa: esa dosis deja de recordarse. El índice único
    UQ_TratPreventivo_Refuerzo (una dosis, un refuerzo) vive solo en PostgreSQL; el service
    replica la regla.
    """

    __tablename__ = "tratamiento_preventivo"
    __table_args__ = (
        CheckConstraint("tipo IN ('vacunacion','desparasitacion')", name="CK_TratPreventivo_Tipo"),
        CheckConstraint(
            "fecha_proxima_dosis IS NULL OR fecha_proxima_dosis > fecha_aplicacion",
            name="CK_TratPreventivo_Proxima",
        ),
        CheckConstraint(
            "peso_kg IS NULL OR (peso_kg > 0 AND peso_kg <= 150)", name="CK_TratPreventivo_Peso"
        ),
        CheckConstraint(
            "venta_id IS NULL OR producto_id IS NOT NULL", name="CK_TratPreventivo_Venta"
        ),
        {"schema": "clinica"},
    )

    id: int | None = Field(default=None, primary_key=True)
    mascota_id: int = Field(foreign_key="clinica.mascota.id", nullable=False)
    tipo: str = Field(max_length=20, nullable=False)
    producto_id: int | None = Field(default=None, foreign_key="stock.producto.id")
    nombre_producto: str = Field(max_length=100, nullable=False)
    fecha_aplicacion: date = Field(nullable=False)
    fecha_proxima_dosis: date | None = Field(default=None)
    lote: str | None = Field(default=None, max_length=50)
    peso_kg: Decimal | None = Field(default=None, max_digits=5, decimal_places=2)
    refuerzo_de_id: int | None = Field(
        default=None, foreign_key="clinica.tratamiento_preventivo.id"
    )
    consulta_id: int | None = Field(default=None, foreign_key="clinica.consulta.id")
    turno_id: int | None = Field(default=None, foreign_key="agenda.turno.id")
    venta_id: int | None = Field(default=None, foreign_key="comercial.venta.id")
    usuario_id: int = Field(foreign_key="auth.usuario.id", nullable=False)
    observaciones: str | None = Field(default=None, max_length=255)
    fecha_registro: datetime = Field(
        default_factory=utc_now,
        sa_column=Column(DateTime(timezone=True), nullable=False),
    )
