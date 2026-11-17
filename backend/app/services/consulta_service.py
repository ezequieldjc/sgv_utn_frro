"""Consulta clínica del prototipo: de borrador a firmada (docs/flujo_de_los_datos.md).

- La consulta nace en `borrador` (desde un turno o sin turno) y se completa con dictados y
  correcciones del veterinario.
- Cada dictado se procesa con el extractor por reglas (`nlp_simulado`): queda una fila en
  `dictado` que no se edita, se completan los textos, el peso y la temperatura de la consulta y se
  registran los signos. Un dictado nunca pisa un signo que el veterinario ya revisó.
- Las sugerencias las calcula el motor simulado (`motor_simulado`) cada vez que se piden; no se
  guardan.
- La firma, en una sola transacción, guarda los diagnósticos aceptados, confirma los signos, deja la
  consulta en solo lectura, pasa el turno a `atendido` y actualiza `mascota.ultimo_peso`.
"""

from __future__ import annotations

import time
from datetime import date, datetime, timezone

from sqlalchemy import func
from sqlmodel import Session, col, select

from app.core.errors import APIError
from app.core.time_utils import utc_now
from app.models.agenda.turno import Turno
from app.models.auth.usuario import Usuario
from app.models.catalogo.estado_reproductivo import EstadoReproductivo
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
from app.schemas.consultas import (
    ConsultaCreate,
    ConsultaDetalle,
    ConsultaFirmar,
    ConsultaListItem,
    ConsultaListResponse,
    ConsultaSignoItem,
    ConsultaUpdate,
    DiagnosticoItem,
    DictadoCreate,
    DictadoItem,
    MascotaResumen,
    PatologiaOpcion,
    SignoCreate,
    SignoUpdate,
    SintomaOpcion,
    SugerenciaItem,
    SugerenciasResponse,
)
from app.services import motor_simulado, nlp_simulado
from app.services.turno_service import get_zona_horaria

MODELO_STT_TEXTO = "texto"
TEXTOS_CONSULTA = ("motivo", "anamnesis", "examen_fisico", "tratamiento", "observaciones")
ESTADOS_TURNO_ATENDIBLES = ("solicitado", "confirmado")


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _aware(value: datetime) -> datetime:
    """SQLite devuelve datetimes naive (guardados en UTC); PostgreSQL los devuelve aware."""
    if value.tzinfo is None:
        return value.replace(tzinfo=timezone.utc)
    return value


def _get_consulta(session: Session, consulta_id: int) -> Consulta:
    consulta = session.get(Consulta, consulta_id)
    if consulta is None:
        raise APIError(404, "CONSULTA_NO_ENCONTRADA", "La consulta no existe")
    return consulta


def _get_borrador(session: Session, consulta_id: int) -> Consulta:
    consulta = _get_consulta(session, consulta_id)
    if consulta.estado != "borrador":
        raise APIError(
            409, "CONSULTA_FIRMADA", "La consulta está firmada y ya no se puede modificar"
        )
    return consulta


def _tocar(consulta: Consulta) -> None:
    consulta.fecha_modificacion = utc_now()


def _nombre_persona(persona: Persona | None) -> str:
    if persona is None:
        return ""
    return f"{persona.nombre} {persona.apellido}".strip()


def _nombre_usuario(session: Session, usuario_id: int) -> str:
    fila = session.exec(
        select(Persona.nombre, Persona.apellido, Usuario.username)
        .join(Usuario, col(Usuario.persona_id) == col(Persona.id))
        .where(Usuario.id == usuario_id)
    ).first()
    if fila is None:
        return ""
    nombre, apellido, username = fila
    completo = f"{nombre} {apellido}".strip()
    return completo or username


