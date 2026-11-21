import { describe, expect, it } from "vitest";

import {
  armarPayloadVacuna,
  diasLabel,
  dosisPendientes,
  estadoDosisTexto,
  fechaCorta,
  formInicial,
  mensajeErrorApi,
  nombresCoinciden,
  pesoPropuesto,
  proximaDosisSugerida,
  refuerzoSugerido,
  sumarDias,
  validarVacuna,
} from "@/lib/vacunas";
import type { PreventivaConfig, TratamientoPreventivoItem } from "@/types/vacunas";

const CONFIG: PreventivaConfig = {
  dias_refuerzo_vacuna: 365,
  dias_refuerzo_desparasitacion: 90,
  dias_aviso_dosis: 7,
  dias_aviso_dosis_vencida: 30,
};
const HOY = "2026-11-17";

function dosis(overrides: Partial<TratamientoPreventivoItem>): TratamientoPreventivoItem {
  return {
    id: 1,
    mascota_id: 10,
    tipo: "vacunacion",
    producto_id: null,
    nombre_producto: "Vacuna Séxtuple",
    aplicada_en_clinica: false,
    fecha_aplicacion: "2025-11-20",
    fecha_proxima_dosis: "2026-11-20",
    estado_dosis: "por_vencer",
    dias_para_vencer: 3,
    lote: null,
    peso_kg: null,
    refuerzo_de_id: null,
    reforzada_por_id: null,
    consulta_id: null,
    turno_id: null,
    venta_id: null,
    usuario_nombre: "Valeria Sosa",
    observaciones: null,
    fecha_registro: "2026-11-17T21:00:00Z",
    ...overrides,
  };
}

describe("fechas", () => {
  it("test_suma_dias_sin_correrse_por_la_zona_horaria", () => {
    expect(sumarDias("2026-11-17", 365)).toBe("2027-11-17");
    expect(sumarDias("2026-12-31", 1)).toBe("2027-01-01");
    expect(fechaCorta("2026-11-17")).toBe("17/11/2026");
  });

  it("test_proxima_dosis_segun_el_tipo", () => {
    expect(proximaDosisSugerida(HOY, "vacunacion", CONFIG)).toBe("2027-11-17");
    expect(proximaDosisSugerida(HOY, "desparasitacion", CONFIG)).toBe("2027-02-15");
  });

  it("test_dias_en_palabras", () => {
    expect(diasLabel(0)).toBe("vence hoy");
    expect(diasLabel(1)).toBe("vence mañana");
    expect(diasLabel(5)).toBe("vence en 5 días");
    expect(diasLabel(-1)).toBe("venció ayer");
    expect(diasLabel(-10)).toBe("venció hace 10 días");
  });

  it("test_estado_de_la_dosis_en_palabras", () => {
    expect(estadoDosisTexto(dosis({ estado_dosis: "por_vencer", dias_para_vencer: 3 }))).toBe(
      "Vence en 3 días",
    );
    expect(estadoDosisTexto(dosis({ estado_dosis: "vencida", dias_para_vencer: -2 }))).toBe(
      "Venció hace 2 días",
    );
    expect(
      estadoDosisTexto(dosis({ estado_dosis: "al_dia", fecha_proxima_dosis: "2027-11-17" })),
    ).toBe("Al día · próxima 17/11/2027");
    expect(estadoDosisTexto(dosis({ estado_dosis: "reforzada" }))).toBe("Refuerzo aplicado");
  });
});

describe("refuerzos", () => {
  it("test_nombres_que_coinciden", () => {
    expect(nombresCoinciden("Vacuna Séxtuple", "séxtuple (libreta)")).toBe(true);
    expect(nombresCoinciden("Vacuna Antirrábica", "Antirrabica")).toBe(true);
    expect(nombresCoinciden("Vacuna Antirrábica", "Vacuna Séxtuple")).toBe(false);
  });

  it("test_pendientes_solo_del_tipo_y_sin_refuerzo", () => {
    const items = [
      dosis({ id: 1, fecha_proxima_dosis: "2026-11-25" }),
      dosis({ id: 2, fecha_proxima_dosis: "2026-11-20" }),
      dosis({ id: 3, reforzada_por_id: 9 }),
      dosis({ id: 4, tipo: "desparasitacion" }),
      dosis({ id: 5, fecha_proxima_dosis: null, estado_dosis: "sin_refuerzo" }),
    ];
    expect(dosisPendientes(items, "vacunacion").map((i) => i.id)).toEqual([2, 1]);
  });

  it("test_sugiere_la_dosis_del_mismo_producto_vencida_o_por_vencer", () => {
    const items = [
      dosis({ id: 1, nombre_producto: "Antirrábica", estado_dosis: "por_vencer" }),
      dosis({ id: 2, nombre_producto: "Séxtuple (libreta)", estado_dosis: "vencida" }),
      dosis({ id: 3, nombre_producto: "Vacuna Séxtuple", estado_dosis: "al_dia" }),
    ];
    expect(refuerzoSugerido(items, "vacunacion", "Vacuna Séxtuple")).toBe(2);
    expect(refuerzoSugerido(items, "vacunacion", "Vacuna Antirrábica")).toBe(1);
    expect(refuerzoSugerido(items, "vacunacion", "Vacuna Leptospirosis")).toBeNull();
    expect(refuerzoSugerido(items, "desparasitacion", "Séxtuple")).toBeNull();
  });
});

