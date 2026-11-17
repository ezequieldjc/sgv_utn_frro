import { describe, expect, it } from "vitest";

import {
  DICTADO_DEMO_GENERICO,
  DICTADOS_DEMO,
  armarDiagnosticosFirma,
  avisoEvidencia,
  diaLabel,
  diagnosticoAnterior,
  diasHastaControl,
  evolucionSignos,
  fechaControlSugerida,
  linkProgramarControl,
  cambiosFicha,
  dictadoDemoPara,
  edadLabel,
  formatearCronometro,
  mensajeError,
  porcentajeLabel,
  validarFicha,
  type FichaForm,
} from "@/lib/consultas";
import type {
  ConsultaAnteriorResumen,
  ConsultaDetalle,
  ConsultaSignoItem,
  SugerenciaItem,
} from "@/types/consultas";

const FICHA: FichaForm = {
  motivo: "Ronquidos",
  anamnesis: "",
  examen_fisico: "",
  tratamiento: "",
  observaciones: "",
  peso_kg: "13.2",
  temperatura_c: "38.9",
};

function sugerencia(patologia_id: number, ranking: number): SugerenciaItem {
  return {
    patologia_id,
    codigo: `p-${patologia_id}`,
    nombre: `Patología ${patologia_id}`,
    ranking,
    probabilidad_pct: "50.00",
    estudio_sugerido: null,
    explicacion: {
      prevalencia: 0.01,
      raza: null,
      factores: [],
      edad: null,
      sintomas_presentes: [],
      sintomas_negados: [],
    },
  };
}

const SUGERENCIAS = [sugerencia(1, 1), sugerencia(2, 2), sugerencia(3, 3)];
const SIN_MANUAL = { patologia_id: null, descripcion: "" };

describe("dictado simulado", () => {
  it("test_dictado_demo_usa_el_caso_de_la_raza_o_el_generico", () => {
    expect(dictadoDemoPara({ raza_codigo: "french-bulldog" })).toBe(DICTADOS_DEMO["french-bulldog"]);
    expect(dictadoDemoPara({ raza_codigo: null })).toBe(DICTADO_DEMO_GENERICO);
    expect(dictadoDemoPara({ raza_codigo: "beagle" })).toBe(DICTADO_DEMO_GENERICO);
  });

  it("test_cronometro_formatea_minutos_y_segundos", () => {
    expect(formatearCronometro(42)).toBe("00:42");
    expect(formatearCronometro(125)).toBe("02:05");
  });
});

describe("porcentajes", () => {
  it("test_porcentaje_label_no_muestra_0_ni_100_absolutos", () => {
    expect(porcentajeLabel("100.00")).toBe(">99%");
    expect(porcentajeLabel("0.00")).toBe("<1%");
    expect(porcentajeLabel("61.4")).toBe("61%");
    expect(porcentajeLabel(null)).toBe("—");
  });
});

describe("datos del paciente", () => {
  it("test_edad_en_meses_se_muestra_en_meses_o_anios", () => {
    expect(edadLabel(null)).toBeNull();
    expect(edadLabel(1)).toBe("1 mes");
    expect(edadLabel(8)).toBe("8 meses");
    expect(edadLabel(12)).toBe("1 año");
    expect(edadLabel(65)).toBe("5 años");
  });
});

describe("ficha", () => {
  it("test_validar_ficha_rechaza_peso_y_temperatura_fuera_de_rango", () => {
    expect(validarFicha(FICHA)).toEqual({});
    const errores = validarFicha({ ...FICHA, peso_kg: "380", temperatura_c: "29" });
    expect(errores.peso_kg).toBeDefined();
    expect(errores.temperatura_c).toBeDefined();
    expect(validarFicha({ ...FICHA, peso_kg: "abc" }).peso_kg).toBeDefined();
  });

  it("test_cambios_ficha_envia_solo_lo_modificado_y_vacio_como_null", () => {
    const editada = { ...FICHA, motivo: "Ronquidos fuertes", peso_kg: "13,5", temperatura_c: "" };
    expect(cambiosFicha(editada, FICHA)).toEqual({
      motivo: "Ronquidos fuertes",
      peso_kg: "13.5",
      temperatura_c: null,
    });
    expect(cambiosFicha(FICHA, FICHA)).toEqual({});
  });
});