def _edad_meses(fecha_nacimiento: date | None, a_la_fecha: datetime) -> int | None:
    if fecha_nacimiento is None:
        return None
    dia = _aware(a_la_fecha).astimezone(get_zona_horaria()).date()
    meses = (dia.year - fecha_nacimiento.year) * 12 + (dia.month - fecha_nacimiento.month)
    if dia.day < fecha_nacimiento.day:
        meses -= 1
    return max(meses, 0)


def _mascota_resumen(session: Session, mascota_id: int, a_la_fecha: datetime) -> MascotaResumen:
    fila = session.exec(
        select(Mascota, Raza, Especie, Persona, EstadoReproductivo)
        .join(Raza, col(Raza.id) == col(Mascota.raza_id))
        .join(Especie, col(Especie.id) == col(Raza.especie_id))
        .join(Persona, col(Persona.id) == col(Mascota.persona_id))
        .join(
            EstadoReproductivo,
            col(EstadoReproductivo.id) == col(Mascota.estado_reproductivo_id),
            isouter=True,
        )
        .where(Mascota.id == mascota_id)
    ).first()
    if fila is None:
        raise APIError(404, "MASCOTA_NO_ENCONTRADA", "La mascota no existe")
    mascota, raza, especie, tutor, estado_reproductivo = fila
    return MascotaResumen(
        id=mascota.id or 0,
        nombre=mascota.nombre,
        especie_nombre=especie.nombre,
        raza_nombre=raza.nombre,
        raza_codigo=raza.codigo,
        sexo=mascota.sexo,
        fecha_nacimiento=mascota.fecha_nacimiento,
        edad_meses=_edad_meses(mascota.fecha_nacimiento, a_la_fecha),
        ultimo_peso=mascota.ultimo_peso,
        estado_reproductivo_nombre=estado_reproductivo.nombre if estado_reproductivo else None,
        alertas_medicas=mascota.alertas_medicas,
        tutor_nombre=_nombre_persona(tutor),
    )


def _signos(session: Session, consulta_id: int) -> list[ConsultaSignoItem]:
    filas = session.exec(
        select(ConsultaSintoma, Sintoma)
        .join(Sintoma, col(Sintoma.id) == col(ConsultaSintoma.sintoma_id), isouter=True)
        .where(ConsultaSintoma.consulta_id == consulta_id)
        .order_by(col(ConsultaSintoma.id))
    ).all()
    return [
        ConsultaSignoItem(
            id=signo.id or 0,
            sintoma_id=signo.sintoma_id,
            codigo=sintoma.codigo if sintoma else None,
            nombre=sintoma.nombre_es if sintoma else None,
            sistema=sintoma.sistema if sintoma else None,
            texto_original=signo.texto_original,
            presente=signo.presente,
            origen=signo.origen,
            confirmado=signo.confirmado,
            dictado_id=signo.dictado_id,
        )
        for signo, sintoma in filas
    ]


def _diagnosticos(session: Session, consulta_id: int) -> list[DiagnosticoItem]:
    filas = session.exec(
        select(ConsultaDiagnostico, Patologia)
        .join(
            Patologia,
            col(Patologia.id) == col(ConsultaDiagnostico.patologia_id),
            isouter=True,
        )
        .where(ConsultaDiagnostico.consulta_id == consulta_id)
        .order_by(col(ConsultaDiagnostico.tipo_diagnostico), col(ConsultaDiagnostico.id))
    ).all()
    items = [
        DiagnosticoItem(
            id=dx.id or 0,
            patologia_id=dx.patologia_id,
            patologia_codigo=patologia.codigo if patologia else None,
            patologia_nombre=patologia.nombre if patologia else None,
            descripcion_libre=dx.descripcion_libre,
            tipo_diagnostico=dx.tipo_diagnostico,  # type: ignore[arg-type]
            origen=dx.origen,  # type: ignore[arg-type]
            ranking=dx.ranking,
            probabilidad_pct=dx.probabilidad_pct,
        )
        for dx, patologia in filas
    ]
    # El principal primero.
    return sorted(items, key=lambda d: (d.tipo_diagnostico != "principal", d.id))


