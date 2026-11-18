import { describe, expect, it } from "vitest";

import { envioLabel, horaLabel, manana, whatsappLabel } from "@/lib/recordatorios";

describe("recordatorios", () => {
  it("test_manana_a_partir_del_hoy_de_la_clinica", () => {
    expect(manana("2026-11-17")).toBe("2026-11-18");
    expect(manana("2026-12-31")).toBe("2027-01-01");
  });

  it("test_hora_en_24_horas_como_la_agenda", () => {
    expect(horaLabel("2026-11-18T10:00:00")).toBe("10:00");
    expect(horaLabel("2026-11-18T17:45:00")).toBe("17:45");
    expect(horaLabel("2026-11-18T00:30:00")).toBe("00:30");
  });

  it("test_muestra_el_numero_de_whatsapp", () => {
    expect(whatsappLabel("5493406419004")).toBe("+54 9 3406419004");
    expect(whatsappLabel("123")).toBe("123");
  });

  it("test_texto_del_ultimo_envio", () => {
    expect(envioLabel(null, 0)).toBeNull();
    const texto = envioLabel(
      { fecha_envio: "2026-11-17T21:02:00Z", usuario_nombre: "Rita Recepción", destino: "549" },
      2,
    );
    expect(texto).toMatch(/^Enviado el \d{2}\/\d{2}, \d{2}:\d{2} por /);
    expect(texto).not.toMatch(/m\./);
    expect(texto).toContain("por Rita Recepción");
    expect(texto).toContain("(2 envíos)");
  });
});
