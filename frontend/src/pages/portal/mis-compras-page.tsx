import React from "react";
import { ChevronDown, ChevronRight } from "lucide-react";

import { apiFetch } from "@/lib/api";
import { fechaLabel, medioPagoLabel, mensajePortal, montoLabel } from "@/lib/portal";
import type { PortalCompraDetalle, PortalCompraItem } from "@/types/portal";

import {
  Cargando,
  EncabezadoPortal,
  ErrorPortal,
  usePortal,
  Vacio,
} from "./portal-componentes";

function CompraFila({ compra }: { compra: PortalCompraItem }) {
  const [abierta, setAbierta] = React.useState(false);
  const [detalle, setDetalle] = React.useState<PortalCompraDetalle | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  function alternar() {
    const abrir = !abierta;
    setAbierta(abrir);
    if (abrir && detalle === null) {
      setError(null);
      void apiFetch<PortalCompraDetalle>(`/api/portal/compras/${compra.id}`)
        .then(setDetalle)
        .catch((err: unknown) => setError(mensajePortal(err, "esa compra")));
    }
  }

  const Icono = abierta ? ChevronDown : ChevronRight;
  return (
    <div className="rounded-2xl border bg-card">
      <button
        type="button"
        onClick={alternar}
        aria-expanded={abierta}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <div className="min-w-0 flex-1">
          <p className="font-medium">{fechaLabel(compra.fecha)}</p>
          <p className="text-sm text-muted-foreground">
            {compra.cantidad_items === 1 ? "1 producto" : `${compra.cantidad_items} productos`} ·{" "}
            {medioPagoLabel(compra.medio_pago)}
          </p>
        </div>
        <span className="font-semibold">{montoLabel(compra.total)}</span>
        <Icono className="size-4 shrink-0 text-muted-foreground" />
      </button>
      {abierta ? (
        <div className="border-t px-4 py-3 text-sm">
          {error ? <ErrorPortal mensaje={error} /> : null}
          {!detalle && !error ? <p className="text-muted-foreground">Cargando…</p> : null}
          {detalle ? (
            <ul className="space-y-1">
              {detalle.items.map((item, i) => (
                <li key={i} className="flex justify-between gap-3">
                  <span>
                    {item.cantidad} × {item.producto_nombre}
                  </span>
                  <span className="text-muted-foreground">{montoLabel(item.subtotal)}</span>
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default function MisComprasPage() {
  const { data, error, cargando } = usePortal<PortalCompraItem[]>(
    "/api/portal/compras",
    "tus compras",
  );

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <EncabezadoPortal
        titulo="Mis compras"
        subtitulo="Lo que compraste en la clínica y en el pet shop."
      />
      {cargando ? <Cargando /> : null}
      {error ? <ErrorPortal mensaje={error} /> : null}
      {data && data.length === 0 ? <Vacio>Todavía no tenés compras registradas.</Vacio> : null}
      <div className="space-y-3">
        {data?.map((c) => <CompraFila key={c.id} compra={c} />)}
      </div>
    </div>
  );
}
