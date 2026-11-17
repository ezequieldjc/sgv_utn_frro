import React from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, PackagePlus, Save } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api";
import { mensajeError } from "@/lib/agenda";
import { UNIDADES, UNIDAD_LABEL, fmtCantidad, hasPermission, num } from "@/lib/stock";
import type {
  ProductoCreatePayload,
  ProductoItem,
  ProductoUpdatePayload,
  RubroOpcion,
  Unidad,
} from "@/types/stock";
import { AccessDenied, BannerError, BannerExito, fieldClass, selectClass } from "./shared";

export interface ProductoFormState {
  nombre: string;
  rubro_id: string;
  proveedor: string;
  unidad: Unidad;
  contenido_envase: string;
  fraccionable: boolean;
  stock_minimo: string;
  precio_costo: string;
  se_vende: boolean;
  precio_venta: string;
  envases_iniciales: string;
  cantidad_abierta_inicial: string;
}

export type ProductoFormErrors = Partial<Record<keyof ProductoFormState, string>>;

export const INITIAL_PRODUCTO_FORM: ProductoFormState = {
  nombre: "",
  rubro_id: "",
  proveedor: "",
  unidad: "unidad",
  contenido_envase: "1",
  fraccionable: false,
  stock_minimo: "0",
  precio_costo: "",
  se_vende: true,
  precio_venta: "",
  envases_iniciales: "0",
  cantidad_abierta_inicial: "0",
};

function entero(value: string, min = 0): boolean {
  const n = num(value);
  return Number.isInteger(n) && n >= min;
}

function decimalValido(value: string, { positivo = false } = {}): boolean {
  const n = num(value);
  return Number.isFinite(n) && (positivo ? n > 0 : n >= 0);
}

export function validateProductoForm(form: ProductoFormState, modo: "alta" | "edicion"): ProductoFormErrors {
  const errors: ProductoFormErrors = {};
  if (!form.nombre.trim()) errors.nombre = "El nombre es obligatorio.";
  if (!form.rubro_id) errors.rubro_id = "Seleccioná un rubro.";
  if (!decimalValido(form.contenido_envase, { positivo: true })) {
    errors.contenido_envase = "Ingresá el contenido por envase (mayor a 0).";
  }
  if (!entero(form.stock_minimo)) errors.stock_minimo = "Ingresá un número entero (0 o más).";
  if (form.precio_costo.trim() && !decimalValido(form.precio_costo)) {
    errors.precio_costo = "Ingresá un precio válido.";
  }
  if (form.se_vende && (!form.precio_venta.trim() || !decimalValido(form.precio_venta))) {
    errors.precio_venta = "Ingresá el precio de venta o marcá que no se vende.";
  }
  if (modo === "alta") {
    if (!entero(form.envases_iniciales)) errors.envases_iniciales = "Ingresá un número entero (0 o más).";
    if (form.fraccionable && !decimalValido(form.cantidad_abierta_inicial)) {
      errors.cantidad_abierta_inicial = "Ingresá una cantidad válida.";
    }
  }
  return errors;
}

function decimal(value: string): string {
  return String(num(value));
}

export function buildProductoCreatePayload(form: ProductoFormState): ProductoCreatePayload {
  return {
    nombre: form.nombre.trim(),
    rubro_id: Number(form.rubro_id),
    proveedor: form.proveedor.trim() || null,
    unidad: form.unidad,
    contenido_envase: decimal(form.contenido_envase),
    fraccionable: form.fraccionable,
    stock_minimo: num(form.stock_minimo),
    precio_costo: form.precio_costo.trim() ? decimal(form.precio_costo) : null,
    precio_venta: form.se_vende ? decimal(form.precio_venta) : null,
    envases_iniciales: num(form.envases_iniciales),
    cantidad_abierta_inicial: form.fraccionable ? decimal(form.cantidad_abierta_inicial) : "0",
  };
}

export function buildProductoUpdatePayload(form: ProductoFormState): ProductoUpdatePayload {
  const { envases_iniciales: _e, cantidad_abierta_inicial: _c, ...resto } = buildProductoCreatePayload(form);
  return resto;
}

export function formDesdeProducto(p: ProductoItem): ProductoFormState {
  return {
    nombre: p.nombre,
    rubro_id: String(p.rubro_id),
    proveedor: p.proveedor ?? "",
    unidad: p.unidad,
    contenido_envase: String(num(p.contenido_envase)),
    fraccionable: p.fraccionable,
    stock_minimo: String(p.stock_minimo),
    precio_costo: p.precio_costo !== null ? String(num(p.precio_costo)) : "",
    se_vende: p.precio_venta !== null,
    precio_venta: p.precio_venta !== null ? String(num(p.precio_venta)) : "",
    envases_iniciales: "0",
    cantidad_abierta_inicial: "0",
  };
}

