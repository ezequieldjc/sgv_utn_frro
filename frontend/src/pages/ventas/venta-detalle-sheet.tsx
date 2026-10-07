import React from "react";
import { Loader2 } from "lucide-react";

import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { apiFetch } from "@/lib/api";
import { mensajeError } from "@/lib/agenda";
import { MEDIO_PAGO_LABEL, fmtMoneda } from "@/lib/stock";
import type { VentaDetail } from "@/types/ventas";
import { BannerError } from "../stock/shared";

export function VentaDetalleSheet({ ventaId, onClose }: { ventaId: number | null; onClose: () => void }) {
  const [venta, setVenta] = React.useState<VentaDetail | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (ventaId === null) {
      setVenta(null);
      return;
    }
    setError(null);
    apiFetch<VentaDetail>(`/api/ventas/${ventaId}`)
      .then(setVenta)
      .catch((err) => setError(mensajeError(err, "No se pudo cargar la venta.")));
  }, [ventaId]);

  return (
    <Sheet open={ventaId !== null} onOpenChange={(o) => (!o ? onClose() : undefined)}>
      <SheetContent className="flex w-full flex-col gap-4 sm:max-w-md">
        <SheetHeader className="text-left">
          <SheetTitle>Venta #{ventaId}</SheetTitle>
          <SheetDescription>
            {venta
              ? `${new Date(venta.fecha).toLocaleString("es-AR", { dateStyle: "long", timeStyle: "short" })} · ${MEDIO_PAGO_LABEL[venta.medio_pago]}`
              : "Cargando…"}
          </SheetDescription>
        </SheetHeader>
        {error ? <BannerError>{error}</BannerError> : null}
        {!venta && !error ? <Loader2 className="size-5 animate-spin text-muted-foreground" /> : null}
        {venta ? (
          <>
            <dl className="space-y-1 rounded-2xl border bg-card p-4 text-sm">
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Cliente</dt>
                <dd>{venta.cliente_nombre ?? "Sin cliente"}</dd>
              </div>
              <div className="flex justify-between gap-2">
                <dt className="text-muted-foreground">Vendió</dt>
                <dd>{venta.usuario_username}</dd>
              </div>
            </dl>
            <ul className="space-y-2 text-sm">
              {venta.items.map((i) => (
                <li key={i.producto_id} className="flex justify-between gap-2">
                  <span>
                    {i.cantidad} × {i.producto_nombre}
                    <span className="block text-xs text-muted-foreground">{fmtMoneda(i.precio_unitario)} c/u</span>
                  </span>
                  <span className="tabular-nums">{fmtMoneda(i.subtotal)}</span>
                </li>
              ))}
              <li className="flex justify-between border-t pt-2 text-base font-semibold">
                <span>Total</span>
                <span className="tabular-nums">{fmtMoneda(venta.total)}</span>
              </li>
            </ul>
          </>
        ) : null}
      </SheetContent>
    </Sheet>
  );
}
