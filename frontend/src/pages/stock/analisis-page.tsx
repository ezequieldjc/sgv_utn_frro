import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CalendarClock, ClipboardCheck, Loader2, PackageMinus, ShoppingCart, Stethoscope, Wallet } from "lucide-react";
import { Bar, BarChart, CartesianGrid, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import "./stock.css";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api";
import { mensajeError } from "@/lib/agenda";
import { fechaIso } from "@/lib/agenda";
import { UNIDAD_LABEL, fmtCantidad, fmtMoneda, formatoStock, hasPermission, num } from "@/lib/stock";
import type { AnalisisResponse, ProductoItem } from "@/types/stock";
import { AccessDenied, BannerError, EncabezadoStock } from "./shared";

const SERIES = [
  { key: "petshop", label: "Pet shop (ventas)", color: "var(--serie-petshop)" },
  { key: "consultorio", label: "Consultorio (uso clínico)", color: "var(--serie-consultorio)" },
] as const;

function hace(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return fechaIso(d);
}

function KpiTile({ icon: Icon, label, value, detalle }: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string;
  detalle?: string;
}) {
  return (
    <div className="rounded-2xl border bg-card p-4 shadow-sm">
      <div className="flex items-center gap-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <Icon className="size-4" />
        {label}
      </div>
      <div className="mt-2 text-2xl font-semibold tabular-nums">{value}</div>
      {detalle ? <div className="text-xs text-muted-foreground">{detalle}</div> : null}
    </div>
  );
}

function ListaAlerta({ titulo, icon: Icon, vacio, children, tono }: {
  titulo: string;
  icon: React.ComponentType<{ className?: string }>;
  vacio: boolean;
  children: React.ReactNode;
  tono: "destructive" | "amber" | "muted";
}) {
  const tonos = {
    destructive: "border-destructive/30",
    amber: "border-amber-500/40",
    muted: "border-border",
  };
  return (
    <section className={`flex flex-col rounded-2xl border bg-card p-4 shadow-sm ${tonos[tono]}`}>
      <h2 className="mb-3 flex items-center gap-2 text-sm font-semibold">
        <Icon className="size-4" />
        {titulo}
      </h2>
      {vacio ? <p className="text-sm text-muted-foreground">Sin alertas.</p> : <ul className="space-y-2">{children}</ul>}
    </section>
  );
}

function FilaProductoAlerta({ p, accion, tipo }: { p: ProductoItem; accion: string; tipo: "ajuste" | "compra" }) {
  return (
    <li className="flex items-start justify-between gap-2 text-sm">
      <div className="min-w-0">
        <div className="truncate font-medium">{p.nombre}</div>
        <div className="text-xs text-muted-foreground">
          {formatoStock(p)}
          {p.stock_minimo > 0 ? ` · mínimo ${p.stock_minimo}` : ""}
        </div>
      </div>
      <Button size="sm" variant="outline" className="shrink-0" asChild>
        <Link to={`/stock/movimientos?producto_id=${p.id}&tipo=${tipo}`}>{accion}</Link>
      </Button>
    </li>
  );
}

interface TooltipProps {
  active?: boolean;
  label?: string;
  payload?: { dataKey: string; value: number }[];
}

function TooltipUso({ active, label, payload }: TooltipProps) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-xl border bg-popover px-3 py-2 text-sm text-popover-foreground shadow-md">
      <div className="mb-1 font-medium">{label}</div>
      {SERIES.map((s) => {
        const item = payload.find((p) => p.dataKey === s.key);
        return (
          <div key={s.key} className="flex items-center gap-2">
            <span className="serie-dot" style={{ background: s.color }} />
            <span className="text-muted-foreground">{s.label}:</span>
            <span className="tabular-nums">{fmtCantidad(item?.value ?? 0)} envases</span>
          </div>
        );
      })}
    </div>
  );
}