describe("formulario", () => {
  it("test_aplicar_pide_producto_y_proxima_posterior", () => {
    const form = formInicial(HOY, CONFIG, null);
    expect(validarVacuna(form, HOY)).toEqual({ producto_id: "Elegí el producto del stock." });
    const errores = validarVacuna({ ...form, producto_id: "3", fecha_proxima_dosis: HOY }, HOY);
    expect(errores.fecha_proxima_dosis).toBe("Tiene que ser posterior a la aplicación.");
    expect(validarVacuna({ ...form, producto_id: "3", sin_refuerzo: true, fecha_proxima_dosis: "" }, HOY)).toEqual({});
  });

  it("test_el_peso_de_hoy_solo_se_propone_al_aplicar", () => {
    expect(formInicial(HOY, CONFIG, "21.50").peso_kg).toBe("21.5");
    expect(pesoPropuesto("aplicar", "21.50")).toBe("21.5");
    expect(pesoPropuesto("anterior", "21.50")).toBe("");
    expect(pesoPropuesto("aplicar", null)).toBe("");
  });

  it("test_dosis_anterior_pide_nombre_y_fecha_no_futura", () => {
    const form = { ...formInicial(HOY, CONFIG, null), modo: "anterior" as const, fecha_aplicacion: "2026-11-18" };
    const errores = validarVacuna(form, HOY);
    expect(errores.nombre_producto).toBe("Indicá qué se aplicó.");
    expect(errores.fecha_aplicacion).toBe("No puede ser una fecha futura.");
  });

  it("test_valida_el_peso", () => {
    const form = { ...formInicial(HOY, CONFIG, null), producto_id: "3", peso_kg: "200" };
    expect(validarVacuna(form, HOY).peso_kg).toBe("Peso entre 0 y 150 kg.");
  });

  it("test_payload_de_aplicar_con_cobro_y_turno", () => {
    const form = {
      ...formInicial(HOY, CONFIG, "21.50"),
      producto_id: "3",
      lote: " AR-1 ",
      refuerzo_de_id: "2",
      medio_pago: "debito" as const,
    };
    expect(form.peso_kg).toBe("21.5");
    expect(armarPayloadVacuna(form, { mascotaId: 10, turnoId: 7, consultaId: null })).toEqual({
      mascota_id: 10,
      tipo: "vacunacion",
      modo: "aplicar",
      producto_id: 3,
      nombre_producto: null,
      fecha_aplicacion: null,
      fecha_proxima_dosis: "2027-11-17",
      lote: "AR-1",
      peso_kg: "21.5",
      refuerzo_de_id: 2,
      cobrar: true,
      medio_pago: "debito",
      consulta_id: null,
      turno_id: 7,
      observaciones: null,
    });
  });

  it("test_payload_de_dosis_anterior_no_cobra_ni_usa_el_turno", () => {
    const form = {
      ...formInicial(HOY, CONFIG, null),
      modo: "anterior" as const,
      nombre_producto: "Séxtuple (libreta)",
      fecha_aplicacion: "2025-11-20",
      fecha_proxima_dosis: "2026-11-20",
      peso_kg: "21,5",
    };
    const payload = armarPayloadVacuna(form, { mascotaId: 10, turnoId: 7, consultaId: 4 });
    expect(payload).toMatchObject({
      modo: "anterior",
      producto_id: null,
      nombre_producto: "Séxtuple (libreta)",
      fecha_aplicacion: "2025-11-20",
      cobrar: false,
      medio_pago: null,
      turno_id: null,
      consulta_id: 4,
      peso_kg: "21.5",
    });
  });
});

describe("mensajeErrorApi", () => {
  it("test_usa_el_mensaje_de_pydantic_o_el_detalle", () => {
    const de422 = Object.assign(new Error("Unprocessable Entity"), {
      status: 422,
      body: { detail: [{ msg: "Value error, Para cobrar hay que indicar el medio de pago" }] },
    });
    expect(mensajeErrorApi(de422, "x")).toBe("Para cobrar hay que indicar el medio de pago");
    expect(mensajeErrorApi(new Error("La mascota no existe"), "x")).toBe("La mascota no existe");
    expect(mensajeErrorApi(null, "Algo falló")).toBe("Algo falló");
  });
});

describe("turno de vacunación", () => {
  it("test_reconoce_el_tipo_de_turno", async () => {
    const { esTurnoDeVacunacion } = await import("@/lib/vacunas");
    expect(esTurnoDeVacunacion("Vacunación")).toBe(true);
    expect(esTurnoDeVacunacion("vacunacion")).toBe(true);
    expect(esTurnoDeVacunacion("Control")).toBe(false);
  });
});