/** Texto de vista previa del stock inicial: "se verá como: 10 cerrados + 30 ml abiertos". */
export function previewStockInicial(form: ProductoFormState): string {
  const cerrados = num(form.envases_iniciales) || 0;
  if (!form.fraccionable) {
    return `${cerrados} ${cerrados === 1 ? "envase" : "envases"}`;
  }
  return `${cerrados} cerrados + ${fmtCantidad(num(form.cantidad_abierta_inicial) || 0)} ${UNIDAD_LABEL[form.unidad]} abiertos`;
}

export default function ProductoFormPage() {
  const { id } = useParams();
  const modo: "alta" | "edicion" = id ? "edicion" : "alta";
  const { permisos } = useAuth();
  const puede = hasPermission(permisos, modo === "alta" ? "stock:crear_insumo" : "stock:editar_insumo");

  const [form, setForm] = React.useState<ProductoFormState>(INITIAL_PRODUCTO_FORM);
  const [errors, setErrors] = React.useState<ProductoFormErrors>({});
  const [rubros, setRubros] = React.useState<RubroOpcion[]>([]);
  const [isLoading, setIsLoading] = React.useState(modo === "edicion");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [guardado, setGuardado] = React.useState<ProductoItem | null>(null);
  const [stockActual, setStockActual] = React.useState<ProductoItem | null>(null);

  React.useEffect(() => {
    if (!puede) return;
    apiFetch<RubroOpcion[]>("/api/stock/rubros").then(setRubros).catch(() => setRubros([]));
    if (modo === "edicion") {
      void (async () => {
        try {
          const p = await apiFetch<ProductoItem>(`/api/stock/productos/${id}`);
          setForm(formDesdeProducto(p));
          setStockActual(p);
        } catch (err) {
          setSubmitError(mensajeError(err, "No se pudo cargar el producto."));
        } finally {
          setIsLoading(false);
        }
      })();
    }
  }, [puede, modo, id]);

  if (!puede) {
    return (
      <AccessDenied
        mensaje={modo === "alta" ? "No tenés permiso para dar de alta productos." : "No tenés permiso para editar productos."}
        volverA="/stock"
        volverLabel="Volver al inventario"
      />
    );
  }

  function updateField<K extends keyof ProductoFormState>(key: K, value: ProductoFormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (isSubmitting) return;
    const nextErrors = validateProductoForm(form, modo);
    setErrors(nextErrors);
    setSubmitError(null);
    if (Object.keys(nextErrors).length > 0) return;
    setIsSubmitting(true);
    try {
      const producto =
        modo === "alta"
          ? await apiFetch<ProductoItem>("/api/stock/productos", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(buildProductoCreatePayload(form)),
            })
          : await apiFetch<ProductoItem>(`/api/stock/productos/${id}`, {
              method: "PATCH",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(buildProductoUpdatePayload(form)),
            });
      setGuardado(producto);
      setStockActual(producto);
    } catch (err) {
      setSubmitError(mensajeError(err, "No se pudo guardar el producto."));
    } finally {
      setIsSubmitting(false);
    }
  }

  if (isLoading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" /> Cargando producto…
      </p>
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-6">
      <div className="space-y-1">
        <Link to="/stock" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
          <ArrowLeft className="size-4" />
          Volver al inventario
        </Link>
        <h1 className="text-2xl font-semibold tracking-tight">
          {modo === "alta" ? "Alta de producto" : "Editar producto"}
        </h1>
        <p className="text-sm text-muted-foreground">
          {modo === "alta"
            ? "Un mismo producto sirve para el consultorio y el pet shop."
            : "El stock no se edita acá: se modifica con movimientos (compra, consumo, ajuste…)."}
        </p>
      </div>

      {guardado ? (
        <BannerExito>
          <p className="font-medium">{modo === "alta" ? "Producto creado" : "Cambios guardados"}: {guardado.nombre}</p>
          <div className="mt-2 flex flex-wrap gap-2">
            <Button size="sm" asChild>
              <Link to="/stock">Ir al inventario</Link>
            </Button>
            {modo === "alta" ? (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setGuardado(null);
                  setForm({ ...INITIAL_PRODUCTO_FORM, rubro_id: form.rubro_id });
                }}
              >
                Cargar otro
              </Button>
            ) : null}
          </div>
        </BannerExito>
      ) : null}

      <form onSubmit={(e) => void handleSubmit(e)} className="space-y-6">
        <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Datos</h2>
          <div className="space-y-2">
            <Label htmlFor="nombre">Nombre (con presentación)</Label>
            <Input id="nombre" value={form.nombre} onChange={(e) => updateField("nombre", e.target.value)} placeholder="Ej.: Ivermectina 1% 50 ml" className={fieldClass(Boolean(errors.nombre))} />
            {errors.nombre ? <p className="text-xs text-destructive">{errors.nombre}</p> : null}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="rubro_id">Rubro</Label>
              <select id="rubro_id" value={form.rubro_id} onChange={(e) => updateField("rubro_id", e.target.value)} className={`${selectClass} ${fieldClass(Boolean(errors.rubro_id))}`}>
                <option value="">Seleccionar…</option>
                {rubros.map((r) => (
                  <option key={r.id} value={String(r.id)}>
                    {r.nombre}
                  </option>
                ))}
              </select>
              {errors.rubro_id ? <p className="text-xs text-destructive">{errors.rubro_id}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="proveedor">Proveedor (opcional)</Label>
              <Input id="proveedor" value={form.proveedor} onChange={(e) => updateField("proveedor", e.target.value)} />
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Envase y uso</h2>
          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="unidad">Unidad</Label>
              <select id="unidad" value={form.unidad} onChange={(e) => updateField("unidad", e.target.value as Unidad)} className={selectClass}>
                {UNIDADES.map((u) => (
                  <option key={u} value={u}>
                    {UNIDAD_LABEL[u]}
                  </option>
                ))}
              </select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="contenido_envase">Contenido por envase</Label>
              <Input id="contenido_envase" inputMode="decimal" value={form.contenido_envase} onChange={(e) => updateField("contenido_envase", e.target.value)} className={fieldClass(Boolean(errors.contenido_envase))} />
              {errors.contenido_envase ? <p className="text-xs text-destructive">{errors.contenido_envase}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="stock_minimo">Stock mínimo (envases cerrados)</Label>
              <Input id="stock_minimo" inputMode="numeric" value={form.stock_minimo} onChange={(e) => updateField("stock_minimo", e.target.value)} className={fieldClass(Boolean(errors.stock_minimo))} />
              {errors.stock_minimo ? <p className="text-xs text-destructive">{errors.stock_minimo}</p> : null}
            </div>
          </div>
          <div className="flex items-start gap-2">
            <Checkbox
              id="fraccionable"
              checked={form.fraccionable}
              disabled={modo === "edicion" && stockActual !== null && num(stockActual.cantidad_abierta) > 0 && form.fraccionable}
              onCheckedChange={(c) => updateField("fraccionable", c === true)}
            />
            <div className="space-y-0.5">
              <Label htmlFor="fraccionable">Se usa fraccionado en el consultorio</Label>
              <p className="text-xs text-muted-foreground">
                Ej.: un frasco de 50 ml del que se usan algunos ml por consulta. Un collar o una bolsa de alimento no se fraccionan.
              </p>
            </div>
          </div>
        </section>

        <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Precios</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="precio_costo">Precio de costo por envase (opcional)</Label>
              <Input id="precio_costo" inputMode="decimal" value={form.precio_costo} onChange={(e) => updateField("precio_costo", e.target.value)} className={fieldClass(Boolean(errors.precio_costo))} />
              {errors.precio_costo ? <p className="text-xs text-destructive">{errors.precio_costo}</p> : null}
            </div>
            <div className="space-y-2">
              <Label htmlFor="precio_venta">Precio de venta por envase</Label>
              <Input id="precio_venta" inputMode="decimal" disabled={!form.se_vende} value={form.se_vende ? form.precio_venta : ""} placeholder={form.se_vende ? "" : "No se vende en pet shop"} onChange={(e) => updateField("precio_venta", e.target.value)} className={fieldClass(Boolean(errors.precio_venta))} />
              {errors.precio_venta ? <p className="text-xs text-destructive">{errors.precio_venta}</p> : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Checkbox id="se_vende" checked={form.se_vende} onCheckedChange={(c) => updateField("se_vende", c === true)} />
            <Label htmlFor="se_vende">Se vende en el pet shop</Label>
          </div>
        </section>

        {modo === "alta" ? (
          <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Stock inicial</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="envases_iniciales">Envases cerrados</Label>
                <Input id="envases_iniciales" inputMode="numeric" value={form.envases_iniciales} onChange={(e) => updateField("envases_iniciales", e.target.value)} className={fieldClass(Boolean(errors.envases_iniciales))} />
                {errors.envases_iniciales ? <p className="text-xs text-destructive">{errors.envases_iniciales}</p> : null}
              </div>
              {form.fraccionable ? (
                <div className="space-y-2">
                  <Label htmlFor="cantidad_abierta_inicial">Cantidad abierta ({UNIDAD_LABEL[form.unidad]})</Label>
                  <Input id="cantidad_abierta_inicial" inputMode="decimal" value={form.cantidad_abierta_inicial} onChange={(e) => updateField("cantidad_abierta_inicial", e.target.value)} className={fieldClass(Boolean(errors.cantidad_abierta_inicial))} />
                  {errors.cantidad_abierta_inicial ? <p className="text-xs text-destructive">{errors.cantidad_abierta_inicial}</p> : null}
                </div>
              ) : null}
            </div>
            <p className="text-sm text-muted-foreground">
              Se verá como: <span className="font-medium text-foreground">{previewStockInicial(form)}</span>. Queda registrado como un ajuste "Stock inicial".
            </p>
          </section>
        ) : null}

        {submitError ? <BannerError>{submitError}</BannerError> : null}

        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" asChild>
            <Link to="/stock">Cancelar</Link>
          </Button>
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? <Loader2 className="animate-spin" /> : modo === "alta" ? <PackagePlus /> : <Save />}
            {modo === "alta" ? "Crear producto" : "Guardar cambios"}
          </Button>
        </div>
      </form>
    </div>
  );
}
