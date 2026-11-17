import { describe, expect, it } from "vitest";

import {
  DICTADO_DEMO_GENERICO,
  DICTADOS_DEMO,
  armarDiagnosticosFirma,
  avisoEvidencia,
  cambiosFicha,
  dictadoDemoPara,
  edadLabel,
  formatearCronometro,
  mensajeError,
  porcentajeLabel,
  validarFicha,
  type FichaForm,
} from "@/lib/consultas";
import type { SugerenciaItem } from "@/types/consultas";

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
