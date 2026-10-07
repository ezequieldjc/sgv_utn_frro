import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { ArrowLeftRight, ChevronLeft, ChevronRight, Loader2, Search, Wand2, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api";
import { mensajeError } from "@/lib/agenda";
import {
  INITIAL_MOVIMIENTO,
  TIPOS_MANUALES,
  TIPO_LABEL,
  UNIDAD_LABEL,
  buildMovimientoPayload,
  fmtCantidad,
  formatoStock,
  hasPermission,
  previewMovimiento,
  validateMovimiento,
  type MovimientoErrors,
  type MovimientoForm,
  type TipoMovimientoManual,
} from "@/lib/stock";
import type {
  MovimientoItem,
  MovimientoListResponse,
  MovimientoResultado,
  ProductoItem,
  ProductoListResponse,
  TipoMovimiento,
} from "@/types/stock";
import {
  AccessDenied,
  AlertaBadge,
  BannerAdvertencias,
  BannerError,
  BannerExito,
  EncabezadoStock,
  fieldClass,
  selectInlineClass,
} from "./shared";

const PAGE_SIZE = 20;

function esTipoManual(value: string | null): value is TipoMovimientoManual {
  return value !== null && (TIPOS_MANUALES as string[]).includes(value);
}

function deltaTexto(m: MovimientoItem): string {
  const partes: string[] = [];
  if (m.delta_envases_cerrados !== 0) {
    partes.push(`${m.delta_envases_cerrados > 0 ? "+" : ""}${m.delta_envases_cerrados} cerr.`);
  }
  const abierta = Number(m.delta_cantidad_abierta);
  if (abierta !== 0) {
    partes.push(`${abierta > 0 ? "+" : ""}${fmtCantidad(abierta)} ${m.unidad} abiertos`);
  }
  return partes.join(" · ");
}

function SelectorProducto({
  producto,
  onSelect,
}: {
  producto: ProductoItem | null;
  onSelect: (p: ProductoItem | null) => void;
}) {
  const [q, setQ] = React.useState("");
  const [opciones, setOpciones] = React.useState<ProductoItem[]>([]);
  const [buscando, setBuscando] = React.useState(false);

  React.useEffect(() => {
    if (q.trim().length < 2) {
      setOpciones([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      void (async () => {
        setBuscando(true);
        try {
          const data = await apiFetch<ProductoListResponse>(`/api/stock/productos?q=${encodeURIComponent(q.trim())}&page_size=15`);
          if (!cancelled) setOpciones(data.items);
        } catch {
          if (!cancelled) setOpciones([]);
        } finally {
          if (!cancelled) setBuscando(false);
        }
      })();
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [q]);

  if (producto) {
    return (
      <div className="flex flex-wrap items-start justify-between gap-3 rounded-xl border bg-muted/30 p-3">
        <div className="space-y-1">
          <p className="font-medium">{producto.nombre}</p>
          <p className="text-sm text-muted-foreground">
            Stock actual: <span className="font-medium text-foreground">{formatoStock(producto)}</span>
            {producto.fraccionable ? ` · envase de ${fmtCantidad(producto.contenido_envase)} ${producto.unidad}` : ""}
          </p>
          <div className="flex flex-wrap gap-1">
            {producto.alertas.map((a) => (
              <AlertaBadge key={a} alerta={a} />
            ))}
          </div>
        </div>
        <Button type="button" variant="ghost" size="sm" onClick={() => onSelect(null)}>
          <X />
          Cambiar
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto (al menos 2 letras)…" className="pl-9" aria-label="Buscar producto" />
      </div>
      {buscando ? <p className="text-xs text-muted-foreground">Buscando…</p> : null}
      {opciones.length > 0 ? (
        <ul className="max-h-56 overflow-auto rounded-md border">
          {opciones.map((p) => (
            <li key={p.id}>
              <button type="button" className="flex w-full flex-col items-start px-3 py-2 text-left text-sm hover:bg-muted" onClick={() => onSelect(p)}>
                <span className="font-medium">{p.nombre}</span>
                <span className="text-xs text-muted-foreground">
                  {p.rubro_nombre} · {formatoStock(p)}
                </span>
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function MovimientosPage() {
  const [searchParams] = useSearchParams();
  const { permisos } = useAuth();
  const canRegistrar = hasPermission(permisos, "stock:registrar_movimiento");
  const canVer = hasPermission(permisos, "stock:ver_movimientos");

  const [producto, setProducto] = React.useState<ProductoItem | null>(null);
  const [form, setForm] = React.useState<MovimientoForm>(() => {
    const tipo = searchParams.get("tipo");
    return { ...INITIAL_MOVIMIENTO, tipo: esTipoManual(tipo) ? tipo : "compra" };
  });
  const [errors, setErrors] = React.useState<MovimientoErrors>({});
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [submitError, setSubmitError] = React.useState<string | null>(null);
  const [resultado, setResultado] = React.useState<MovimientoResultado | null>(null);

  const [historial, setHistorial] = React.useState<MovimientoItem[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [filtroTipo, setFiltroTipo] = React.useState<"" | TipoMovimiento>("");
  const [cargandoHistorial, setCargandoHistorial] = React.useState(false);
  const [recarga, setRecarga] = React.useState(0);

  // Producto preseleccionado desde Inventario o Análisis (?producto_id=).
  React.useEffect(() => {
    const id = searchParams.get("producto_id");
    if (!id || (!canRegistrar && !canVer)) return;
    apiFetch<ProductoItem>(`/api/stock/productos/${id}`).then(setProducto).catch(() => setProducto(null));
  }, [searchParams, canRegistrar, canVer]);

  React.useEffect(() => {
    if (!canVer) return;
    let cancelled = false;
    const params = new URLSearchParams({ page: String(page), page_size: String(PAGE_SIZE) });
    if (producto) params.set("producto_id", String(producto.id));
    if (filtroTipo) params.set("tipo", filtroTipo);
    void (async () => {
      setCargandoHistorial(true);
      try {
        const data = await apiFetch<MovimientoListResponse>(`/api/stock/movimientos?${params.toString()}`);
        if (!cancelled) {
          setHistorial(data.items);
          setTotal(data.total);
        }
      } catch {
        if (!cancelled) setHistorial([]);
      } finally {
        if (!cancelled) setCargandoHistorial(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canVer, producto?.id, filtroTipo, page, recarga]);

  if (!canRegistrar && !canVer) {
    return <AccessDenied mensaje="No tenés permiso para registrar ni ver movimientos de stock." volverA="/stock" volverLabel="Volver al inventario" />;
  }

  function updateField<K extends keyof MovimientoForm>(key: K, value: MovimientoForm[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }

  function cambiarTipo(tipo: TipoMovimientoManual) {
    setForm({ ...INITIAL_MOVIMIENTO, tipo });
    setErrors({});
    setSubmitError(null);
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!producto || isSubmitting) return;
    const nextErrors = validateMovimiento(form, producto);
    setErrors(nextErrors);
    setSubmitError(null);
    if (Object.keys(nextErrors).length > 0) return;
    setIsSubmitting(true);
    try {
      const data = await apiFetch<MovimientoResultado>("/api/stock/movimientos", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildMovimientoPayload(form, producto.id, producto.fraccionable)),
      });
      setResultado(data);
      setProducto(data.producto);
      setForm({ ...INITIAL_MOVIMIENTO, tipo: form.tipo });
      setPage(1);
      setRecarga((n) => n + 1);
    } catch (err) {
      setSubmitError(mensajeError(err, "No se pudo registrar el movimiento."));
    } finally {
      setIsSubmitting(false);
    }
  }

  const preview = producto ? previewMovimiento(producto, form) : null;
  const unidad = producto ? UNIDAD_LABEL[producto.unidad] : "";
  const paginas = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="w-full min-w-0 space-y-6">
      <EncabezadoStock
        titulo="Movimientos"
        subtitulo="Compras, consumo clínico, bajas por vencimiento o rotura y ajustes por recuento."
        acciones={
          <Button variant="outline" asChild>
            <Link to="/stock">Ver inventario</Link>
          </Button>
        }
      />

      {canRegistrar ? (
        <form onSubmit={(e) => void handleSubmit(e)} className="mx-auto max-w-3xl space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">Registrar movimiento</h2>

          <SelectorProducto
            producto={producto}
            onSelect={(p) => {
              setProducto(p);
              setResultado(null);
              setPage(1);
            }}
          />

          <div className="flex flex-wrap gap-1 rounded-md border p-1" role="tablist" aria-label="Tipo de movimiento">
            {TIPOS_MANUALES.map((tipo) => (
              <Button
                key={tipo}
                type="button"
                role="tab"
                aria-selected={form.tipo === tipo}
                size="sm"
                variant={form.tipo === tipo ? "default" : "ghost"}
                className="flex-1"
                onClick={() => cambiarTipo(tipo)}
              >
                {tipo === "ajuste" ? "Ajuste por recuento" : TIPO_LABEL[tipo]}
              </Button>
            ))}
          </div>

          {!producto ? (
            <p className="text-sm text-muted-foreground">Elegí un producto para cargar el movimiento.</p>
          ) : (
            <div className="space-y-4">
              {form.tipo === "compra" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="envases">Envases comprados</Label>
                    <Input id="envases" inputMode="numeric" value={form.envases} onChange={(e) => updateField("envases", e.target.value)} className={fieldClass(Boolean(errors.envases))} />
                    {errors.envases ? <p className="text-xs text-destructive">{errors.envases}</p> : null}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="fecha_vencimiento">Vencimiento (opcional)</Label>
                    <Input id="fecha_vencimiento" type="date" value={form.fecha_vencimiento} onChange={(e) => updateField("fecha_vencimiento", e.target.value)} />
                  </div>
                </div>
              ) : null}

              {form.tipo === "consumo_clinico" ? (
                <div className="space-y-4">
                  <div className="space-y-2 sm:max-w-xs">
                    <Label htmlFor="cantidad">
                      {producto.fraccionable ? `Cantidad usada (${unidad})` : "Envases usados"}
                    </Label>
                    <Input id="cantidad" inputMode="decimal" value={form.cantidad} onChange={(e) => updateField("cantidad", e.target.value)} className={fieldClass(Boolean(errors.cantidad))} />
                    {errors.cantidad ? <p className="text-xs text-destructive">{errors.cantidad}</p> : null}
                  </div>
                  {producto.fraccionable ? (
                    <fieldset className="space-y-2">
                      <legend className="text-sm font-medium">¿De dónde salió?</legend>
                      <label className="flex items-center gap-2 text-sm">
                        <input type="radio" name="origen" checked={form.origen_consumo === "abierto"} onChange={() => updateField("origen_consumo", "abierto")} />
                        De un envase ya abierto
                      </label>
                      <label className="flex flex-wrap items-center gap-2 text-sm">
                        <input type="radio" name="origen" checked={form.origen_consumo === "nuevos"} onChange={() => updateField("origen_consumo", "nuevos")} />
                        Abrí
                        <Input
                          aria-label="Envases abiertos"
                          inputMode="numeric"
                          value={form.envases_abiertos_nuevos}
                          disabled={form.origen_consumo !== "nuevos"}
                          onChange={(e) => updateField("envases_abiertos_nuevos", e.target.value)}
                          className={`h-8 w-16 ${fieldClass(Boolean(errors.envases_abiertos_nuevos))}`}
                        />
                        envase(s) nuevo(s)
                      </label>
                      {errors.envases_abiertos_nuevos ? <p className="text-xs text-destructive">{errors.envases_abiertos_nuevos}</p> : null}
                    </fieldset>
                  ) : null}
                </div>
              ) : null}

              {form.tipo === "vencimiento_rotura" ? (
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-2">
                    <Label htmlFor="envases">Envases cerrados a dar de baja</Label>
                    <Input id="envases" inputMode="numeric" value={form.envases} onChange={(e) => updateField("envases", e.target.value)} className={fieldClass(Boolean(errors.envases))} />
                    {errors.envases ? <p className="text-xs text-destructive">{errors.envases}</p> : null}
                  </div>
                  {producto.fraccionable ? (
                    <div className="space-y-2">
                      <Label htmlFor="cantidad_abierta">Cantidad abierta a dar de baja ({unidad})</Label>
                      <Input id="cantidad_abierta" inputMode="decimal" value={form.cantidad_abierta} onChange={(e) => updateField("cantidad_abierta", e.target.value)} className={fieldClass(Boolean(errors.cantidad_abierta))} />
                      {errors.cantidad_abierta ? <p className="text-xs text-destructive">{errors.cantidad_abierta}</p> : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              {form.tipo === "ajuste" ? (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">
                    El sistema dice <span className="font-medium text-foreground">{formatoStock(producto)}</span>. Cargá lo que contaste en el estante.
                  </p>
                  <div className="grid gap-4 sm:grid-cols-2">
                    <div className="space-y-2">
                      <Label htmlFor="envases_cerrados_real">Envases cerrados contados</Label>
                      <Input id="envases_cerrados_real" inputMode="numeric" value={form.envases_cerrados_real} onChange={(e) => updateField("envases_cerrados_real", e.target.value)} className={fieldClass(Boolean(errors.envases_cerrados_real))} />
                      {errors.envases_cerrados_real ? <p className="text-xs text-destructive">{errors.envases_cerrados_real}</p> : null}
                    </div>
                    {producto.fraccionable ? (
                      <div className="space-y-2">
                        <Label htmlFor="cantidad_abierta_real">Cantidad abierta contada ({unidad})</Label>
                        <Input id="cantidad_abierta_real" inputMode="decimal" value={form.cantidad_abierta_real} onChange={(e) => updateField("cantidad_abierta_real", e.target.value)} className={fieldClass(Boolean(errors.cantidad_abierta_real))} />
                        {errors.cantidad_abierta_real ? <p className="text-xs text-destructive">{errors.cantidad_abierta_real}</p> : null}
                      </div>
                    ) : null}
                  </div>
                </div>
              ) : null}

              <div className="space-y-2">
                <Label htmlFor="observaciones">Observaciones (opcional)</Label>
                <Textarea id="observaciones" rows={2} maxLength={255} value={form.observaciones} onChange={(e) => updateField("observaciones", e.target.value)} />
              </div>

              {preview ? (
                <p className="rounded-xl bg-muted/50 px-3 py-2 text-sm">
                  Quedaría:{" "}
                  <span className="font-medium">
                    {formatoStock({ ...producto, envases_cerrados: preview.cerrados, cantidad_abierta: String(preview.abierta) })}
                  </span>
                  {preview.faltante ? (
                    <span className="block text-amber-700 dark:text-amber-300">
                      Lo que cargaste supera el stock registrado. Se va a registrar igual, el stock queda en 0 y el producto se marca para revisar.
                    </span>
                  ) : null}
                </p>
              ) : null}

              {submitError ? <BannerError>{submitError}</BannerError> : null}

              <div className="flex justify-end">
                <Button type="submit" disabled={isSubmitting}>
                  {isSubmitting ? <Loader2 className="animate-spin" /> : <ArrowLeftRight />}
                  Registrar {form.tipo === "ajuste" ? "recuento" : TIPO_LABEL[form.tipo].toLowerCase()}
                </Button>
              </div>
            </div>
          )}

          {resultado ? (
            <div className="space-y-2">
              <BannerExito>
                {resultado.movimiento
                  ? `Movimiento registrado. ${resultado.producto.nombre}: ${formatoStock(resultado.producto)}.`
                  : `${resultado.producto.nombre}: ${formatoStock(resultado.producto)}.`}
              </BannerExito>
              <BannerAdvertencias advertencias={resultado.advertencias} />
            </div>
          ) : null}
        </form>
      ) : null}

      {canVer ? (
        <section className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-semibold tracking-tight">
              Historial{producto ? ` de ${producto.nombre}` : ""}
            </h2>
            <div className="flex items-center gap-2">
              {cargandoHistorial ? <Loader2 className="size-4 animate-spin text-muted-foreground" /> : null}
              <select
                aria-label="Filtrar por tipo"
                value={filtroTipo}
                onChange={(e) => {
                  setFiltroTipo(e.target.value as "" | TipoMovimiento);
                  setPage(1);
                }}
                className={selectInlineClass}
              >
                <option value="">Todos los tipos</option>
                {(Object.keys(TIPO_LABEL) as TipoMovimiento[]).map((t) => (
                  <option key={t} value={t}>
                    {TIPO_LABEL[t]}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Fecha</TableHead>
                  {!producto ? <TableHead>Producto</TableHead> : null}
                  <TableHead>Tipo</TableHead>
                  <TableHead>Cambio</TableHead>
                  <TableHead>Detalle</TableHead>
                  <TableHead>Usuario</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {historial.length === 0 ? (
                  <TableRow>
                    <TableCell colSpan={6} className="py-8 text-center text-sm text-muted-foreground">
                      No hay movimientos para mostrar.
                    </TableCell>
                  </TableRow>
                ) : (
                  historial.map((m) => {
                    const automatico = (m.observaciones ?? "").startsWith("Ajuste automático");
                    return (
                      <TableRow key={m.id} className={automatico ? "bg-amber-500/5" : ""}>
                        <TableCell className="whitespace-nowrap tabular-nums">
                          {new Date(m.fecha).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}
                        </TableCell>
                        {!producto ? <TableCell>{m.producto_nombre}</TableCell> : null}
                        <TableCell className="whitespace-nowrap">
                          <span className="inline-flex items-center gap-1">
                            {automatico ? <Wand2 className="size-3.5 text-amber-600" /> : null}
                            {automatico ? "Ajuste automático" : TIPO_LABEL[m.tipo]}
                          </span>
                          {m.destino ? (
                            <span className="ml-1 text-xs text-muted-foreground">({m.destino === "petshop" ? "pet shop" : "consultorio"})</span>
                          ) : null}
                        </TableCell>
                        <TableCell className="whitespace-nowrap tabular-nums">{deltaTexto(m)}</TableCell>
                        <TableCell className="max-w-xs text-sm text-muted-foreground">
                          {m.fecha_vencimiento ? `Vence ${new Date(`${m.fecha_vencimiento}T00:00:00`).toLocaleDateString("es-AR")}. ` : ""}
                          {m.venta_id ? `Venta #${m.venta_id}. ` : ""}
                          {m.observaciones ?? ""}
                        </TableCell>
                        <TableCell className="text-muted-foreground">{m.usuario_username}</TableCell>
                      </TableRow>
                    );
                  })
                )}
              </TableBody>
            </Table>
          </div>
          {paginas > 1 ? (
            <div className="flex items-center justify-end gap-2 text-sm">
              <Button variant="outline" size="icon" aria-label="Página anterior" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                <ChevronLeft />
              </Button>
              <span className="tabular-nums">
                {page} / {paginas}
              </span>
              <Button variant="outline" size="icon" aria-label="Página siguiente" disabled={page >= paginas} onClick={() => setPage((p) => p + 1)}>
                <ChevronRight />
              </Button>
            </div>
          ) : null}
        </section>
      ) : null}
    </div>
  );
}