def _dictados(session: Session, consulta_id: int) -> list[DictadoItem]:
    filas = session.exec(
        select(Dictado)
        .where(Dictado.consulta_id == consulta_id)
        .order_by(col(Dictado.fecha_creacion), col(Dictado.id))
    ).all()
    return [
        DictadoItem(
            id=d.id or 0,
            transcripcion=d.transcripcion,
            modelo_stt=d.modelo_stt,
            modelo_llm=d.modelo_llm,
            version_prompt=d.version_prompt,
            fecha_creacion=_aware(d.fecha_creacion),
        )
        for d in filas
    ]


def get_detalle(session: Session, consulta_id: int) -> ConsultaDetalle:
    consulta = _get_consulta(session, consulta_id)
    return ConsultaDetalle(
        id=consulta.id or 0,
        estado=consulta.estado,  # type: ignore[arg-type]
        fecha_hora=_aware(consulta.fecha_hora),
        fecha_firma=_aware(consulta.fecha_firma) if consulta.fecha_firma else None,
        turno_id=consulta.turno_id,
        veterinario_id=consulta.veterinario_id,
        veterinario_nombre=_nombre_usuario(session, consulta.veterinario_id),
        motivo=consulta.motivo,
        anamnesis=consulta.anamnesis,
        examen_fisico=consulta.examen_fisico,
        peso_kg=consulta.peso_kg,
        temperatura_c=consulta.temperatura_c,
        tratamiento=consulta.tratamiento,
        observaciones=consulta.observaciones,
        mascota=_mascota_resumen(session, consulta.mascota_id, consulta.fecha_hora),
        signos=_signos(session, consulta.id or 0),
        diagnosticos=_diagnosticos(session, consulta.id or 0),
        dictados=_dictados(session, consulta.id or 0),
    )


# ---------------------------------------------------------------------------
# Alta, edición y descarte
# ---------------------------------------------------------------------------


def crear_consulta(
    session: Session, payload: ConsultaCreate, veterinario_id: int
) -> tuple[ConsultaDetalle, bool]:
    """Abre una consulta en borrador. Si el turno ya tiene consulta, devuelve esa (creada=False)."""
    if session.get(Mascota, payload.mascota_id) is None:
        raise APIError(404, "MASCOTA_NO_ENCONTRADA", "La mascota no existe")

    if payload.turno_id is not None:
        turno = session.get(Turno, payload.turno_id)
        if turno is None:
            raise APIError(404, "TURNO_NO_ENCONTRADO", "El turno no existe")
        if turno.mascota_id != payload.mascota_id:
            raise APIError(
                400, "TURNO_OTRA_MASCOTA", "El turno corresponde a otra mascota"
            )
        existente = session.exec(
            select(Consulta).where(Consulta.turno_id == payload.turno_id)
        ).first()
        if existente is not None:
            return get_detalle(session, existente.id or 0), False
        if turno.estado not in ESTADOS_TURNO_ATENDIBLES:
            raise APIError(
                409,
                "TURNO_NO_ATENDIBLE",
                f"No se puede iniciar una consulta con un turno en estado '{turno.estado}'",
            )

    consulta = Consulta(
        mascota_id=payload.mascota_id,
        veterinario_id=veterinario_id,
        turno_id=payload.turno_id,
        fecha_hora=utc_now(),
        estado="borrador",
    )
    session.add(consulta)
    session.commit()
    session.refresh(consulta)
    return get_detalle(session, consulta.id or 0), True


def actualizar_consulta(
    session: Session, consulta_id: int, payload: ConsultaUpdate
) -> ConsultaDetalle:
    consulta = _get_borrador(session, consulta_id)
    for campo in payload.model_fields_set:
        setattr(consulta, campo, getattr(payload, campo))
    _tocar(consulta)
    session.add(consulta)
    session.commit()
    return get_detalle(session, consulta_id)


