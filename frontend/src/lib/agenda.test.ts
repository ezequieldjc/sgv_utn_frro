import { describe, expect, it } from "vitest";

import {
  inicioPreseleccionado,
  resumenFranjas,
  accionesDisponibles,
  diaSemanaBackend,
  estaEnHorario,
  limitesHorario,
  mensajeError,
  puedeArrastrar,
  rangoParaVista,
  turnoToEvento,
} from "@/lib/agenda";
import type { FranjaDisponible, HorarioAtencion, TurnoItem } from "@/types/agenda";

const RECEPCION = ["agenda:ver", "agenda:crear_turno", "agenda:editar_turno", "agenda:cancelar_turno"];
const AHORA = new Date(2030, 0, 7, 10, 0); // lunes 07/01/2030 10:00

const HORARIO: HorarioAtencion = {
  zona_horaria: "America/Argentina/Buenos_Aires",
  duracion_modulo_min: 30,
  dias: [
    ...[0, 1, 2, 3, 4].map((dia) => ({
      dia_semana: dia,
      franjas: [
        { desde: "08:00", hasta: "12:00" },
        { desde: "15:00", hasta: "20:00" },
      ],
    })),
    { dia_semana: 5, franjas: [{ desde: "08:00", hasta: "12:00" }] },
    { dia_semana: 6, franjas: [] },
  ],
};

function turno(parcial: Partial<TurnoItem> = {}): TurnoItem {
  return {
    id: 1,
    mascota_id: 1,
    mascota_nombre: "Firulais",
    tutor_id: 1,
    tutor_nombre: "Ana",
    tutor_apellido: "Gomez",
    tutor_celular: "341555000",
    veterinario_id: 7,
    veterinario_nombre: "Laura",
    veterinario_apellido: "Perez",
    tipo_turno_id: 1,
    tipo_turno_nombre: "Consulta",
    fecha_hora_inicio: new Date(2030, 0, 8, 9, 0).toISOString(),
    fecha_hora_fin: new Date(2030, 0, 8, 9, 30).toISOString(),
    estado: "solicitado",
    canal_origen: "mostrador",
    ...parcial,
  };
}

describe("acciones disponibles por estado y permisos", () => {
  it("test_turno_solicitado_futuro_permite_confirmar_reprogramar_y_cancelar", () => {
    expect(accionesDisponibles(turno(), RECEPCION, AHORA)).toEqual([
      "confirmar",
      "reprogramar",
      "cancelar",
    ]);
  });

  it("test_turno_confirmado_futuro_no_permite_marcar_realizado", () => {
    expect(accionesDisponibles(turno({ estado: "confirmado" }), RECEPCION, AHORA)).toEqual([
      "reprogramar",
      "cancelar",
    ]);
  });

  it("test_turno_confirmado_ya_iniciado_permite_realizado_y_no_asistio", () => {
    const pasado = turno({
      estado: "confirmado",
      fecha_hora_inicio: new Date(2030, 0, 7, 9, 0).toISOString(),
    });
    expect(accionesDisponibles(pasado, RECEPCION, AHORA)).toEqual([
      "realizado",
      "no_asistio",
      "reprogramar",
      "cancelar",
    ]);
  });

  it("test_turno_realizado_o_cancelado_no_tiene_acciones", () => {
    expect(accionesDisponibles(turno({ estado: "realizado" }), RECEPCION, AHORA)).toEqual([]);
    expect(accionesDisponibles(turno({ estado: "cancelado" }), RECEPCION, AHORA)).toEqual([]);
  });

  it("test_sin_permiso_cancelar_no_ofrece_cancelar", () => {
    const permisos = ["agenda:ver", "agenda:editar_turno"];
    expect(accionesDisponibles(turno(), permisos, AHORA)).not.toContain("cancelar");
  });

  it("test_solo_ver_no_ofrece_ninguna_accion", () => {
    expect(accionesDisponibles(turno(), ["agenda:ver"], AHORA)).toEqual([]);
  });

  it("test_comodin_habilita_todas_las_acciones_validas", () => {
    expect(accionesDisponibles(turno(), ["*"], AHORA)).toEqual([
      "confirmar",
      "reprogramar",
      "cancelar",
    ]);
  });

  it("test_arrastrar_requiere_editar_y_estado_modificable", () => {
    expect(puedeArrastrar(turno(), RECEPCION)).toBe(true);
    expect(puedeArrastrar(turno({ estado: "realizado" }), RECEPCION)).toBe(false);
    expect(puedeArrastrar(turno(), ["agenda:ver"])).toBe(false);
  });
});