describe("firma", () => {
  it("test_firma_con_una_sugerencia_aceptada_como_principal", () => {
    const { diagnosticos, error } = armarDiagnosticosFirma(
      SUGERENCIAS,
      { 1: "aceptada", 2: "descartada" },
      1,
      SIN_MANUAL,
    );
    expect(error).toBeNull();
    expect(diagnosticos).toEqual([
      { origen: "sugerido_ia", tipo_diagnostico: "principal", patologia_id: 1, descripcion_libre: null },
    ]);
  });

  it("test_firma_con_manual_principal_y_sugerencia_secundaria", () => {
    const { diagnosticos, error } = armarDiagnosticosFirma(
      SUGERENCIAS,
      { 2: "aceptada" },
      "manual",
      { patologia_id: null, descripcion: "Sobrepeso" },
    );
    expect(error).toBeNull();
    expect(diagnosticos.map((d) => [d.origen, d.tipo_diagnostico])).toEqual([
      ["sugerido_ia", "secundario"],
      ["manual", "principal"],
    ]);
  });

  it("test_firma_sin_diagnosticos_o_sin_principal_devuelve_error", () => {
    expect(armarDiagnosticosFirma(SUGERENCIAS, {}, null, SIN_MANUAL).error).not.toBeNull();
    expect(
      armarDiagnosticosFirma(SUGERENCIAS, { 1: "aceptada" }, null, SIN_MANUAL).error,
    ).toContain("principal");
  });

  it("test_firma_con_manual_que_repite_una_sugerencia_aceptada_devuelve_error", () => {
    const { error } = armarDiagnosticosFirma(
      SUGERENCIAS,
      { 1: "aceptada" },
      1,
      { patologia_id: 1, descripcion: "" },
    );
    expect(error).toContain("repite");
  });
});

describe("errores", () => {
  it("test_mensaje_error_traduce_codigos_conocidos", () => {
    const error = Object.assign(new Error("Conflict"), {
      status: 409,
      body: { error: "SUGERENCIA_NO_VIGENTE", detalle: "x" },
    });
    expect(mensajeError(error)).toContain("Las sugerencias cambiaron");
    expect(mensajeError(Object.assign(new Error(""), { status: 422 }))).toContain("inválidos");
  });
});

describe("evidencia del motor", () => {
  it("test_aviso_evidencia_solo_cuando_otra_causa_pesa_mas", () => {
    const sugerencias = [sugerencia(1, 1)];
    expect(avisoEvidencia(sugerencias, true, "0.40")).toBeNull();
    expect(avisoEvidencia([], false, null)).toBeNull();
    const aviso = avisoEvidencia(sugerencias, false, "90.12");
    expect(aviso).toContain("Evidencia insuficiente");
    expect(aviso).toContain("90%");
  });
});

function signo(codigo: string | null, presente: boolean, nombre = codigo ?? "Sin código"): ConsultaSignoItem {
  return {
    id: Math.floor(Math.random() * 1e6),
    sintoma_id: codigo ? 1 : null,
    codigo,
    nombre,
    sistema: null,
    texto_original: nombre,
    presente,
    origen: "dictado",
    confirmado: true,
    dictado_id: null,
  };
}

// Mediodía en Argentina (15 UTC): el mismo día en cualquier huso horario del runner.
const CONSULTA_COCO = {
  fecha_hora: "2026-11-16T15:00:00Z",
  tratamiento: "Indico reposo, evitar el calor y control en diez días.",
  observaciones: null,
};