def descartar_consulta(session: Session, consulta_id: int) -> None:
    """Borra un borrador con sus dictados y signos. Una consulta firmada no se borra."""
    consulta = _get_borrador(session, consulta_id)
    for signo in session.exec(
        select(ConsultaSintoma).where(ConsultaSintoma.consulta_id == consulta_id)
    ).all():
        session.delete(signo)
    for dictado in session.exec(select(Dictado).where(Dictado.consulta_id == consulta_id)).all():
        session.delete(dictado)
    for dx in session.exec(
        select(ConsultaDiagnostico).where(ConsultaDiagnostico.consulta_id == consulta_id)
    ).all():
        session.delete(dx)
    session.flush()
    session.delete(consulta)
    session.commit()


# ---------------------------------------------------------------------------
# Dictado (NLP simulado)
# ---------------------------------------------------------------------------


def _catalogo_activo(session: Session) -> list[Sintoma]:
    return list(
        session.exec(select(Sintoma).where(col(Sintoma.activo).is_(True))).all()
    )


def _sumar_texto(actual: str | None, nuevo: str | None) -> str | None:
    """Un dictado posterior agrega texto al final; no borra lo que ya había."""
    if not nuevo:
        return actual
    if not actual:
        return nuevo
    if nuevo in actual:
        return actual
    return f"{actual}\n{nuevo}"


def registrar_dictado(
    session: Session, consulta_id: int, payload: DictadoCreate
) -> ConsultaDetalle:
    consulta = _get_borrador(session, consulta_id)
    catalogo = _catalogo_activo(session)
    por_codigo = {s.codigo: s for s in catalogo}

    inicio = time.perf_counter()
    ficha = nlp_simulado.extraer_ficha(
        payload.texto,
        [nlp_simulado.SintomaCatalogo(codigo=s.codigo, nombre_es=s.nombre_es) for s in catalogo],
    )
    latencia_ms = int((time.perf_counter() - inicio) * 1000)

    dictado = Dictado(
        consulta_id=consulta_id,
        transcripcion=payload.texto,
        extraccion_json=ficha.model_dump(mode="json"),
        modelo_stt=MODELO_STT_TEXTO,
        modelo_llm=None,
        version_prompt=nlp_simulado.VERSION_EXTRACTOR,
        duracion_audio_s=payload.duracion_audio_s,
        latencia_stt_ms=None,
        latencia_llm_ms=latencia_ms,
    )
    session.add(dictado)
    session.flush()

    for campo in TEXTOS_CONSULTA:
        setattr(consulta, campo, _sumar_texto(getattr(consulta, campo), getattr(ficha, campo)))
    if ficha.peso_kg is not None:
        consulta.peso_kg = ficha.peso_kg
    if ficha.temperatura_c is not None:
        consulta.temperatura_c = ficha.temperatura_c

    existentes = {
        s.sintoma_id: s
        for s in session.exec(
            select(ConsultaSintoma).where(
                ConsultaSintoma.consulta_id == consulta_id,
                col(ConsultaSintoma.sintoma_id).is_not(None),
            )
        ).all()
    }
    for signo in ficha.signos:
        sintoma = por_codigo.get(signo.codigo or "")
        if sintoma is None:
            session.add(
                ConsultaSintoma(
                    consulta_id=consulta_id,
                    sintoma_id=None,
                    dictado_id=dictado.id,
                    texto_original=signo.texto_original,
                    presente=signo.presente,
                    origen="nlp",
                    confirmado=False,
                )
            )
            continue
        actual = existentes.get(sintoma.id)
        if actual is None:
            session.add(
                ConsultaSintoma(
                    consulta_id=consulta_id,
                    sintoma_id=sintoma.id,
                    dictado_id=dictado.id,
                    texto_original=signo.texto_original,
                    presente=signo.presente,
                    origen="nlp",
                    confirmado=False,
                )
            )
        elif not actual.confirmado:
            actual.presente = signo.presente
            actual.texto_original = signo.texto_original
            actual.dictado_id = dictado.id
            session.add(actual)

    _tocar(consulta)
    session.add(consulta)
    session.commit()
    return get_detalle(session, consulta_id)