describe("helpers de calendario", () => {
  it("test_turno_a_evento_usa_veterinario_como_recurso", () => {
    const evento = turnoToEvento(turno());
    expect(evento.resourceId).toBe(7);
    expect(evento.title).toBe("Firulais · Consulta");
    expect(evento.end.getTime() - evento.start.getTime()).toBe(30 * 60 * 1000);
  });

  it("test_rango_vista_semana_va_de_lunes_a_lunes", () => {
    const { desde, hasta } = rangoParaVista("week", new Date(2030, 0, 10)); // jueves
    expect(desde).toEqual(new Date(2030, 0, 7));
    expect(hasta).toEqual(new Date(2030, 0, 14));
  });

  it("test_rango_vista_dia_cubre_un_dia", () => {
    const { desde, hasta } = rangoParaVista("day", new Date(2030, 0, 10, 15, 30));
    expect(desde).toEqual(new Date(2030, 0, 10));
    expect(hasta).toEqual(new Date(2030, 0, 11));
  });

  it("test_dia_semana_backend_lunes_es_0_y_domingo_6", () => {
    expect(diaSemanaBackend(new Date(2030, 0, 7))).toBe(0);
    expect(diaSemanaBackend(new Date(2030, 0, 13))).toBe(6);
  });

  it("test_esta_en_horario_respeta_franjas_y_sabado_por_la_tarde", () => {
    expect(estaEnHorario(new Date(2030, 0, 7, 9, 0), HORARIO)).toBe(true);
    expect(estaEnHorario(new Date(2030, 0, 7, 13, 0), HORARIO)).toBe(false);
    expect(estaEnHorario(new Date(2030, 0, 7, 12, 0), HORARIO)).toBe(false);
    expect(estaEnHorario(new Date(2030, 0, 12, 10, 0), HORARIO)).toBe(true);
    expect(estaEnHorario(new Date(2030, 0, 12, 16, 0), HORARIO)).toBe(false);
    expect(estaEnHorario(new Date(2030, 0, 13, 10, 0), HORARIO)).toBe(false);
  });

  it("test_limites_horario_toma_primera_y_ultima_franja", () => {
    const { min, max } = limitesHorario(HORARIO);
    expect([min.getHours(), min.getMinutes()]).toEqual([8, 0]);
    expect([max.getHours(), max.getMinutes()]).toEqual([20, 0]);
  });
});

describe("mensajes de error", () => {
  it("test_mensaje_error_traduce_codigo_del_backend", () => {
    const error = Object.assign(new Error("detalle backend"), {
      status: 409,
      body: { error: "TURNO_SUPERPUESTO", detalle: "x" },
    });
    expect(mensajeError(error)).toBe("El veterinario ya tiene un turno en ese horario.");
  });

  it("test_mensaje_error_codigo_desconocido_usa_detalle", () => {
    const error = Object.assign(new Error("Algo raro"), { body: { error: "OTRO" } });
    expect(mensajeError(error)).toBe("Algo raro");
  });
});

function franja(hh: number, mm: number, disponible: boolean): FranjaDisponible {
  const inicio = new Date(2030, 0, 7, hh, mm);
  return {
    fecha_hora_inicio: inicio.toISOString(),
    fecha_hora_fin: new Date(inicio.getTime() + 30 * 60000).toISOString(),
    disponible,
    motivo: disponible ? null : "OCUPADO_VETERINARIO",
    detalle: disponible ? null : "Ocupado",
  };
}

describe("grilla de horarios", () => {
  const FRANJAS = [franja(8, 0, true), franja(8, 30, false), franja(9, 0, true)];

  it("test_resumen_cuenta_libres_y_no_disponibles", () => {
    expect(resumenFranjas(FRANJAS)).toEqual({ libres: 2, noDisponibles: 1 });
  });

  it("test_preseleccion_mantiene_inicio_actual_si_sigue_libre", () => {
    expect(inicioPreseleccionado(FRANJAS, FRANJAS[2].fecha_hora_inicio)).toBe(FRANJAS[2].fecha_hora_inicio);
  });

  it("test_preseleccion_descarta_inicio_que_quedo_no_disponible", () => {
    expect(inicioPreseleccionado(FRANJAS, FRANJAS[1].fecha_hora_inicio)).toBe("");
  });

  it("test_preseleccion_por_hora_solo_si_esta_libre", () => {
    expect(inicioPreseleccionado(FRANJAS, "", "09:00")).toBe(FRANJAS[2].fecha_hora_inicio);
    expect(inicioPreseleccionado(FRANJAS, "", "08:30")).toBe("");
  });
});
