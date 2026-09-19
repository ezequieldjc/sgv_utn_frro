import { describe, expect, it } from "vitest";

import {
  INITIAL_FORM,
  buildMascotaPayload,
  fechaNacimientoToIso,
  validateForm,
} from "@/pages/mascotas/mascota-form-page";

describe("alta rápida de mascotas", () => {
  it("test_validacion_exige_tutor_nombre_especie_y_raza", () => {
    const errors = validateForm(INITIAL_FORM);

    expect(errors).toEqual({
      persona_id: "Seleccioná un tutor o marcá tutor eventual.",
      nombre: "El nombre es obligatorio.",
      especie_id: "Seleccioná una especie.",
      raza_id: "Seleccioná una raza.",
    });
  });

  it("test_validacion_tutor_eventual_no_exige_persona_id", () => {
    const errors = validateForm({
      ...INITIAL_FORM,
      tutor_eventual: true,
      nombre: "Firulais",
      especie_id: "1",
      raza_id: "2",
    });

    expect(errors).toEqual({});
  });

  it("test_payload_tutor_eventual_envia_persona_id_null", () => {
    const payload = buildMascotaPayload({
      ...INITIAL_FORM,
      tutor_eventual: true,
      nombre: " Michi ",
      especie_id: "1",
      raza_id: "3",
      peso_inicial_kg: "4,5",
    });

    expect(payload).toMatchObject({
      persona_id: null,
      tutor_eventual: true,
      nombre: "Michi",
      especie_id: 1,
      raza_id: 3,
      peso_inicial_kg: 4.5,
    });
  });

  it("test_fecha_mes_anio_se_transforma_al_dia_1", () => {
    const form = {
      ...INITIAL_FORM,
      tutor_eventual: true,
      nombre: "Firulais",
      especie_id: "1",
      raza_id: "2",
      fecha_conoce_dia: false,
      fecha_nacimiento: "2018-11",
    };

    expect(fechaNacimientoToIso(form)).toBe("2018-11-01");
    expect(buildMascotaPayload(form).fecha_nacimiento).toBe("2018-11-01");
    expect(validateForm(form)).toEqual({});
  });

  it("test_fecha_exacta_se_envia_sin_cambiar_el_dia", () => {
    const form = {
      ...INITIAL_FORM,
      tutor_eventual: true,
      nombre: "Firulais",
      especie_id: "1",
      raza_id: "2",
      fecha_conoce_dia: true,
      fecha_nacimiento: "2018-11-15",
    };

    expect(fechaNacimientoToIso(form)).toBe("2018-11-15");
    expect(buildMascotaPayload(form).fecha_nacimiento).toBe("2018-11-15");
    expect(validateForm(form)).toEqual({});
  });

  it("test_validacion_fecha_mes_anio_invalida_devuelve_error", () => {
    const errors = validateForm({
      ...INITIAL_FORM,
      tutor_eventual: true,
      nombre: "Firulais",
      especie_id: "1",
      raza_id: "2",
      fecha_conoce_dia: false,
      fecha_nacimiento: "2018-13",
    });

    expect(errors.fecha_nacimiento).toBeDefined();
  });
});
