import { describe, expect, it } from "vitest";

import {
  INITIAL_PRODUCTO_FORM,
  buildProductoCreatePayload,
  buildProductoUpdatePayload,
  previewStockInicial,
  validateProductoForm,
} from "@/pages/stock/producto-form-page";

const FRASCO = {
  ...INITIAL_PRODUCTO_FORM,
  nombre: " Ivermectina 1% 50 ml ",
  rubro_id: "2",
  unidad: "ml" as const,
  contenido_envase: "50",
  fraccionable: true,
  stock_minimo: "2",
  precio_costo: "1000,50",
  precio_venta: "2500",
  envases_iniciales: "10",
  cantidad_abierta_inicial: "30",
};

describe("formulario de producto", () => {
  it("test_validacion_exige_nombre_rubro_y_precio_si_se_vende", () => {
    const errors = validateProductoForm({ ...INITIAL_PRODUCTO_FORM, precio_venta: "" }, "alta");
    expect(errors.nombre).toBeDefined();
    expect(errors.rubro_id).toBeDefined();
    expect(errors.precio_venta).toBe("Ingresá el precio de venta o marcá que no se vende.");
  });

  it("test_producto_que_no_se_vende_no_exige_precio_y_envia_null", () => {
    const form = { ...FRASCO, se_vende: false, precio_venta: "" };
    expect(validateProductoForm(form, "alta")).toEqual({});
    expect(buildProductoCreatePayload(form).precio_venta).toBeNull();
  });

  it("test_payload_alta_normaliza_decimales_y_stock_inicial", () => {
    expect(buildProductoCreatePayload(FRASCO)).toEqual({
      nombre: "Ivermectina 1% 50 ml",
      rubro_id: 2,
      proveedor: null,
      unidad: "ml",
      contenido_envase: "50",
      fraccionable: true,
      stock_minimo: 2,
      precio_costo: "1000.5",
      precio_venta: "2500",
      envases_iniciales: 10,
      cantidad_abierta_inicial: "30",
    });
  });

  it("test_no_fraccionable_no_envia_cantidad_abierta_inicial", () => {
    expect(buildProductoCreatePayload({ ...FRASCO, fraccionable: false }).cantidad_abierta_inicial).toBe("0");
  });

  it("test_payload_edicion_no_incluye_stock_inicial", () => {
    const payload = buildProductoUpdatePayload(FRASCO);
    expect(payload).not.toHaveProperty("envases_iniciales");
    expect(payload).not.toHaveProperty("cantidad_abierta_inicial");
  });

  it("test_preview_stock_inicial", () => {
    expect(previewStockInicial(FRASCO)).toBe("10 cerrados + 30 ml abiertos");
    expect(previewStockInicial({ ...FRASCO, fraccionable: false, envases_iniciales: "1" })).toBe("1 envase");
  });

  it("test_edicion_no_valida_campos_de_stock_inicial", () => {
    expect(validateProductoForm({ ...FRASCO, envases_iniciales: "x" }, "edicion")).toEqual({});
  });
});
