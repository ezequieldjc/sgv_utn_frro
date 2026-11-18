import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import { Pill } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api";
import { fechaHoraLabel, hasAnyPermission } from "@/lib/consultas";
import { PERMISOS_RECETAS } from "@/lib/recetas";
import { mensajeErrorApi } from "@/lib/vacunas";
import type { RecetaListResponse } from "@/types/recetas";

import { AccessDenied, BannerError } from "../stock/shared";
import { BotonRecetaPdf } from "./boton-receta-pdf";

export default function RecetasHistorialPage() {
  const [searchParams] = useSearchParams();
  const { permisos } = useAuth();
  const canVer = hasAnyPermission(permisos, PERMISOS_RECETAS);
  const mascotaId = searchParams.get("mascota_id");

  const [data, setData] = React.useState<RecetaListResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [cargando, setCargando] = React.useState(true);

  React.useEffect(() => {
    if (!canVer) {
      return;
    }
    let cancelado = false;
    setCargando(true);
    const params = new URLSearchParams({ page_size: "100" });
    if (mascotaId) {
      params.set("mascota_id", mascotaId);
    }
    void apiFetch<RecetaListResponse>(`/api/recetas?${params.toString()}`)
      .then((res) => !cancelado && setData(res))
      .catch((err: unknown) => !cancelado && setError(mensajeErrorApi(err, "No se pudieron cargar las recetas.")))
      .finally(() => !cancelado && setCargando(false));
    return () => {
      cancelado = true;
    };
  }, [canVer, mascotaId]);

  if (!canVer) {
    return <AccessDenied mensaje="No tenés permiso para ver el historial de recetas." />;
  }

  const nombreMascota = mascotaId ? data?.items[0]?.mascota_nombre : undefined;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Pill className="size-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Recetas</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Historial de recetas{nombreMascota ? ` de ${nombreMascota}` : ""}
          </h1>
          <p className="max-w-3xl text-sm text-muted-foreground">
            Cada consulta firmada con indicaciones de tratamiento tiene su receta en PDF, para
            descargar y enviar al tutor.
          </p>
        </div>
        {mascotaId ? (
          <Button variant="outline" asChild>
            <Link to="/recetas/historial">Ver todas</Link>
          </Button>
        ) : null}
      </div>

      {error ? <BannerError>{error}</BannerError> : null}

      <div className="rounded-2xl border bg-card shadow-sm">
        {cargando ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : data && data.items.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                <TableHead>Paciente</TableHead>
                <TableHead>Diagnóstico</TableHead>
                <TableHead>Indicaciones</TableHead>
                <TableHead>Veterinario</TableHead>
                <TableHead className="text-right">Receta</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((r) => (
                <TableRow key={r.consulta_id}>
                  <TableCell className="whitespace-nowrap align-top">
                    <Link to={`/consultas/${r.consulta_id}`} className="hover:underline">
                      {fechaHoraLabel(r.fecha_firma)}
                    </Link>
                  </TableCell>
                  <TableCell className="align-top">
                    <div className="font-medium">{r.mascota_nombre}</div>
                    <div className="text-xs text-muted-foreground">{r.tutor_nombre}</div>
                  </TableCell>
                  <TableCell className="align-top">{r.diagnostico_principal ?? "—"}</TableCell>
                  <TableCell className="max-w-sm align-top">
                    <p className="line-clamp-2 text-sm">{r.indicaciones}</p>
                  </TableCell>
                  <TableCell className="align-top">{r.veterinario_nombre}</TableCell>
                  <TableCell className="text-right align-top">
                    <BotonRecetaPdf consultaId={r.consulta_id} onError={setError} />
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="p-6 text-sm text-muted-foreground">
            Todavía no hay consultas firmadas con indicaciones de tratamiento.
          </p>
        )}
      </div>
    </div>
  );
}
