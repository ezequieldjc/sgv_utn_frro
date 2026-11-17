import { describe, expect, it } from "vitest";

import {
  INITIAL_TURNO_FORM,
  buildTurnoPayload,
  formDesdeQuery,
  validateTurnoForm,
} from "@/pages/agenda/turno-form-page";

const FORM_COMPLETO = {
  ...INITIAL_TURNO_FORM,
  mascota_id: "3",
  tipo_turno_id: "1",
  veterinario_id: "7",
  fecha: "2030-01-07",
  fecha_hora_inicio: "2030-01-07T12:00:00Z",
};

describe("formulario de nuevo turno", () => {
  it("test_validacion_exige_mascota_tipo_profesional_fecha_y_horario", () => {
    expect(validateTurnoForm(INITIAL_TURNO_FORM)).toEqual({
      mascota_id: "Seleccioná una mascota.",
      tipo_turno_id: "Seleccioná el tipo de turno.",
      veterinario_id: "Seleccioná un profesional.",
      fecha: "Seleccioná una fecha.",
      fecha_hora_inicio: "Elegí un horario disponible.",
    });
  });

  it("test_validacion_form_completo_no_tiene_errores", () => {
    expect(validateTurnoForm(FORM_COMPLETO)).toEqual({});
  });

  it("test_payload_por_defecto_nace_solicitado_por_mostrador", () => {
    expect(buildTurnoPayload(FORM_COMPLETO)).toEqual({
      mascota_id: 3,
      veterinario_id: 7,
      tipo_turno_id: 1,
      fecha_hora_inicio: "2030-01-07T12:00:00Z",
      canal_origen: "mostrador",
      estado_inicial: "solicitado",
    });
  });

  it("test_payload_confirmado_y_canal_telefono", () => {
    const payload = buildTurnoPayload({ ...FORM_COMPLETO, confirmado: true, canal_origen: "telefono" });
    expect(payload.estado_inicial).toBe("confirmado");
    expect(payload.canal_origen).toBe("telefono");
  });

  it("test_prefill_desde_query_toma_profesional_y_fecha", () => {
    const form = formDesdeQuery(new URLSearchParams("veterinario_id=7&fecha=2030-01-07&hora=09:30"));
    expect(form.veterinario_id).toBe("7");
    expect(form.fecha).toBe("2030-01-07");
  });

  it("test_prefill_ignora_fecha_con_formato_invalido", () => {
    expect(formDesdeQuery(new URLSearchParams("fecha=07/01/2030")).fecha).toBe("");
  });
});
