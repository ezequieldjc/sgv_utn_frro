from __future__ import annotations

from datetime import datetime, timezone
from decimal import Decimal

import pytest
from sqlalchemy.exc import IntegrityError

from app.models.auth.rol import Rol
from app.models.auth.usuario import Usuario
from app.models.catalogo.mascota_estado import MascotaEstado
from app.models.clinica.consulta import Consulta
from app.models.clinica.consulta_diagnostico import ConsultaDiagnostico
from app.models.clinica.consulta_sintoma import ConsultaSintoma
from app.models.clinica.dictado import Dictado
from app.models.clinica.especie import Especie
from app.models.clinica.mascota import Mascota
from app.models.clinica.patologia import Patologia
from app.models.clinica.raza import Raza
from app.models.clinica.sintoma import Sintoma
from app.models.core.persona import Persona

# Tests de los modelos de historia clínica (scripts/clinica/001 a 005).
# Corren sobre SQLite: verifican que los modelos reflejan las reglas de la base
# (CHECK e índices únicos parciales). Las FK y los borrados en cascada solo se
# aplican en PostgreSQL y se probaron directamente en Neon.

AHORA = datetime(2026, 11, 14, 12, 0, tzinfo=timezone.utc)


def _seed(session) -> dict:
    persona = Persona(nombre="Ana", apellido="Vet", celular="341000000")
    rol = Rol(nombre="VETERINARIO")
    especie = Especie(nombre="Canina")
    estado = MascotaEstado(nombre="ACTIVA")
    session.add_all([persona, rol, especie, estado])
    session.flush()
    usuario = Usuario(persona_id=persona.id, username="ana", rol_id=rol.id, habilitado=True)
    raza = Raza(especie_id=especie.id, nombre="Bulldog Francés")
    session.add_all([usuario, raza])
    session.flush()
    mascota = Mascota(
        persona_id=persona.id, raza_id=raza.id, nombre="Coco", mascota_estado_id=estado.id
    )
    patologia = Patologia(
        codigo="test-a", nombre="Test A", prevalencia=Decimal("0.01"), prevalencia_nivel="comun"
    )
    patologia_b = Patologia(
        codigo="test-b", nombre="Test B", prevalencia=Decimal("0.02"), prevalencia_nivel="comun"
    )
    sintoma = Sintoma(codigo="tos", nombre_es="Tos", sistema="respiratorio", tipo="observable")
    session.add_all([mascota, patologia, patologia_b, sintoma])
    session.flush()
    consulta = Consulta(
        mascota_id=mascota.id,
        veterinario_id=usuario.id,
        fecha_hora=AHORA,
        peso_kg=Decimal("12.50"),
        temperatura_c=Decimal("38.5"),
    )
    session.add(consulta)
    session.commit()
    return {
        "usuario": usuario.id,
        "consulta": consulta.id,
        "patologia": patologia.id,
        "patologia_b": patologia_b.id,
        "sintoma": sintoma.id,
    }


def _falla(session, objeto) -> None:
    session.add(objeto)
    with pytest.raises(IntegrityError):
        session.commit()
    session.rollback()


def test_consulta_completa_se_guarda(session) -> None:
    ids = _seed(session)
    dictado = Dictado(
        consulta_id=ids["consulta"], transcripcion="tose", extraccion_json={}, modelo_stt="texto"
    )
    session.add(dictado)
    session.flush()
    session.add_all([
        Dictado(
            consulta_id=ids["consulta"], transcripcion="segundo", extraccion_json={}, modelo_stt="texto"
        ),
        ConsultaSintoma(
            consulta_id=ids["consulta"], sintoma_id=ids["sintoma"], dictado_id=dictado.id,
            texto_original="tose",
        ),
        ConsultaSintoma(consulta_id=ids["consulta"], texto_original="sin mapear 1"),
        ConsultaSintoma(consulta_id=ids["consulta"], texto_original="sin mapear 2"),
        ConsultaDiagnostico(
            consulta_id=ids["consulta"], patologia_id=ids["patologia"], tipo_diagnostico="principal",
            origen="sugerido_ia", ranking=1, probabilidad_pct=Decimal("62.50"),
            explicacion={"prevalencia": 0.01}, confirmado_por_usuario_id=ids["usuario"],
        ),
        ConsultaDiagnostico(
            consulta_id=ids["consulta"], descripcion_libre="Otitis",
            confirmado_por_usuario_id=ids["usuario"],
        ),
    ])
    session.commit()

    consulta = session.get(Consulta, ids["consulta"])
    consulta.estado = "firmada"
    consulta.fecha_firma = AHORA
    session.add(consulta)
    session.commit()
    assert session.get(Consulta, ids["consulta"]).estado == "firmada"


def test_consulta_firmada_sin_fecha_firma_falla(session) -> None:
    ids = _seed(session)
    consulta = session.get(Consulta, ids["consulta"])
    consulta.estado = "firmada"
    _falla(session, consulta)


def test_consulta_peso_fuera_de_rango_falla(session) -> None:
    ids = _seed(session)
    consulta = session.get(Consulta, ids["consulta"])
    consulta.peso_kg = Decimal("380")
    _falla(session, consulta)


def test_signo_con_codigo_repetido_falla(session) -> None:
    ids = _seed(session)
    session.add(
        ConsultaSintoma(consulta_id=ids["consulta"], sintoma_id=ids["sintoma"], texto_original="tose")
    )
    session.commit()
    _falla(
        session,
        ConsultaSintoma(consulta_id=ids["consulta"], sintoma_id=ids["sintoma"], texto_original="tos"),
    )


def test_dos_diagnosticos_principales_falla(session) -> None:
    ids = _seed(session)
    session.add(
        ConsultaDiagnostico(
            consulta_id=ids["consulta"], descripcion_libre="A", tipo_diagnostico="principal",
            confirmado_por_usuario_id=ids["usuario"],
        )
    )
    session.commit()
    _falla(
        session,
        ConsultaDiagnostico(
            consulta_id=ids["consulta"], descripcion_libre="B", tipo_diagnostico="principal",
            confirmado_por_usuario_id=ids["usuario"],
        ),
    )


def test_misma_patologia_repetida_falla(session) -> None:
    ids = _seed(session)
    session.add(
        ConsultaDiagnostico(
            consulta_id=ids["consulta"], patologia_id=ids["patologia"],
            confirmado_por_usuario_id=ids["usuario"],
        )
    )
    session.commit()
    _falla(
        session,
        ConsultaDiagnostico(
            consulta_id=ids["consulta"], patologia_id=ids["patologia"],
            confirmado_por_usuario_id=ids["usuario"],
        ),
    )


def test_diagnostico_ia_sin_ranking_falla(session) -> None:
    ids = _seed(session)
    _falla(
        session,
        ConsultaDiagnostico(
            consulta_id=ids["consulta"], patologia_id=ids["patologia_b"], origen="sugerido_ia",
            probabilidad_pct=Decimal("10"), confirmado_por_usuario_id=ids["usuario"],
        ),
    )


def test_diagnostico_manual_con_porcentaje_falla(session) -> None:
    ids = _seed(session)
    _falla(
        session,
        ConsultaDiagnostico(
            consulta_id=ids["consulta"], descripcion_libre="X", probabilidad_pct=Decimal("10"),
            confirmado_por_usuario_id=ids["usuario"],
        ),
    )


def test_sintoma_con_sistema_invalido_falla(session) -> None:
    _falla(
        session,
        Sintoma(codigo="test_x", nombre_es="X", sistema="pulmon", tipo="observable"),
    )
