import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CheckCircle2, ShieldOff } from "lucide-react";

import { Button } from "@/components/ui/button";
import { ALERTA_CLASE, ALERTA_LABEL } from "@/lib/stock";
import type { AlertaProducto } from "@/types/stock";

export const selectClass =
  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm";

/** Variante para barras de filtros: ancho según el contenido. */
export const selectInlineClass =
  "flex h-9 w-auto rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm";

export function fieldClass(hasError: boolean): string {
  return hasError ? "border-destructive focus-visible:ring-destructive" : "";
}

export function AccessDenied({ mensaje, volverA = "/", volverLabel = "Volver al inicio" }: {
  mensaje: string;
  volverA?: string;
  volverLabel?: string;
}) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
        <ShieldOff className="size-7 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">Acceso denegado</h2>
        <p className="max-w-sm text-sm text-muted-foreground">{mensaje}</p>
      </div>
      <Button type="button" variant="outline" asChild>
        <Link to={volverA}>{volverLabel}</Link>
      </Button>
    </div>
  );
}

export function BannerError({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
      {children}
    </div>
  );
}

export function BannerExito({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 rounded-2xl border border-emerald-500/30 bg-emerald-500/5 px-4 py-3 text-sm text-emerald-700 dark:text-emerald-300">
      <CheckCircle2 className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

/** Advertencias del backend (stock que no alcanzaba, bajo mínimo, etc.). */
export function BannerAdvertencias({ advertencias }: { advertencias: string[] }) {
  if (advertencias.length === 0) {
    return null;
  }
  return (
    <div className="flex items-start gap-2 rounded-2xl border border-amber-500/40 bg-amber-500/10 px-4 py-3 text-sm text-amber-800 dark:text-amber-200">
      <AlertTriangle className="mt-0.5 size-4 shrink-0" />
      <ul className="space-y-1">
        {advertencias.map((a) => (
          <li key={a}>{a}</li>
        ))}
      </ul>
    </div>
  );
}

export function AlertaBadge({ alerta }: { alerta: AlertaProducto }) {
  return (
    <span
      className={`inline-flex items-center gap-1 whitespace-nowrap rounded-full border px-2 py-0.5 text-[11px] font-medium ${ALERTA_CLASE[alerta]}`}
    >
      <AlertTriangle className="size-3" />
      {ALERTA_LABEL[alerta]}
    </span>
  );
}

export function EncabezadoStock({ titulo, subtitulo, acciones }: {
  titulo: string;
  subtitulo: string;
  acciones?: React.ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="space-y-1">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Stock</span>
        <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
        <p className="text-sm text-muted-foreground">{subtitulo}</p>
      </div>
      {acciones}
    </div>
  );
}
