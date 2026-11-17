import React from "react";
import { Link } from "react-router-dom";
import { ChevronLeft, ChevronRight, Loader2, ShoppingCart } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api";
import { fechaIso, mensajeError } from "@/lib/agenda";
import { MEDIO_PAGO_LABEL, fmtMoneda, hasPermission } from "@/lib/stock";
import type { VentaListItem, VentaListResponse } from "@/types/ventas";
import { AccessDenied, BannerError } from "../stock/shared";
import { VentaDetalleSheet } from "./venta-detalle-sheet";

const PAGE_SIZE = 25;

function hace(dias: number): string {
  const d = new Date();
  d.setDate(d.getDate() - dias);
  return fechaIso(d);
}

export default function VentasPage() {
  const { permisos } = useAuth();
  const canVer = hasPermission(permisos, "ventas:ver");
  const canVender = hasPermission(permisos, "ventas:registrar");
  const [desde, setDesde] = React.useState(hace(30));
  const [hasta, setHasta] = React.useState(fechaIso(new Date()));
  const [ventas, setVentas] = React.useState<VentaListItem[]>([]);
  const [total, setTotal] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [isLoading, setIsLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [seleccionada, setSeleccionada] = React.useState<number | null>(null);

  React.useEffect(() => {
    if (!canVer || !desde || !hasta) return;
    let cancelled = false;
    const hastaDate = new Date(`${hasta}T00:00:00`);
    hastaDate.setDate(hastaDate.getDate() + 1);
    const params = new URLSearchParams({
      desde: new Date(`${desde}T00:00:00`).toISOString(),
      hasta: hastaDate.toISOString(),
      page: String(page),
      page_size: String(PAGE_SIZE),
    });
    void (async () => {
      setIsLoading(true);
      try {
        const data = await apiFetch<VentaListResponse>(`/api/ventas?${params.toString()}`);
        if (!cancelled) {
          setVentas(data.items);
          setTotal(data.total);
          setError(null);
        }
      } catch (err) {
        if (!cancelled) setError(mensajeError(err, "No se pudieron cargar las ventas."));
      } finally {
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canVer, desde, hasta, page]);

  if (!canVer) {
    return <AccessDenied mensaje="No tenés permiso para ver el historial de ventas." />;
  }

  const paginas = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const totalPagina = ventas.reduce((a, v) => a + Number(v.total), 0);

  return (
    <div className="w-full min-w-0 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Ventas</span>
          <h1 className="text-2xl font-semibold tracking-tight">Historial de ventas</h1>
          <p className="text-sm text-muted-foreground">Ventas de mostrador del pet shop.</p>
        </div>
        {canVender ? (
          <Button asChild>
            <Link to="/ventas/nueva">
              <ShoppingCart />
              Nueva venta
            </Link>
          </Button>
        ) : null}
      </div>

      <div className="flex flex-wrap items-end gap-3 rounded-2xl border bg-card p-3 shadow-sm">
        <div className="space-y-1">
          <Label htmlFor="desde">Desde</Label>
          <Input id="desde" type="date" value={desde} max={hasta} onChange={(e) => { setDesde(e.target.value); setPage(1); }} />
        </div>
        <div className="space-y-1">
          <Label htmlFor="hasta">Hasta</Label>
          <Input id="hasta" type="date" value={hasta} min={desde} onChange={(e) => { setHasta(e.target.value); setPage(1); }} />
        </div>
        <div className="ml-auto text-right text-sm">
          <div className="text-muted-foreground">{total} {total === 1 ? "venta" : "ventas"} en el período</div>
          {paginas === 1 ? <div className="text-lg font-semibold tabular-nums">{fmtMoneda(totalPagina)}</div> : null}
        </div>
        {isLoading ? <Loader2 className="mb-2 size-4 animate-spin text-muted-foreground" /> : null}
      </div>

      {error ? <BannerError>{error}</BannerError> : null}

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>#</TableHead>
              <TableHead>Fecha</TableHead>
              <TableHead>Cliente</TableHead>
              <TableHead className="text-right">Ítems</TableHead>
              <TableHead>Medio de pago</TableHead>
              <TableHead className="text-right">Total</TableHead>
              <TableHead>Vendió</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {ventas.length === 0 ? (
              <TableRow>
                <TableCell colSpan={7} className="py-8 text-center text-sm text-muted-foreground">
                  No hay ventas en el período.
                </TableCell>
              </TableRow>
            ) : (
              ventas.map((v) => (
                <TableRow key={v.id} className="cursor-pointer" onClick={() => setSeleccionada(v.id)}>
                  <TableCell className="tabular-nums text-muted-foreground">{v.id}</TableCell>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {new Date(v.fecha).toLocaleString("es-AR", { dateStyle: "short", timeStyle: "short" })}
                  </TableCell>
                  <TableCell>{v.cliente_nombre ?? <span className="text-muted-foreground">Sin cliente</span>}</TableCell>
                  <TableCell className="text-right tabular-nums">{v.cantidad_items}</TableCell>
                  <TableCell>{MEDIO_PAGO_LABEL[v.medio_pago]}</TableCell>
                  <TableCell className="text-right font-medium tabular-nums">{fmtMoneda(v.total)}</TableCell>
                  <TableCell className="text-muted-foreground">{v.usuario_username}</TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {paginas > 1 ? (
        <div className="flex items-center justify-end gap-2 text-sm">
          <Button variant="outline" size="icon" aria-label="Página anterior" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
            <ChevronLeft />
          </Button>
          <span className="tabular-nums">{page} / {paginas}</span>
          <Button variant="outline" size="icon" aria-label="Página siguiente" disabled={page >= paginas} onClick={() => setPage((p) => p + 1)}>
            <ChevronRight />
          </Button>
        </div>
      ) : null}

      <VentaDetalleSheet ventaId={seleccionada} onClose={() => setSeleccionada(null)} />
    </div>
  );
}
