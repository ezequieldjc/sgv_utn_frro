import React from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, CalendarClock, ChevronRight, PawPrint } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch } from "@/lib/api";
import { esEstadoActivo, estadoTurnoLabel, mensajePortal, resumenMascota, turnoLabel } from "@/lib/portal";
import type { PortalMascota, PortalTurno } from "@/types/portal";

import { BannerError } from "../stock/shared";

/** Pide un recurso del portal. `queCosa` arma el mensaje de error ("esa consulta"). */
export function usePortal<T>(url: string | null, queCosa: string) {
  const [data, setData] = React.useState<T | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [cargando, setCargando] = React.useState(true);

  React.useEffect(() => {
    if (url === null) {
      return;
    }
    let cancelado = false;
    setCargando(true);
    setError(null);
    void apiFetch<T>(url)
      .then((res) => {
        if (!cancelado) {
          setData(res);
        }
      })
      .catch((err: unknown) => {
        if (!cancelado) {
          setError(mensajePortal(err, queCosa));
        }
      })
      .finally(() => {
        if (!cancelado) {
          setCargando(false);
        }
      });
    return () => {
      cancelado = true;
    };
  }, [url, queCosa]);

  return { data, error, cargando };
}

export function EncabezadoPortal({
  titulo,
  subtitulo,
  volverA,
  volverLabel,
}: {
  titulo: string;
  subtitulo?: string;
  volverA?: string;
  volverLabel?: string;
}) {
  return (
    <div className="space-y-1">
      {volverA ? (
        <Link to={volverA} className="text-sm text-muted-foreground hover:text-foreground">
          ← {volverLabel ?? "Volver"}
        </Link>
      ) : (
        <div className="flex items-center gap-2 text-muted-foreground">
          <PawPrint className="size-4" />
          <span className="text-xs font-medium uppercase tracking-wider">Mi portal</span>
        </div>
      )}
      <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
      {subtitulo ? <p className="text-sm text-muted-foreground">{subtitulo}</p> : null}
    </div>
  );
}

export function Cargando() {
  return (
    <div className="space-y-3" aria-label="Cargando">
      <Skeleton className="h-20 w-full rounded-2xl" />
      <Skeleton className="h-20 w-full rounded-2xl" />
    </div>
  );
}

export function ErrorPortal({ mensaje }: { mensaje: string }) {
  return <BannerError>{mensaje}</BannerError>;
}

export function Vacio({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed px-4 py-8 text-center text-sm text-muted-foreground">
      {children}
    </div>
  );
}

export function TarjetaLink({ to, children }: { to: string; children: React.ReactNode }) {
  return (
    <Link
      to={to}
      className="flex items-center gap-3 rounded-2xl border bg-card px-4 py-3 transition-colors hover:bg-muted/50"
    >
      <div className="min-w-0 flex-1">{children}</div>
      <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
    </Link>
  );
}

export function MascotaCard({ mascota }: { mascota: PortalMascota }) {
  return (
    <TarjetaLink to={`/portal/mascotas/${mascota.id}`}>
      <div className="flex items-center gap-2">
        <span className="font-medium">{mascota.nombre}</span>
        {!esEstadoActivo(mascota.estado_nombre) ? (
          <Badge variant="secondary">{mascota.estado_nombre}</Badge>
        ) : null}
      </div>
      <p className="truncate text-sm text-muted-foreground">{resumenMascota(mascota)}</p>
      {mascota.alertas_medicas ? (
        <p className="mt-1 flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
          <AlertTriangle className="size-3" /> {mascota.alertas_medicas}
        </p>
      ) : null}
    </TarjetaLink>
  );
}

const VARIANTE_ESTADO: Record<string, "default" | "secondary" | "destructive" | "outline"> = {
  confirmado: "default",
  solicitado: "secondary",
  atendido: "outline",
  cancelado: "destructive",
  no_asistio: "destructive",
};

export function TurnoFila({ turno, children }: { turno: PortalTurno; children?: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl border bg-card px-4 py-3">
      <CalendarClock className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="font-medium capitalize">{turnoLabel(turno.fecha_hora_inicio)}</p>
        <p className="text-sm text-muted-foreground">
          {turno.tipo_turno_nombre} de {turno.mascota_nombre} con {turno.veterinario_nombre}
        </p>
        {children}
      </div>
      <Badge variant={VARIANTE_ESTADO[turno.estado] ?? "secondary"}>
        {estadoTurnoLabel(turno.estado)}
      </Badge>
    </div>
  );
}
