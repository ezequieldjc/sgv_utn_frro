import { describe, expect, it } from "vitest";

import {
  INITIAL_FORM,
  buildUpdatePayload,
  fechaNacimientoToIso,
  validateEditForm,
} from "@/pages/mascotas/mascota-edit-page";

describe("edición de mascotas", () => {
  it("test_validacion_exige_tutor_nombre_raza_y_estado", () => {
    const errors = validateEditForm(INITIAL_FORM);

    expect(errors).toEqual({
      persona_id: "Seleccioná un tutor.",
      nombre: "El nombre es obligatorio.",
      raza_id: "Seleccioná una raza.",
      mascota_estado_id: "Seleccioná un estado.",
    });
  });

  it("test_payload_no_incluye_peso_ni_especie", () => {
    const payload = buildUpdatePayload({
      ...INITIAL_FORM,
      persona_id: "10",
      nombre: " Max ",
      especie_id: "1",
      raza_id: "2",
      mascota_estado_id: "1",
      sexo: "M",
      microchip: "CHIP1",
    });

    expect(payload).toMatchObject({
      nombre: "Max",
      persona_id: 10,
      raza_id: 2,
      mascota_estado_id: 1,
      sexo: "M",
      microchip: "CHIP1",
    });
    expect(payload).not.toHaveProperty("especie_id");
    expect(payload).not.toHaveProperty("peso_inicial_kg");
    expect(payload).not.toHaveProperty("tutor_eventual");
  });

  it("test_fecha_mes_anio_se_transforma_al_dia_1", () => {
    const form = {
      ...INITIAL_FORM,
      persona_id: "1",
      nombre: "Firulais",
      raza_id: "2",
      mascota_estado_id: "1",
      fecha_conoce_dia: false,
      fecha_nacimiento: "2018-11",
    };

    expect(fechaNacimientoToIso(form)).toBe("2018-11-01");
    expect(buildUpdatePayload(form).fecha_nacimiento).toBe("2018-11-01");
    expect(validateEditForm(form)).toEqual({});
  });

  it("test_fecha_exacta_se_envia_sin_cambiar_el_dia", () => {
    const form = {
      ...INITIAL_FORM,
      persona_id: "1",
      nombre: "Firulais",
      raza_id: "2",
      mascota_estado_id: "1",
      fecha_conoce_dia: true,
      fecha_nacimiento: "2018-11-15",
    };

    expect(fechaNacimientoToIso(form)).toBe("2018-11-15");
    expect(buildUpdatePayload(form).fecha_nacimiento).toBe("2018-11-15");
    expect(validateEditForm(form)).toEqual({});
  });

  it("test_validacion_fecha_mes_anio_invalida_devuelve_error", () => {
    const errors = validateEditForm({
      ...INITIAL_FORM,
      persona_id: "1",
      nombre: "Firulais",
      raza_id: "2",
      mascota_estado_id: "1",
      fecha_conoce_dia: false,
      fecha_nacimiento: "2018-13",
    });

    expect(errors.fecha_nacimiento).toBeDefined();
  });

  it("test_catalogos_vacios_se_envian_como_null", () => {
    const payload = buildUpdatePayload({
      ...INITIAL_FORM,
      persona_id: "1",
      nombre: "Firulais",
      raza_id: "2",
      mascota_estado_id: "1",
      pelaje_id: "",
      tamanio_id: "",
    });

    expect(payload.pelaje_id).toBeNull();
    expect(payload.tamanio_id).toBeNull();
  });
});
