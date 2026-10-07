import React from "react";
import { Link } from "react-router-dom";
import { Loader2, Minus, Plus, Receipt, Search, ShoppingCart, Trash2, UserRound, X } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api";
import { mensajeError } from "@/lib/agenda";
import {
  MEDIO_PAGO_LABEL,
  agregarAlCarrito,
  avisoStockLinea,
  buildVentaPayload,
  cambiarCantidad,
  fmtMoneda,
  hasPermission,
  subtotalLinea,
  totalCarrito,
  type LineaCarrito,
} from "@/lib/stock";
import type { ProductoItem, ProductoListResponse } from "@/types/stock";
import type { ClienteOpcion, MedioPago, VentaResultado } from "@/types/ventas";
import { AccessDenied, BannerAdvertencias, BannerError, BannerExito, selectClass } from "../stock/shared";

const MEDIOS: MedioPago[] = ["efectivo", "debito", "credito", "transferencia"];

function BuscadorCliente({ cliente, onSelect }: { cliente: ClienteOpcion | null; onSelect: (c: ClienteOpcion | null) => void }) {
  const [q, setQ] = React.useState("");
  const [opciones, setOpciones] = React.useState<ClienteOpcion[]>([]);

  React.useEffect(() => {
    if (q.trim().length < 2) {
      setOpciones([]);
      return;
    }
    let cancelled = false;
    const timer = window.setTimeout(() => {
      apiFetch<ClienteOpcion[]>(`/api/ventas/clientes?q=${encodeURIComponent(q.trim())}`)
        .then((rows) => !cancelled && setOpciones(rows))
        .catch(() => !cancelled && setOpciones([]));
    }, 300);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [q]);

  if (cliente) {
    return (
      <div className="flex items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm">
        <span className="flex items-center gap-2">
          <UserRound className="size-4 text-muted-foreground" />
          {cliente.nombre} {cliente.apellido}
          {cliente.dni ? <span className="text-muted-foreground">· DNI {cliente.dni}</span> : null}
        </span>
        <Button type="button" variant="ghost" size="icon" aria-label="Quitar cliente" onClick={() => onSelect(null)}>
          <X />
        </Button>
      </div>
    );
  }
  return (
    <div className="space-y-1">
      <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre, apellido o DNI (opcional)" aria-label="Buscar cliente" />
      {opciones.length > 0 ? (
        <ul className="max-h-40 overflow-auto rounded-md border">
          {opciones.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                className="w-full px-3 py-2 text-left text-sm hover:bg-muted"
                onClick={() => {
                  onSelect(c);
                  setQ("");
                }}
              >
                {c.nombre} {c.apellido}
                {c.dni ? <span className="text-muted-foreground"> · DNI {c.dni}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}

export default function NuevaVentaPage() {
  const { permisos } = useAuth();
  const canVender = hasPermission(permisos, "ventas:registrar");

  const [q, setQ] = React.useState("");
  const [productos, setProductos] = React.useState<ProductoItem[]>([]);
  const [buscando, setBuscando] = React.useState(false);
  const [carrito, setCarrito] = React.useState<LineaCarrito[]>([]);
  const [cliente, setCliente] = React.useState<ClienteOpcion | null>(null);
  const [medioPago, setMedioPago] = React.useState<MedioPago>("efectivo");
  const [confirmando, setConfirmando] = React.useState(false);
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [resultado, setResultado] = React.useState<VentaResultado | null>(null);

  React.useEffect(() => {
    if (!canVender) return;
    let cancelled = false;
    const timer = window.setTimeout(() => {
      const params = new URLSearchParams({ para_venta: "true", page_size: "30" });
      if (q.trim()) params.set("q", q.trim());
      void (async () => {
        setBuscando(true);
        try {
          const data = await apiFetch<ProductoListResponse>(`/api/stock/productos?${params.toString()}`);
          if (!cancelled) setProductos(data.items);
        } catch (err) {
          if (!cancelled) setError(mensajeError(err, "No se pudieron cargar los productos."));
        } finally {
          if (!cancelled) setBuscando(false);
        }
      })();
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [canVender, q, resultado]);

  if (!canVender) {
    return <AccessDenied mensaje="No tenés permiso para registrar ventas." />;
  }

  const total = totalCarrito(carrito);

  async function confirmarVenta() {
    setIsSubmitting(true);
    setError(null);
    try {
      const res = await apiFetch<VentaResultado>("/api/ventas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(buildVentaPayload(carrito, medioPago, cliente?.id ?? null)),
      });
      setResultado(res);
      setCarrito([]);
      setCliente(null);
      setMedioPago("efectivo");
    } catch (err) {
      setError(mensajeError(err, "No se pudo registrar la venta."));
    } finally {
      setIsSubmitting(false);
      setConfirmando(false);
    }
  }

  return (
    <div className="w-full min-w-0 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Ventas</span>
          <h1 className="text-2xl font-semibold tracking-tight">Nueva venta</h1>
          <p className="text-sm text-muted-foreground">Venta de mostrador del pet shop, por envase completo.</p>
        </div>
        <Button variant="outline" asChild>
          <Link to="/ventas">
            <Receipt />
            Historial de ventas
          </Link>
        </Button>
      </div>

      {resultado ? (
        <div className="space-y-2">
          <BannerExito>
            <p className="font-medium">
              Venta #{resultado.venta.id} registrada · {fmtMoneda(resultado.venta.total)} · {MEDIO_PAGO_LABEL[resultado.venta.medio_pago]}
            </p>
            <p className="text-xs">
              {resultado.venta.items.map((i) => `${i.cantidad} × ${i.producto_nombre}`).join(" · ")}
            </p>
          </BannerExito>
          <BannerAdvertencias advertencias={resultado.advertencias} />
        </div>
      ) : null}
      {error ? <BannerError>{error}</BannerError> : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_380px]">
        <section className="space-y-3 rounded-2xl border bg-card p-4 shadow-sm">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar producto…" className="pl-9" aria-label="Buscar producto" />
          </div>
          {buscando ? <p className="text-xs text-muted-foreground">Buscando…</p> : null}
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">
            {productos.map((p) => {
              const enCarrito = carrito.find((l) => l.producto.id === p.id)?.cantidad ?? 0;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    setResultado(null);
                    setCarrito((prev) => agregarAlCarrito(prev, p));
                  }}
                  className="flex flex-col items-start gap-1 rounded-xl border p-3 text-left transition-colors hover:border-primary hover:bg-muted/40"
                >
                  <span className="line-clamp-2 text-sm font-medium">{p.nombre}</span>
                  <span className="text-sm font-semibold tabular-nums">{fmtMoneda(p.precio_venta)}</span>
                  <span className={`text-xs ${p.envases_cerrados > 0 ? "text-muted-foreground" : "text-amber-700 dark:text-amber-300"}`}>
                    {p.envases_cerrados} {p.envases_cerrados === 1 ? "envase cerrado" : "envases cerrados"}
                    {enCarrito ? ` · ${enCarrito} en el carrito` : ""}
                  </span>
                </button>
              );
            })}
            {!buscando && productos.length === 0 ? (
              <p className="col-span-full py-6 text-center text-sm text-muted-foreground">No hay productos a la venta con ese nombre.</p>
            ) : null}
          </div>
        </section>

        <section className="flex flex-col gap-4 rounded-2xl border bg-card p-4 shadow-sm lg:sticky lg:top-4 lg:self-start">
          <h2 className="flex items-center gap-2 text-sm font-semibold">
            <ShoppingCart className="size-4" />
            Carrito
          </h2>
          {carrito.length === 0 ? (
            <p className="text-sm text-muted-foreground">Hacé clic en un producto para agregarlo.</p>
          ) : (
            <ul className="space-y-3">
              {carrito.map((linea) => {
                const aviso = avisoStockLinea(linea);
                return (
                  <li key={linea.producto.id} className="space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <span className="text-sm font-medium">{linea.producto.nombre}</span>
                      <span className="text-sm tabular-nums">{fmtMoneda(subtotalLinea(linea))}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Button type="button" variant="outline" size="icon" className="size-7" aria-label="Restar uno" onClick={() => setCarrito((prev) => cambiarCantidad(prev, linea.producto.id, linea.cantidad - 1))}>
                        <Minus />
                      </Button>
                      <Input
                        aria-label={`Cantidad de ${linea.producto.nombre}`}
                        inputMode="numeric"
                        value={String(linea.cantidad)}
                        onChange={(e) => {
                          const n = Number.parseInt(e.target.value, 10);
                          if (Number.isInteger(n) && n > 0) setCarrito((prev) => cambiarCantidad(prev, linea.producto.id, n));
                        }}
                        className="h-7 w-14 text-center tabular-nums"
                      />
                      <Button type="button" variant="outline" size="icon" className="size-7" aria-label="Sumar uno" onClick={() => setCarrito((prev) => cambiarCantidad(prev, linea.producto.id, linea.cantidad + 1))}>
                        <Plus />
                      </Button>
                      <span className="ml-1 text-xs text-muted-foreground">× {fmtMoneda(linea.producto.precio_venta)}</span>
                      <Button type="button" variant="ghost" size="icon" className="ml-auto size-7" aria-label={`Quitar ${linea.producto.nombre}`} onClick={() => setCarrito((prev) => cambiarCantidad(prev, linea.producto.id, 0))}>
                        <Trash2 />
                      </Button>
                    </div>
                    {aviso ? <p className="text-xs text-amber-700 dark:text-amber-300">{aviso}</p> : null}
                  </li>
                );
              })}
            </ul>
          )}

          <div className="space-y-2">
            <Label>Cliente</Label>
            <BuscadorCliente cliente={cliente} onSelect={setCliente} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="medio_pago">Medio de pago</Label>
            <select id="medio_pago" value={medioPago} onChange={(e) => setMedioPago(e.target.value as MedioPago)} className={selectClass}>
              {MEDIOS.map((m) => (
                <option key={m} value={m}>
                  {MEDIO_PAGO_LABEL[m]}
                </option>
              ))}
            </select>
          </div>
          <div className="flex items-baseline justify-between border-t pt-3">
            <span className="text-sm text-muted-foreground">Total</span>
            <span className="text-2xl font-semibold tabular-nums">{fmtMoneda(total)}</span>
          </div>
          <Button disabled={carrito.length === 0 || isSubmitting} onClick={() => setConfirmando(true)}>
            <Receipt />
            Cobrar
          </Button>
        </section>
      </div>

      <Dialog open={confirmando} onOpenChange={(o) => (!o ? setConfirmando(false) : undefined)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirmar venta</DialogTitle>
            <DialogDescription>
              {carrito.length} {carrito.length === 1 ? "producto" : "productos"} · {MEDIO_PAGO_LABEL[medioPago]}
              {cliente ? ` · ${cliente.nombre} ${cliente.apellido}` : ""}
            </DialogDescription>
          </DialogHeader>
          <ul className="space-y-1 text-sm">
            {carrito.map((l) => (
              <li key={l.producto.id} className="flex justify-between gap-2">
                <span>
                  {l.cantidad} × {l.producto.nombre}
                </span>
                <span className="tabular-nums">{fmtMoneda(subtotalLinea(l))}</span>
              </li>
            ))}
            <li className="flex justify-between border-t pt-2 font-semibold">
              <span>Total</span>
              <span className="tabular-nums">{fmtMoneda(total)}</span>
            </li>
          </ul>
          <DialogFooter>
            <Button variant="outline" disabled={isSubmitting} onClick={() => setConfirmando(false)}>
              Volver
            </Button>
            <Button disabled={isSubmitting} onClick={() => void confirmarVenta()}>
              {isSubmitting ? <Loader2 className="animate-spin" /> : null}
              Confirmar venta
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
