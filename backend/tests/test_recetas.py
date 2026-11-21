from __future__ import annotations

import base64
import re
import zlib
from datetime import datetime, timedelta, timezone
from decimal import Decimal

from app.models.clinica.consulta import Consulta
from app.models.clinica.consulta_diagnostico import ConsultaDiagnostico
from app.models.clinica.patologia import Patologia
from app.models.core.persona import Persona
from test_agenda import TZ, _login, _seed_mascota, _seed_usuario
from test_clientes import _seed_jwt_config

TRATAMIENTO = (
    "Baño con clorhexidina cada tres días.\n"
    "Oclacitinib 16 mg: un comprimido cada 12 horas por 14 días.\n"
    "Control en quince días."
)


def _texto_pdf(contenido: bytes) -> str:
    """Texto de los streams del PDF (reportlab los codifica en ASCII85 y los comprime con zlib)."""
    partes = []
    for stream in re.findall(rb"stream\r?\n(.*?)endstream", contenido, re.S):
        datos = stream.strip()
        try:
            if datos.endswith(b"~>"):
                datos = base64.a85decode(datos, adobe=True)
            partes.append(zlib.decompress(datos).decode("latin-1"))
        except (ValueError, zlib.error):
            partes.append(stream.decode("latin-1", errors="ignore"))
    return "".join(partes)


def _consulta(session, s: dict, *, firmada: bool = True, tratamiento: str | None = TRATAMIENTO,
              mascota=None) -> Consulta:
    ahora = datetime.now(timezone.utc).replace(microsecond=0)
    consulta = Consulta(
        mascota_id=(mascota or s["felipe"]).id,
        veterinario_id=s["vet"].id,
        fecha_hora=ahora - timedelta(minutes=30),
        motivo="Se rasca todo el día",
        peso_kg=Decimal("21.50"),
        tratamiento=tratamiento,
        observaciones="Pido raspado cutáneo.",
        estado="firmada" if firmada else "borrador",
        fecha_firma=ahora if firmada else None,
    )
    session.add(consulta)
    session.flush()
    if firmada:
        session.add(
            ConsultaDiagnostico(
                consulta_id=consulta.id or 0,
                patologia_id=s["dermatitis"].id,
                tipo_diagnostico="principal",
                origen="manual",
                confirmado_por_usuario_id=s["vet"].id,
            )
        )
    session.commit()
    session.refresh(consulta)
    return consulta


def _escenario(client, session) -> dict:
    _seed_jwt_config(session)
    session.commit()
    vet = _seed_usuario(
        session, username="vet", permisos=["consultas:crear", "consultas:ver_historia_clinica"],
        rol_nombre="VETERINARIO", nombre="Valeria", apellido="Sosa",
    )
    felipe = _seed_mascota(session, nombre="Felipe", tutor_apellido="Ferreyra")
    tutor = session.get(Persona, felipe.persona_id)
    tutor.nombre, tutor.dni, tutor.celular = "Joaquín", "30111222", "3406419004"
    session.add(tutor)
    dermatitis = Patologia(
        codigo="atopic-dermatitis", nombre="Dermatitis atópica", prevalencia=Decimal("0.03"),
        prevalencia_nivel="media", solo_razas_predispuestas=False, activo=True,
    )
    session.add(dermatitis)
    session.commit()
    session.refresh(dermatitis)
    _login(client, "vet")
    return {"vet": vet, "felipe": felipe, "dermatitis": dermatitis}


def test_la_receta_de_una_consulta_firmada_se_descarga_en_pdf(client, session) -> None:
    s = _escenario(client, session)
    consulta = _consulta(session, s)
    response = client.get(f"/api/consultas/{consulta.id}/receta.pdf")
    assert response.status_code == 200, response.text
    assert response.headers["content-type"] == "application/pdf"
    fecha = datetime.now(TZ).strftime("%Y-%m-%d")
    assert response.headers["content-disposition"] == (
        f'attachment; filename="receta-felipe-{fecha}.pdf"'
    )
    assert response.content.startswith(b"%PDF")
    texto = _texto_pdf(response.content)
    for esperado in (
        "Yacanvet",
        "Receta veterinaria",
        f"{consulta.id:06d}",
        "Felipe",
        "Joaqu",  # "Joaquín" en WinAnsi
        "30.111.222",
        "Dermatitis at",
        "Oclacitinib 16 mg",
        "Valeria Sosa",
        "21,5 kg",
        "raspado",
    ):
        assert esperado in texto, esperado


def test_texto_con_simbolos_no_rompe_el_pdf(client, session) -> None:
    s = _escenario(client, session)
    consulta = _consulta(session, s, tratamiento="Dosis <5 mg> & control «en 7 días»")
    response = client.get(f"/api/consultas/{consulta.id}/receta.pdf")
    assert response.status_code == 200, response.text
    assert response.content.startswith(b"%PDF")


def test_sin_firmar_o_sin_indicaciones_no_hay_receta(client, session) -> None:
    s = _escenario(client, session)
    borrador = _consulta(session, s, firmada=False)
    response = client.get(f"/api/consultas/{borrador.id}/receta.pdf")
    assert response.status_code == 409
    assert response.json()["error"] == "RECETA_CONSULTA_SIN_FIRMAR"
    sin_indicaciones = _consulta(session, s, tratamiento="   ")
    response = client.get(f"/api/consultas/{sin_indicaciones.id}/receta.pdf")
    assert response.status_code == 409
    assert response.json()["error"] == "RECETA_SIN_INDICACIONES"
    assert client.get("/api/consultas/9999/receta.pdf").status_code == 404


def test_historial_de_recetas_solo_firmadas_con_indicaciones(client, session) -> None:
    s = _escenario(client, session)
    simon = _seed_mascota(session, nombre="Simón", tutor_apellido="Ferreyra")
    con_receta = _consulta(session, s)
    _consulta(session, s, firmada=False)
    _consulta(session, s, tratamiento=None)
    de_simon = _consulta(session, s, mascota=simon)

    data = client.get("/api/recetas").json()
    assert data["total"] == 2
    assert {i["consulta_id"] for i in data["items"]} == {con_receta.id, de_simon.id}
    item = next(i for i in data["items"] if i["consulta_id"] == con_receta.id)
    assert item["diagnostico_principal"] == "Dermatitis atópica"
    assert item["veterinario_nombre"] == "Valeria Sosa"
    assert item["indicaciones"].startswith("Baño con clorhexidina")

    solo_felipe = client.get("/api/recetas", params={"mascota_id": s["felipe"].id}).json()
    assert [i["consulta_id"] for i in solo_felipe["items"]] == [con_receta.id]


def test_permisos(client, session) -> None:
    s = _escenario(client, session)
    consulta = _consulta(session, s)
    _seed_usuario(session, username="recep", permisos=["recetas:ver_historial"], rol_nombre="RECEPCION")
    _seed_usuario(session, username="nadie", permisos=["agenda:ver"], rol_nombre="OTRO")
    _login(client, "recep")
    assert client.get(f"/api/consultas/{consulta.id}/receta.pdf").status_code == 200
    assert client.get("/api/recetas").status_code == 200
    _login(client, "nadie")
    assert client.get(f"/api/consultas/{consulta.id}/receta.pdf").status_code == 403
    assert client.get("/api/recetas").status_code == 403
