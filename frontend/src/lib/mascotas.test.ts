import { describe, expect, it } from "vitest";

import {
  esTutorEventual,
  estadoTrasCambioDeTutor,
  estadoValidoParaTutor,
  estadosParaTutor,
  etiquetaAtendibles,
  nombresPermitidos,
} from "@/lib/mascotas";
import type { TutorEventualConfig } from "@/types/mascotas";

const ESTADOS = [
  { id: 1, nombre: "Activo" },
  { id: 3, nombre: "Fallecido" },
  { id: 4, nombre: "Extraviado" },
  { id: 5, nombre: "En Tránsito / Rescate" },
];

const CONFIG: TutorEventualConfig = {
  persona_id: 7,
  estados_permitidos: [
    { id: 5, nombre: "En Tránsito / Rescate" },
    { id: 4, nombre: "Extraviado" },
  ],
  estado_por_defecto_id: 5,
  estado_activa_id: 1,
};

// El parámetro todavía no se cargó en la base: no hay restricción.
const SIN_REGLA: TutorEventualConfig = {
  ...CONFIG,
  estados_permitidos: [],
  estado_por_defecto_id: null,
};

describe("regla del tutor eventual", () => {
  it("test_es_tutor_eventual_compara_con_la_persona_configurada", () => {
    expect(esTutorEventual(CONFIG, "7")).toBe(true);
    expect(esTutorEventual(CONFIG, 7)).toBe(true);
    expect(esTutorEventual(CONFIG, "10")).toBe(false);
    expect(esTutorEventual(CONFIG, "")).toBe(false);
    expect(esTutorEventual(null, "7")).toBe(false);
  });

  it("test_con_tutor_eventual_solo_se_ofrecen_los_estados_permitidos", () => {
    expect(estadosParaTutor(ESTADOS, CONFIG, "7").map((e) => e.nombre)).toEqual([
      "En Tránsito / Rescate",
      "Extraviado",
    ]);
    expect(estadosParaTutor(ESTADOS, CONFIG, "10")).toEqual(ESTADOS);
    expect(estadosParaTutor(ESTADOS, SIN_REGLA, "7")).toEqual(ESTADOS);
  });

  it("test_una_mascota_vieja_del_tutor_eventual_pasa_al_estado_por_defecto", () => {
    expect(estadoValidoParaTutor(CONFIG, "1", "7")).toBe("5");
    expect(estadoValidoParaTutor(CONFIG, "4", "7")).toBe("4");
    expect(estadoValidoParaTutor(CONFIG, "1", "10")).toBe("1");
    expect(estadoValidoParaTutor(SIN_REGLA, "1", "7")).toBe("1");
  });

  it("test_al_asignarle_un_dueno_pasa_a_activa", () => {
    expect(estadoTrasCambioDeTutor(CONFIG, "5", "7", "10")).toBe("1");
    expect(estadoTrasCambioDeTutor(CONFIG, "3", "10", "11")).toBe("3");
    expect(estadoTrasCambioDeTutor(null, "5", "7", "10")).toBe("5");
  });

  it("test_etiquetas_de_los_estados", () => {
    expect(etiquetaAtendibles(ESTADOS, CONFIG)).toBe("Activo, En Tránsito / Rescate o Extraviado");
    expect(etiquetaAtendibles(ESTADOS, SIN_REGLA)).toBe("Activas");
    expect(nombresPermitidos(CONFIG)).toBe("En Tránsito / Rescate o Extraviado");
    expect(nombresPermitidos(null)).toBe("");
  });
});
