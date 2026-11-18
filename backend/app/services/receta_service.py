"""Receta en PDF a partir de la consulta firmada.

El abstract excluye la integración con dispositivos (impresoras): la receta se descarga en PDF y
el tutor la recibe así (o la ve en el portal). En el prototipo sale de las indicaciones
(`consulta.tratamiento`) de la consulta firmada; la receta electrónica con ítems, matrícula,
firma digital certificada y código de validación es de la Fase 2 (docs/fase2_diseno.md).

`reportlab` se importa recién al generar el PDF: si falta instalarlo, el resto del backend
sigue andando y este endpoint avisa qué hacer.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from io import BytesIO
from xml.sax.saxutils import escape

from sqlalchemy import func
from sqlmodel import Session, col, select

from app.core.errors import APIError
from app.models.clinica.consulta import Consulta
from app.models.clinica.mascota import Mascota
from app.models.core.persona import Persona
from app.schemas.recetas import RecetaListItem, RecetaListResponse
from app.services.config_service import get_public_razon_social
from app.services.consulta_service import _nombre_usuario, _principales, get_detalle
from app.services.turno_service import get_zona_horaria

COLOR_MARCA = "#0f766e"
COLOR_TEXTO_SECUNDARIO = "#5b6472"
SEXOS = {"M": "Macho", "H": "Hembra"}


@dataclass(frozen=True)
class DatosReceta:
    numero: int
    clinica: str
    fecha_firma: datetime  # en la zona horaria de la clínica
    veterinario: str
    mascota: str
    especie_raza: str
    sexo: str | None
    edad: str | None
    peso: str | None
    alertas: str | None
    tutor: str
    tutor_dni: str | None
    tutor_celular: str | None
    diagnostico: str | None
    indicaciones: str
    observaciones: str | None


def _aware(value: datetime) -> datetime:
    return value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value


def _edad(meses: int | None) -> str | None:
    if meses is None:
        return None
    if meses < 12:
        return f"{meses} {'mes' if meses == 1 else 'meses'}"
    anios = meses // 12
    return f"{anios} {'año' if anios == 1 else 'años'}"


def _peso(valor: Decimal | None) -> str | None:
    if valor is None:
        return None
    texto = f"{Decimal(valor).normalize():f}".replace(".", ",")
    return f"{texto} kg"


def _dni(valor: str | None) -> str | None:
    if not valor:
        return None
    if valor.isdigit() and len(valor) >= 7:
        return f"{int(valor):,}".replace(",", ".")
    return valor


def _slug(texto: str) -> str:
    sin_tildes = unicodedata.normalize("NFKD", texto)
    ascii_ = "".join(c for c in sin_tildes if not unicodedata.combining(c)).lower()
    return re.sub(r"[^a-z0-9]+", "-", ascii_).strip("-") or "mascota"


def _datos(session: Session, consulta_id: int) -> DatosReceta:
    detalle = get_detalle(session, consulta_id)
    if detalle.estado != "firmada" or detalle.fecha_firma is None:
        raise APIError(
            409,
            "RECETA_CONSULTA_SIN_FIRMAR",
            "La receta se genera cuando la consulta está firmada",
        )
    indicaciones = (detalle.tratamiento or "").strip()
    if not indicaciones:
        raise APIError(
            409,
            "RECETA_SIN_INDICACIONES",
            "La consulta no tiene indicaciones de tratamiento para armar la receta",
        )
    mascota = session.get(Mascota, detalle.mascota.id)
    tutor = session.get(Persona, mascota.persona_id) if mascota else None
    principal = next(
        (
            d.patologia_nombre or d.descripcion_libre
            for d in detalle.diagnosticos
            if d.tipo_diagnostico == "principal"
        ),
        None,
    )
    return DatosReceta(
        numero=detalle.id,
        clinica=get_public_razon_social(),
        fecha_firma=_aware(detalle.fecha_firma).astimezone(get_zona_horaria()),
        veterinario=detalle.veterinario_nombre,
        mascota=detalle.mascota.nombre,
        especie_raza=f"{detalle.mascota.especie_nombre}, {detalle.mascota.raza_nombre}",
        sexo=SEXOS.get(detalle.mascota.sexo or ""),
        edad=_edad(detalle.mascota.edad_meses),
        peso=_peso(detalle.peso_kg or detalle.mascota.ultimo_peso),
        alertas=(detalle.mascota.alertas_medicas or "").strip() or None,
        tutor=detalle.mascota.tutor_nombre,
        tutor_dni=_dni(tutor.dni if tutor else None),
        tutor_celular=tutor.celular if tutor else None,
        diagnostico=principal,
        indicaciones=indicaciones,
        observaciones=(detalle.observaciones or "").strip() or None,
    )


def _parrafos(texto: str) -> str:
    """Texto libre → markup seguro de reportlab, respetando los saltos de línea."""
    return "<br/>".join(escape(linea.strip()) for linea in texto.splitlines() if linea.strip())


def _render(datos: DatosReceta) -> bytes:
    try:
        from reportlab.lib import colors
        from reportlab.lib.enums import TA_RIGHT
        from reportlab.lib.pagesizes import A4
        from reportlab.lib.styles import ParagraphStyle
        from reportlab.lib.units import mm
        from reportlab.platypus import (
            HRFlowable,
            KeepTogether,
            Paragraph,
            SimpleDocTemplate,
            Spacer,
            Table,
            TableStyle,
        )
    except ImportError as exc:  # pragma: no cover - depende del entorno
        raise APIError(
            503,
            "PDF_NO_DISPONIBLE",
            "Falta instalar reportlab en el backend (pip install -r requirements.txt)",
        ) from exc

    marca = colors.HexColor(COLOR_MARCA)
    gris = colors.HexColor(COLOR_TEXTO_SECUNDARIO)
    base = ParagraphStyle("base", fontName="Helvetica", fontSize=10.5, leading=14.5)
    chico = ParagraphStyle("chico", parent=base, fontSize=8.5, leading=11, textColor=gris)
    titulo = ParagraphStyle(
        "titulo", parent=base, fontName="Helvetica-Bold", fontSize=20, leading=24, textColor=marca
    )
    subtitulo = ParagraphStyle("subtitulo", parent=base, fontSize=11, textColor=gris)
    derecha = ParagraphStyle("derecha", parent=base, alignment=TA_RIGHT)
    etiqueta = ParagraphStyle(
        "etiqueta", parent=base, fontName="Helvetica-Bold", fontSize=9, textColor=gris
    )
    rp = ParagraphStyle(
        "rp", parent=base, fontName="Helvetica-Bold", fontSize=22, leading=26, textColor=marca
    )
    indicaciones = ParagraphStyle("indicaciones", parent=base, fontSize=12, leading=18)
    alerta = ParagraphStyle(
        "alerta", parent=base, textColor=colors.HexColor("#b42318"), fontName="Helvetica-Bold"
    )

    fecha = datos.fecha_firma.strftime("%d/%m/%Y")
    hora = datos.fecha_firma.strftime("%H:%M")
    numero = f"{datos.numero:06d}"

    encabezado = Table(
        [
            [
                [
                    Paragraph(escape(datos.clinica), titulo),
                    Paragraph("Receta veterinaria", subtitulo),
                ],
                [
                    Paragraph(f"<b>N.º {numero}</b>", derecha),
                    Paragraph(f"Fecha: {fecha}", derecha),
                ],
            ]
        ],
        colWidths=["65%", "35%"],
    )
    encabezado.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("RIGHTPADDING", (0, 0), (-1, -1), 0),
            ]
        )
    )

    paciente = " · ".join(
        p for p in (datos.especie_raza, datos.sexo, datos.edad, datos.peso) if p
    )
    tutor = " · ".join(
        p
        for p in (
            datos.tutor,
            f"DNI {datos.tutor_dni}" if datos.tutor_dni else None,
            f"Cel. {datos.tutor_celular}" if datos.tutor_celular else None,
        )
        if p
    )
    filas = [
        [Paragraph("PACIENTE", etiqueta), Paragraph(f"<b>{escape(datos.mascota)}</b> · {escape(paciente)}", base)],
        [Paragraph("TUTOR/A", etiqueta), Paragraph(escape(tutor), base)],
    ]
    if datos.diagnostico:
        filas.append([Paragraph("DIAGNÓSTICO", etiqueta), Paragraph(escape(datos.diagnostico), base)])
    if datos.alertas:
        filas.append(
            [Paragraph("ALERTAS", etiqueta), Paragraph(escape(datos.alertas), alerta)]
        )
    ficha = Table(filas, colWidths=[30 * mm, None])
    ficha.setStyle(
        TableStyle(
            [
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 0),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 5),
                ("TOPPADDING", (0, 0), (-1, -1), 2),
            ]
        )
    )

    historia = [
        encabezado,
        Spacer(1, 4 * mm),
        HRFlowable(width="100%", thickness=1.4, color=marca),
        Spacer(1, 4 * mm),
        ficha,
        Spacer(1, 3 * mm),
        HRFlowable(width="100%", thickness=0.5, color=colors.HexColor("#d0d5dd")),
        Spacer(1, 5 * mm),
        Paragraph("Rp./", rp),
        Spacer(1, 3 * mm),
        Paragraph(_parrafos(datos.indicaciones), indicaciones),
    ]
    if datos.observaciones:
        historia += [
            Spacer(1, 6 * mm),
            Paragraph("ESTUDIOS Y OBSERVACIONES", etiqueta),
            Spacer(1, 1.5 * mm),
            Paragraph(_parrafos(datos.observaciones), base),
        ]
    historia += [
        Spacer(1, 18 * mm),
        KeepTogether(
            [
                HRFlowable(width="45%", thickness=0.6, color=gris, hAlign="RIGHT"),
                Spacer(1, 1.5 * mm),
                Paragraph(f"<b>{escape(datos.veterinario)}</b>", derecha),
                Paragraph("Médico/a veterinario/a", derecha),
                Paragraph(
                    f"Firmado en el sistema el {fecha} a las {hora}",
                    ParagraphStyle("firma", parent=chico, alignment=TA_RIGHT),
                ),
            ]
        ),
    ]

    pie_texto = (
        f"{datos.clinica} · Receta generada a partir de la consulta N.º {numero}, "
        f"firmada el {fecha} a las {hora}."
    )

    def pie(canvas, doc) -> None:  # noqa: ANN001 - firma que pide reportlab
        canvas.saveState()
        canvas.setFont("Helvetica", 8)
        canvas.setFillColor(gris)
        canvas.drawString(doc.leftMargin, 10 * mm, pie_texto)
        canvas.drawRightString(A4[0] - doc.rightMargin, 10 * mm, f"Página {doc.page}")
        canvas.restoreState()

    buffer = BytesIO()
    doc = SimpleDocTemplate(
        buffer,
        pagesize=A4,
        leftMargin=18 * mm,
        rightMargin=18 * mm,
        topMargin=16 * mm,
        bottomMargin=18 * mm,
        title=f"Receta de {datos.mascota} — {fecha}",
        author=datos.clinica,
        subject="Receta veterinaria",
        creator=datos.clinica,
    )
    doc.build(historia, onFirstPage=pie, onLaterPages=pie)
    return buffer.getvalue()


def generar_receta_pdf(session: Session, consulta_id: int) -> tuple[bytes, str]:
    """Devuelve el PDF y el nombre de archivo sugerido (receta-<mascota>-<fecha>.pdf)."""
    datos = _datos(session, consulta_id)
    nombre = f"receta-{_slug(datos.mascota)}-{datos.fecha_firma:%Y-%m-%d}.pdf"
    return _render(datos), nombre


def listar_recetas(
    session: Session, *, mascota_id: int | None, page: int, page_size: int
) -> RecetaListResponse:
    """Consultas firmadas con indicaciones, de la más reciente a la más antigua."""
    filtros = [
        Consulta.estado == "firmada",
        col(Consulta.tratamiento).is_not(None),
        func.length(func.trim(Consulta.tratamiento)) > 0,
    ]
    if mascota_id is not None:
        filtros.append(Consulta.mascota_id == mascota_id)

    total = session.exec(select(func.count()).select_from(Consulta).where(*filtros)).one()
    filas = session.exec(
        select(Consulta, Mascota, Persona)
        .join(Mascota, col(Mascota.id) == col(Consulta.mascota_id))
        .join(Persona, col(Persona.id) == col(Mascota.persona_id))
        .where(*filtros)
        .order_by(col(Consulta.fecha_firma).desc(), col(Consulta.id).desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()
    principales = _principales(session, [c.id for c, _, _ in filas if c.id is not None])
    return RecetaListResponse(
        items=[
            RecetaListItem(
                consulta_id=c.id or 0,
                fecha_firma=_aware(c.fecha_firma or c.fecha_hora),
                mascota_id=m.id or 0,
                mascota_nombre=m.nombre,
                tutor_nombre=f"{p.nombre} {p.apellido}".strip(),
                veterinario_nombre=_nombre_usuario(session, c.veterinario_id),
                diagnostico_principal=principales.get(c.id or 0),
                indicaciones=(c.tratamiento or "").strip(),
            )
            for c, m, p in filas
        ],
        total=total,
        page=page,
        page_size=page_size,
    )