# ---------------------------------------------------------------------------
# Signos: correcciones del veterinario
# ---------------------------------------------------------------------------


def _get_sintoma_activo(session: Session, sintoma_id: int) -> Sintoma:
    sintoma = session.get(Sintoma, sintoma_id)
    if sintoma is None or not sintoma.activo:
        raise APIError(404, "SINTOMA_NO_ENCONTRADO", "El signo no existe en el catálogo")
    return sintoma


def agregar_signo(session: Session, consulta_id: int, payload: SignoCreate) -> ConsultaDetalle:
    consulta = _get_borrador(session, consulta_id)
    sintoma = _get_sintoma_activo(session, payload.sintoma_id)
    existente = session.exec(
        select(ConsultaSintoma).where(
            ConsultaSintoma.consulta_id == consulta_id,
            ConsultaSintoma.sintoma_id == sintoma.id,
        )
    ).first()
    if existente is not None:
        existente.presente = payload.presente
        existente.confirmado = True
        session.add(existente)
    else:
        session.add(
            ConsultaSintoma(
                consulta_id=consulta_id,
                sintoma_id=sintoma.id,
                dictado_id=None,
                texto_original=sintoma.nombre_es,
                presente=payload.presente,
                origen="manual",
                confirmado=True,
            )
        )
    _tocar(consulta)
    session.add(consulta)
    session.commit()
    return get_detalle(session, consulta_id)


def _get_signo(session: Session, consulta_id: int, signo_id: int) -> ConsultaSintoma:
    signo = session.get(ConsultaSintoma, signo_id)
    if signo is None or signo.consulta_id != consulta_id:
        raise APIError(404, "SIGNO_NO_ENCONTRADO", "El signo no existe en esta consulta")
    return signo


def actualizar_signo(
    session: Session, consulta_id: int, signo_id: int, payload: SignoUpdate
) -> ConsultaDetalle:
    consulta = _get_borrador(session, consulta_id)
    signo = _get_signo(session, consulta_id, signo_id)
    if payload.sintoma_id is not None and payload.sintoma_id != signo.sintoma_id:
        sintoma = _get_sintoma_activo(session, payload.sintoma_id)
        duplicado = session.exec(
            select(ConsultaSintoma).where(
                ConsultaSintoma.consulta_id == consulta_id,
                ConsultaSintoma.sintoma_id == sintoma.id,
                ConsultaSintoma.id != signo_id,
            )
        ).first()
        if duplicado is not None:
            raise APIError(
                409, "SIGNO_DUPLICADO", "Ese signo ya está cargado en la consulta"
            )
        signo.sintoma_id = sintoma.id
    if payload.presente is not None:
        signo.presente = payload.presente
    signo.confirmado = True
    session.add(signo)
    _tocar(consulta)
    session.add(consulta)
    session.commit()
    return get_detalle(session, consulta_id)


def eliminar_signo(session: Session, consulta_id: int, signo_id: int) -> ConsultaDetalle:
    consulta = _get_borrador(session, consulta_id)
    signo = _get_signo(session, consulta_id, signo_id)
    session.delete(signo)
    _tocar(consulta)
    session.add(consulta)
    session.commit()
    return get_detalle(session, consulta_id)


# ---------------------------------------------------------------------------
# Sugerencias (motor simulado)
# ---------------------------------------------------------------------------