describe("controles", () => {
  it("test_dias_hasta_control_lee_numeros_en_letras_y_unidades", () => {
    expect(diasHastaControl("Indico reposo y control en diez días.")).toBe(10);
    expect(diasHastaControl("Radiografía y control en dos semanas")).toBe(14);
    expect(diasHastaControl("Dieta blanda y control en 48 horas")).toBe(2);
    expect(diasHastaControl("Control en una semana")).toBe(7);
    expect(diasHastaControl("control a los 15 dias")).toBe(15);
    expect(diasHastaControl("Indico reposo.")).toBeNull();
    expect(diasHastaControl(null)).toBeNull();
  });

  it("test_fecha_sugerida_suma_los_dias_a_la_consulta", () => {
    expect(fechaControlSugerida(CONSULTA_COCO, new Date(2026, 10, 17))).toBe("2026-11-26");
  });

  it("test_dia_label_muestra_dia_de_semana_y_fecha_corta", () => {
    expect(diaLabel("2026-11-26")).toBe("jueves 26/11");
  });

  it("test_fecha_sugerida_nunca_es_pasada_ni_domingo", () => {
    const vieja = { ...CONSULTA_COCO, fecha_hora: "2026-10-01T15:00:00Z" };
    expect(fechaControlSugerida(vieja, new Date(2026, 10, 17))).toBe("2026-11-17");
    // 16/11 + 6 días = domingo 22/11: pasa al lunes.
    const domingo = { ...CONSULTA_COCO, tratamiento: "control en seis días" };
    expect(fechaControlSugerida(domingo, new Date(2026, 10, 17))).toBe("2026-11-23");
    expect(fechaControlSugerida({ ...CONSULTA_COCO, tratamiento: null }, new Date())).toBeNull();
  });

  it("test_evolucion_de_signos_entre_la_anterior_y_el_control", () => {
    const anteriores = [
      signo("estertor_ronquido", true, "Ronquido"),
      signo("tos", true, "Tos"),
      signo("sincope", false, "Síncope"),
      signo("disnea", true, "Disnea"),
      signo(null, true),
    ];
    const actuales = [
      signo("estertor_ronquido", true, "Ronquido"),
      signo("tos", false, "Tos"),
      signo("vomito", true, "Vómitos"),
    ];

    expect(evolucionSignos(anteriores, actuales).map((f) => [f.codigo, f.cambio])).toEqual([
      ["estertor_ronquido", "persiste"],
      ["tos", "resuelto"],
      ["disnea", "sin_registrar"],
      ["vomito", "nuevo"],
    ]);
  });

  it("test_diagnostico_anterior_toma_el_principal", () => {
    const anterior = {
      diagnosticos: [
        { tipo_diagnostico: "secundario", patologia_id: 9, descripcion_libre: null },
        { tipo_diagnostico: "principal", patologia_id: 3, descripcion_libre: null },
      ],
    } as unknown as ConsultaAnteriorResumen;
    expect(diagnosticoAnterior(anterior)).toEqual({ patologia_id: 3, descripcion: "" });

    const libre = {
      diagnosticos: [{ tipo_diagnostico: "principal", patologia_id: null, descripcion_libre: "Golpe" }],
    } as unknown as ConsultaAnteriorResumen;
    expect(diagnosticoAnterior(libre)).toEqual({ patologia_id: null, descripcion: "Golpe" });
    expect(diagnosticoAnterior(null)).toBeNull();
  });

  it("test_link_programar_control_precarga_el_alta_de_turno", () => {
    const detalle = {
      ...CONSULTA_COCO,
      veterinario_id: 7,
      mascota: { id: 6, nombre: "Coco", especie_nombre: "Canina", tutor_nombre: "Martín Rossi" },
    } as unknown as ConsultaDetalle;

    const url = new URL(linkProgramarControl(detalle, new Date(2026, 10, 17)), "http://x");

    expect(url.pathname).toBe("/agenda/nuevo-turno");
    expect(Object.fromEntries(url.searchParams)).toEqual({
      mascota_id: "6",
      mascota: "Coco (Canina) · Martín Rossi",
      veterinario_id: "7",
      tipo: "Control",
      fecha: "2026-11-26",
    });
  });
});