export default function AnalisisStockPage() {
  const { permisos } = useAuth();
  const canView = hasPermission(permisos, "stock:ver_analisis");
  const [desde, setDesde] = React.useState(hace(30));
  const [hasta, setHasta] = React.useState(fechaIso(new Date()));
  const [data, setData] = React.useState<AnalisisResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!canView || !desde || !hasta) return;
    let cancelled = false;
    const desdeIso = new Date(`${desde}T00:00:00`).toISOString();
    const hastaDate = new Date(`${hasta}T00:00:00`);
    hastaDate.setDate(hastaDate.getDate() + 1);
    void (async () => {
      setIsLoading(true);
      try {
        const res = await apiFetch<AnalisisResponse>(
          `/api/stock/analisis?desde=${encodeURIComponent(desdeIso)}&hasta=${encodeURIComponent(hastaDate.toISOString())}`,
        );
        if (!cancelled) {
          setData(res);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(mensajeError(err, "No se pudo cargar el análisis."));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canView, desde, hasta]);

  const datosGrafico = React.useMemo(
    () =>
      (data?.uso_por_rubro ?? []).map((r) => ({
        rubro: r.rubro_nombre,
        petshop: num(r.petshop_envases),
        consultorio: num(r.consultorio_envases),
      })),
    [data],
  );

  if (!canView) {
    return <AccessDenied mensaje="No tenés permiso para ver el análisis de stock." volverA="/stock" volverLabel="Volver al inventario" />;
  }

  const totalPetshop = datosGrafico.reduce((a, r) => a + r.petshop, 0);
  const totalConsultorio = datosGrafico.reduce((a, r) => a + r.consultorio, 0);
  const alertas = data?.alertas;

  return (
    <div className="w-full min-w-0 space-y-6">
      <EncabezadoStock titulo="Análisis de stock" subtitulo="Alertas actuales y uso del inventario por destino." />

      {error ? <BannerError>{error}</BannerError> : null}

      <div className="grid gap-4 lg:grid-cols-3">
        <ListaAlerta titulo="Revisar stock" icon={AlertTriangle} tono="destructive" vacio={!alertas?.revisar_stock.length}>
          {alertas?.revisar_stock.map((p) => (
            <FilaProductoAlerta key={p.id} p={p} accion="Registrar recuento" tipo="ajuste" />
          ))}
        </ListaAlerta>
        <ListaAlerta titulo="Bajo el mínimo" icon={PackageMinus} tono="amber" vacio={!alertas?.bajo_minimo.length}>
          {alertas?.bajo_minimo.map((p) => (
            <FilaProductoAlerta key={p.id} p={p} accion="Registrar compra" tipo="compra" />
          ))}
        </ListaAlerta>
        <ListaAlerta
          titulo={`Vencimientos (próximos ${alertas?.dias_alerta_vencimiento ?? 30} días)`}
          icon={CalendarClock}
          tono="muted"
          vacio={!alertas?.proximos_vencimientos.length}
        >
          {alertas?.proximos_vencimientos.map((v) => (
            <li key={v.movimiento_id} className="flex items-start justify-between gap-2 text-sm">
              <div className="min-w-0">
                <div className="truncate font-medium">{v.producto_nombre}</div>
                <div className="text-xs text-muted-foreground">
                  {v.envases_ingresados} envases ingresados · {v.vencido ? "venció" : "vence"} el{" "}
                  {new Date(`${v.fecha_vencimiento}T00:00:00`).toLocaleDateString("es-AR")}
                </div>
              </div>
              <Button size="sm" variant="outline" className="shrink-0" asChild>
                <Link to={`/stock/movimientos?producto_id=${v.producto_id}&tipo=vencimiento_rotura`}>Dar de baja</Link>
              </Button>
            </li>
          ))}
        </ListaAlerta>
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-3 shadow-sm">
        <div className="space-y-1">
          <Label htmlFor="desde">Desde</Label>
          <Input id="desde" type="date" value={desde} max={hasta} onChange={(e) => setDesde(e.target.value)} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="hasta">Hasta</Label>
          <Input id="hasta" type="date" value={hasta} min={desde} onChange={(e) => setHasta(e.target.value)} />
        </div>
        <div className="flex gap-1 pb-0.5">
          {[7, 30, 90].map((d) => (
            <Button key={d} size="sm" variant="outline" onClick={() => { setDesde(hace(d)); setHasta(fechaIso(new Date())); }}>
              {d} días
            </Button>
          ))}
        </div>
        {isLoading ? <Loader2 className="mb-2 size-4 animate-spin text-muted-foreground" /> : null}
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KpiTile icon={ClipboardCheck} label="Productos activos" value={String(data?.productos_activos ?? "—")} />
        <KpiTile icon={Wallet} label="Valor del inventario" value={data ? fmtMoneda(data.valor_inventario_costo) : "—"} detalle="A precio de costo" />
        <KpiTile icon={ShoppingCart} label="Vendido en pet shop" value={`${fmtCantidad(totalPetshop)}`} detalle="Envases en el período" />
        <KpiTile icon={Stethoscope} label="Usado en consultorio" value={`${fmtCantidad(totalConsultorio)}`} detalle="Envases equivalentes en el período" />
      </div>

      <section className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Uso por rubro (envases equivalentes)</h2>
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            {SERIES.map((s) => (
              <span key={s.key} className="flex items-center gap-1.5">
                <span className="serie-dot" style={{ background: s.color }} />
                {s.label}
              </span>
            ))}
          </div>
        </div>
        {datosGrafico.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">No hubo ventas ni consumo clínico en el período.</p>
        ) : (
          <div style={{ height: Math.max(160, datosGrafico.length * 64) }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={datosGrafico} layout="vertical" margin={{ top: 4, right: 48, bottom: 4, left: 8 }} barGap={2} barCategoryGap="28%">
                <CartesianGrid horizontal={false} stroke="hsl(var(--border))" />
                <XAxis type="number" tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }} axisLine={false} tickLine={false} allowDecimals />
                <YAxis type="category" dataKey="rubro" width={120} tick={{ fontSize: 12, fill: "hsl(var(--foreground))" }} axisLine={false} tickLine={false} />
                <Tooltip content={<TooltipUso />} cursor={{ fill: "hsl(var(--muted) / 0.5)" }} />
                {SERIES.map((s) => (
                  <Bar key={s.key} dataKey={s.key} name={s.label} fill={s.color} radius={[0, 4, 4, 0]} maxBarSize={18}>
                    <LabelList
                      dataKey={s.key}
                      position="right"
                      formatter={(v: unknown) => (num(v as number) > 0 ? fmtCantidad(v as number) : "")}
                      style={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
                    />
                  </Bar>
                ))}
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold">Uso por producto</h2>
        <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Producto</TableHead>
                <TableHead>Rubro</TableHead>
                <TableHead className="text-right">Pet shop (envases)</TableHead>
                <TableHead className="text-right">Consultorio</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {(data?.uso_por_producto ?? []).length === 0 ? (
                <TableRow>
                  <TableCell colSpan={4} className="py-8 text-center text-sm text-muted-foreground">
                    Sin movimientos de venta ni consumo clínico en el período.
                  </TableCell>
                </TableRow>
              ) : (
                data?.uso_por_producto.map((u) => (
                  <TableRow key={u.producto_id}>
                    <TableCell className="font-medium">{u.producto_nombre}</TableCell>
                    <TableCell className="text-muted-foreground">{u.rubro_nombre}</TableCell>
                    <TableCell className="text-right tabular-nums">{fmtCantidad(u.petshop_envases)}</TableCell>
                    <TableCell className="text-right tabular-nums">
                      {num(u.consultorio_cantidad) > 0 ? (
                        <>
                          {fmtCantidad(u.consultorio_cantidad)} {UNIDAD_LABEL[u.unidad]}
                          <span className="ml-1 text-xs text-muted-foreground">(≈ {fmtCantidad(u.consultorio_envases)} env.)</span>
                        </>
                      ) : (
                        "0"
                      )}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      </section>
    </div>
  );
}