def _calcular(
    session: Session, consulta: Consulta
) -> tuple[motor_simulado.ResultadoMotor, int]:
    filas = session.exec(
        select(ConsultaSintoma, Sintoma)
        .join(Sintoma, col(Sintoma.id) == col(ConsultaSintoma.sintoma_id), isouter=True)
        .where(ConsultaSintoma.consulta_id == consulta.id)
    ).all()
    signos = [
        motor_simulado.SignoEntrada(codigo=sintoma.codigo, presente=signo.presente)
        for signo, sintoma in filas
        if sintoma is not None
    ]
    sin_codigo = sum(1 for _, sintoma in filas if sintoma is None)

    raza = session.exec(
        select(Raza).join(Mascota, col(Mascota.raza_id) == col(Raza.id)).where(
            Mascota.id == consulta.mascota_id
        )
    ).first()
    patologias = [
        motor_simulado.PatologiaEntrada(
            id=p.id or 0,
            codigo=p.codigo,
            nombre=p.nombre,
            prevalencia=float(p.prevalencia),
            solo_razas_predispuestas=p.solo_razas_predispuestas,
        )
        for p in session.exec(select(Patologia).where(col(Patologia.activo).is_(True))).all()
    ]
    resultado = motor_simulado.diagnosticar(raza.codigo if raza else None, signos, patologias)
    return resultado, sin_codigo


def get_sugerencias(session: Session, consulta_id: int) -> SugerenciasResponse:
    consulta = _get_consulta(session, consulta_id)
    resultado, sin_codigo = _calcular(session, consulta)
    return SugerenciasResponse(
        version_motor=motor_simulado.VERSION_MOTOR,
        otra_causa_pct=resultado.otra_causa_pct,
        evidencia_suficiente=resultado.evidencia_suficiente,
        sugerencias=[
            SugerenciaItem(
                patologia_id=s.patologia_id,
                codigo=s.codigo,
                nombre=s.nombre,
                ranking=s.ranking,
                probabilidad_pct=s.probabilidad_pct,
                estudio_sugerido=s.estudio_sugerido,
                explicacion=s.explicacion,
            )
            for s in resultado.sugerencias
        ],
        signos_sin_codigo=sin_codigo,
    )


# ---------------------------------------------------------------------------
# Firma
# ---------------------------------------------------------------------------


def firmar_consulta(
    session: Session, consulta_id: int, payload: ConsultaFirmar, usuario_id: int
) -> ConsultaDetalle:
    consulta = _get_borrador(session, consulta_id)

    patologias_usadas: set[int] = set()
    for dx in payload.diagnosticos:
        if dx.patologia_id is None:
            continue
        if dx.patologia_id in patologias_usadas:
            raise APIError(
                400, "DIAGNOSTICO_DUPLICADO", "La misma patología está cargada dos veces"
            )
        patologias_usadas.add(dx.patologia_id)
        patologia = session.get(Patologia, dx.patologia_id)
        if patologia is None or not patologia.activo:
            raise APIError(404, "PATOLOGIA_NO_ENCONTRADA", "La patología no existe")

    vigentes = {s.patologia_id: s for s in _calcular(session, consulta)[0].sugerencias}
    ahora = utc_now()
    for dx in payload.diagnosticos:
        fila = ConsultaDiagnostico(
            consulta_id=consulta_id,
            patologia_id=dx.patologia_id,
            descripcion_libre=dx.descripcion_libre,
            tipo_diagnostico=dx.tipo_diagnostico,
            origen=dx.origen,
            confirmado_por_usuario_id=usuario_id,
        )
        if dx.origen == "sugerido_ia":
            sugerencia = vigentes.get(dx.patologia_id or 0)
            if sugerencia is None:
                raise APIError(
                    409,
                    "SUGERENCIA_NO_VIGENTE",
                    "La sugerencia ya no está en el top 3: actualizá el panel y volvé a elegir",
                )
            fila.ranking = sugerencia.ranking
            fila.probabilidad_pct = sugerencia.probabilidad_pct
            fila.explicacion = sugerencia.explicacion
            fila.version_motor = motor_simulado.VERSION_MOTOR
        session.add(fila)

    for signo in session.exec(
        select(ConsultaSintoma).where(ConsultaSintoma.consulta_id == consulta_id)
    ).all():
        signo.confirmado = True
        session.add(signo)

    consulta.estado = "firmada"
    consulta.fecha_firma = ahora
    consulta.fecha_modificacion = ahora
    session.add(consulta)

    if consulta.turno_id is not None:
        turno = session.get(Turno, consulta.turno_id)
        if turno is not None and turno.estado in ESTADOS_TURNO_ATENDIBLES:
            turno.estado = "atendido"
            session.add(turno)

    if consulta.peso_kg is not None:
        mascota = session.get(Mascota, consulta.mascota_id)
        if mascota is not None:
            mascota.ultimo_peso = consulta.peso_kg
            session.add(mascota)

    session.commit()
    return get_detalle(session, consulta_id)


