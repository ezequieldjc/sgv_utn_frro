import { describe, expect, it } from "vitest";

import {
  INITIAL_MOVIMIENTO,
  agregarAlCarrito,
  avisoStockLinea,
  buildMovimientoPayload,
  buildVentaPayload,
  cambiarCantidad,
  equivalenteEnvases,
  fmtCantidad,
  formatoStock,
  num,
  previewMovimiento,
  totalCarrito,
  validateMovimiento,
} from "@/lib/stock";

const FRASCO = {
  envases_cerrados: 3,
  cantidad_abierta: "20.000",
  contenido_envase: "50.000",
  fraccionable: true,
  unidad: "ml" as const,
};
const COLLAR = { ...FRASCO, cantidad_abierta: "0", contenido_envase: "1", fraccionable: false, unidad: "unidad" as const };

describe("formato de stock", () => {
  it("test_num_acepta_coma_decimal_y_strings_del_backend", () => {
    expect(num("2,5")).toBe(2.5);
    expect(num("47.500")).toBe(47.5);
    expect(num("")).toBe(0);
    expect(Number.isNaN(num("abc"))).toBe(true);
  });

  it("test_formato_stock_fraccionable_muestra_cerrados_y_abiertos", () => {
    expect(formatoStock(FRASCO)).toBe("3 cerrados + 20 ml abiertos");
    expect(fmtCantidad("47.500")).toBe("47,5");
  });

  it("test_formato_stock_no_fraccionable_muestra_envases", () => {
    expect(formatoStock({ ...COLLAR, envases_cerrados: 1 })).toBe("1 envase");
    expect(formatoStock(COLLAR)).toBe("3 envases");
  });

  it("test_equivalente_envases_suma_lo_abierto", () => {
    expect(equivalenteEnvases(FRASCO)).toBeCloseTo(3.4);
  });
});

describe("movimientos", () => {
  it("test_consumo_de_envase_ya_abierto_descuenta_solo_lo_abierto", () => {
    const form = { ...INITIAL_MOVIMIENTO, tipo: "consumo_clinico" as const, cantidad: "2,5" };
    expect(previewMovimiento(FRASCO, form)).toEqual({ cerrados: 3, abierta: 17.5, faltante: false });
    expect(buildMovimientoPayload(form, 7, true)).toEqual({
      tipo: "consumo_clinico",
      producto_id: 7,
      cantidad: "2.5",
      envases_abiertos_nuevos: 0,
      observaciones: null,
    });
  });

  it("test_consumo_abriendo_un_envase_nuevo", () => {
    const form = {
      ...INITIAL_MOVIMIENTO,
      tipo: "consumo_clinico" as const,
      cantidad: "2.5",
      origen_consumo: "nuevos" as const,
      envases_abiertos_nuevos: "1",
    };
    expect(previewMovimiento(FRASCO, form)).toEqual({ cerrados: 2, abierta: 67.5, faltante: false });
    expect(buildMovimientoPayload(form, 7, true)).toMatchObject({ envases_abiertos_nuevos: 1 });
  });

  it("test_preview_avisa_faltante_y_deja_en_cero_como_el_backend", () => {
    const form = { ...INITIAL_MOVIMIENTO, tipo: "consumo_clinico" as const, cantidad: "25" };
    expect(previewMovimiento(FRASCO, form)).toEqual({ cerrados: 3, abierta: 0, faltante: true });
    const venta = { ...INITIAL_MOVIMIENTO, tipo: "vencimiento_rotura" as const, envases: "5" };
    expect(previewMovimiento(COLLAR, venta)).toEqual({ cerrados: 0, abierta: 0, faltante: true });
  });

  it("test_ajuste_calcula_desde_los_valores_reales", () => {
    const form = { ...INITIAL_MOVIMIENTO, tipo: "ajuste" as const, envases_cerrados_real: "10", cantidad_abierta_real: "5" };
    expect(previewMovimiento(FRASCO, form)).toEqual({ cerrados: 10, abierta: 5, faltante: false });
    expect(buildMovimientoPayload(form, 7, true)).toMatchObject({ envases_cerrados_real: 10, cantidad_abierta_real: "5" });
  });

  it("test_validacion_consumo_no_fraccionable_exige_envases_enteros", () => {
    const form = { ...INITIAL_MOVIMIENTO, tipo: "consumo_clinico" as const, cantidad: "1,5" };
    expect(validateMovimiento(form, COLLAR).cantidad).toBeDefined();
    expect(validateMovimiento({ ...form, cantidad: "2" }, COLLAR)).toEqual({});
  });

  it("test_validacion_compra_y_baja_sin_cantidades", () => {
    expect(validateMovimiento({ ...INITIAL_MOVIMIENTO, envases: "0" }, FRASCO).envases).toBeDefined();
    const baja = { ...INITIAL_MOVIMIENTO, tipo: "vencimiento_rotura" as const };
    expect(validateMovimiento(baja, FRASCO).envases).toBe("Indicá envases cerrados y/o cantidad abierta a dar de baja.");
  });

  it("test_payload_no_fraccionable_no_envia_cantidad_abierta", () => {
    const form = { ...INITIAL_MOVIMIENTO, tipo: "ajuste" as const, envases_cerrados_real: "4", cantidad_abierta_real: "9" };
    expect(buildMovimientoPayload(form, 3, false)).toMatchObject({ cantidad_abierta_real: "0" });
  });
});

describe("carrito de venta", () => {
  const collar = { id: 1, nombre: "Collar", precio_venta: "800.00", envases_cerrados: 1 };
  const alimento = { id: 2, nombre: "Alimento 3 kg", precio_venta: "12500.50", envases_cerrados: 10 };

  it("test_agregar_mismo_producto_suma_cantidad_y_calcula_total", () => {
    let lineas = agregarAlCarrito([], collar);
    lineas = agregarAlCarrito(lineas, collar);
    lineas = agregarAlCarrito(lineas, alimento);
    expect(lineas.map((l) => l.cantidad)).toEqual([2, 1]);
    expect(totalCarrito(lineas)).toBe(14100.5);
  });

  it("test_cantidad_cero_quita_la_linea", () => {
    const lineas = cambiarCantidad(agregarAlCarrito([], collar), 1, 0);
    expect(lineas).toEqual([]);
  });

  it("test_aviso_si_supera_el_stock_registrado_sin_bloquear", () => {
    expect(avisoStockLinea({ producto: collar, cantidad: 2 })).toContain("El stock registrado es 1");
    expect(avisoStockLinea({ producto: collar, cantidad: 1 })).toBeNull();
  });

  it("test_payload_de_venta_no_envia_precios", () => {
    const payload = buildVentaPayload([{ producto: collar, cantidad: 2 }], "debito", null);
    expect(payload).toEqual({ items: [{ producto_id: 1, cantidad: 2 }], medio_pago: "debito", persona_id: null });
  });
});
