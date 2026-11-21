import { describe, expect, it } from "vitest";

import {
  esEstadoActivo,
  estadoTurnoLabel,
  fechaAntesDePermitida,
  puedeBuscarHorarios,
  medioPagoLabel,
  mensajePortal,
  pesoLabel,
  resumenMascota,
  tienePortalComoInicio,
  turnoLabel,
} from "@/lib/portal";
import type { PortalMascota } from "@/types/portal";

const COCO: PortalMascota = {
  id: 1,
  nombre: "Coco",
  especie_nombre: "Canina",
  raza_nombre: "Bulldog Francés",
  sexo: "M",
  fecha_nacimiento: "2022-01-10",
  edad_meses: 46,
  ultimo_peso: "13.20",
  estado_nombre: "ACTIVA",
  alertas_medicas: null,
};

describe("portal — helpers", () => {
  it("test_el_estado_activo_no_se_marca", () => {
    // En Neon el estado 1 se llama "Activo"; los demás (En Tránsito, Extraviado) sí se muestran.
    expect(esEstadoActivo("Activo")).toBe(true);
    expect(esEstadoActivo("ACTIVA")).toBe(true);
    expect(esEstadoActivo("En Tránsito / Rescate")).toBe(false);
    expect(esEstadoActivo("Inactivo")).toBe(false);
  });

  it("test_hora_del_turno_en_24_horas", () => {
    expect(turnoLabel("2026-11-26T09:00:00")).toMatch(/, 09:00$/);
    expect(turnoLabel("2026-11-26T17:30:00")).toMatch(/, 17:30$/);
  });

  it("test_tiene_portal_como_inicio_solo_con_el_permiso_explicito", () => {
    expect(tienePortalComoInicio(["portal:ver"])).toBe(true);
    // El comodín ve el menú del portal, pero su inicio sigue siendo el de la clínica.
    expect(tienePortalComoInicio(["*"])).toBe(false);
    expect(tienePortalComoInicio(["consultas:crear"])).toBe(false);
  });

  it("test_resumen_mascota_une_los_datos_y_omite_los_que_faltan", () => {
    expect(resumenMascota(COCO)).toBe("Canina · Bulldog Francés · Macho · 3 años");
    expect(resumenMascota({ ...COCO, sexo: "U", edad_meses: null })).toBe(
      "Canina · Bulldog Francés",
    );
  });

  it("test_labels_de_estado_de_turno_y_medio_de_pago", () => {
    expect(estadoTurnoLabel("no_asistio")).toBe("No asistió");
    expect(estadoTurnoLabel("confirmado")).toBe("Confirmado");
    expect(medioPagoLabel("debito")).toBe("Débito");
  });

  it("test_peso_label_formatea_en_kg_y_devuelve_null_sin_dato", () => {
    expect(pesoLabel("13.20")).toBe("13,2 kg");
    expect(pesoLabel(null)).toBeNull();
  });

  it("test_mensaje_portal_404_no_distingue_ajeno_de_inexistente", () => {
    expect(mensajePortal({ status: 404 }, "esa consulta")).toBe("No encontramos esa consulta.");
    expect(mensajePortal({ status: 403 }, "esa consulta")).toMatch(/no tiene acceso/);
    expect(mensajePortal(new Error("x"), "esa consulta")).toMatch(/No pudimos cargar/);
  });
});

describe("portal — pedir turno", () => {
  const FORM = {
    mascota_id: "1",
    tipo_turno_id: "2",
    veterinario_id: "3",
    fecha: "2026-11-20",
    fecha_hora_inicio: "",
  };

  it("test_puede_buscar_horarios_solo_con_mascota_tipo_veterinario_y_dia", () => {
    expect(puedeBuscarHorarios(FORM)).toBe(true);
    expect(puedeBuscarHorarios({ ...FORM, veterinario_id: "" })).toBe(false);
    expect(puedeBuscarHorarios({ ...FORM, fecha: "" })).toBe(false);
  });

  it("test_fecha_antes_de_permitida_rechaza_hoy_y_acepta_desde_manana", () => {
    expect(fechaAntesDePermitida("2026-11-17", "2026-11-18")).toBe(true);
    expect(fechaAntesDePermitida("2026-11-18", "2026-11-18")).toBe(false);
    expect(fechaAntesDePermitida("", "2026-11-18")).toBe(false);
  });
});