# ---------------------------------------------------------------------------
# Historial y catálogos
# ---------------------------------------------------------------------------


def listar_consultas(
    session: Session,
    *,
    mascota_id: int | None,
    estado: str | None,
    page: int,
    page_size: int,
) -> ConsultaListResponse:
    filtros = []
    if mascota_id is not None:
        filtros.append(Consulta.mascota_id == mascota_id)
    if estado is not None:
        filtros.append(Consulta.estado == estado)

    total = session.exec(select(func.count()).select_from(Consulta).where(*filtros)).one()
    consultas = session.exec(
        select(Consulta, Mascota)
        .join(Mascota, col(Mascota.id) == col(Consulta.mascota_id))
        .where(*filtros)
        .order_by(col(Consulta.fecha_hora).desc(), col(Consulta.id).desc())
        .offset((page - 1) * page_size)
        .limit(page_size)
    ).all()

    ids = [c.id for c, _ in consultas]
    principales: dict[int, str] = {}
    if ids:
        for dx, patologia in session.exec(
            select(ConsultaDiagnostico, Patologia)
            .join(
                Patologia,
                col(Patologia.id) == col(ConsultaDiagnostico.patologia_id),
                isouter=True,
            )
            .where(
                col(ConsultaDiagnostico.consulta_id).in_(ids),
                ConsultaDiagnostico.tipo_diagnostico == "principal",
            )
        ).all():
            principales[dx.consulta_id] = (
                patologia.nombre if patologia else (dx.descripcion_libre or "")
            )

    return ConsultaListResponse(
        items=[
            ConsultaListItem(
                id=c.id or 0,
                estado=c.estado,  # type: ignore[arg-type]
                fecha_hora=_aware(c.fecha_hora),
                fecha_firma=_aware(c.fecha_firma) if c.fecha_firma else None,
                mascota_id=m.id or 0,
                mascota_nombre=m.nombre,
                motivo=c.motivo,
                diagnostico_principal=principales.get(c.id or 0),
                veterinario_nombre=_nombre_usuario(session, c.veterinario_id),
            )
            for c, m in consultas
        ],
        total=total,
    )


def listar_sintomas(session: Session) -> list[SintomaOpcion]:
    return [
        SintomaOpcion(
            id=s.id or 0, codigo=s.codigo, nombre_es=s.nombre_es, sistema=s.sistema, tipo=s.tipo
        )
        for s in session.exec(
            select(Sintoma)
            .where(col(Sintoma.activo).is_(True))
            .order_by(col(Sintoma.sistema), col(Sintoma.nombre_es))
        ).all()
    ]


def listar_patologias(session: Session) -> list[PatologiaOpcion]:
    return [
        PatologiaOpcion(id=p.id or 0, codigo=p.codigo, nombre=p.nombre)
        for p in session.exec(
            select(Patologia).where(col(Patologia.activo).is_(True)).order_by(col(Patologia.nombre))
        ).all()
    ]
