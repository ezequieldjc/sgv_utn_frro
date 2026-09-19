import { describe, expect, it } from "vitest";

import {
  appendTypeaheadChar,
  findTypeaheadMatch,
  normalizeTypeaheadText,
  type SelectTypeaheadBuffer,
} from "@/lib/select-typeahead";

describe("select typeahead", () => {
  const options = [
    { value: "", label: "Todas las razas" },
    { value: "1", label: "Labrador" },
    { value: "2", label: "Caniche" },
    { value: "3", label: "Siames" },
    { value: "4", label: "Sin raza definida" },
  ];

  it("test_typeahead_letra_salta_a_primera_opcion_que_empieza_igual", () => {
    const match = findTypeaheadMatch(options, "s", "");
    expect(match?.value).toBe("3");
  });

  it("test_typeahead_prioriza_opciones_con_valor_sobre_placeholder", () => {
    const match = findTypeaheadMatch(
      [
        { value: "", label: "Seleccionar…" },
        { value: "1", label: "Siames" },
      ],
      "s",
      "",
    );
    expect(match?.value).toBe("1");
  });

  it("test_typeahead_ignora_acentos_al_comparar", () => {
    expect(normalizeTypeaheadText("Canina")).toBe("canina");
    const match = findTypeaheadMatch(
      [
        { value: "1", label: "Canina" },
        { value: "2", label: "Felina" },
      ],
      "c",
      "",
    );
    expect(match?.value).toBe("1");
  });

  it("test_typeahead_misma_letra_repite_cicla_coincidencias", () => {
    const opts = [
      { value: "1", label: "Labrador" },
      { value: "2", label: "Lobo" },
      { value: "3", label: "Caniche" },
    ];
    const first = findTypeaheadMatch(opts, "l", "");
    expect(first?.value).toBe("1");
    const second = findTypeaheadMatch(opts, "l", "1");
    expect(second?.value).toBe("2");
    const third = findTypeaheadMatch(opts, "l", "2");
    expect(third?.value).toBe("1");
  });

  it("test_typeahead_buffer_multicaracter_afina_busqueda", () => {
    const match = findTypeaheadMatch(options, "si", "");
    expect(match?.label).toBe("Siames");
  });

  it("test_typeahead_letra_repetida_no_arma_buffer_ll", () => {
    const buffer: SelectTypeaheadBuffer = { text: "", timer: null };
    expect(appendTypeaheadChar(buffer, "l")).toBe("l");
    expect(appendTypeaheadChar(buffer, "l")).toBe("l");
    if (buffer.timer) {
      clearTimeout(buffer.timer);
    }
  });
});
