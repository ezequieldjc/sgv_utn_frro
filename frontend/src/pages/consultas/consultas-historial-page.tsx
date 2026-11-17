import React from "react";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { ClipboardList, Plus } from "lucide-react";

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
import {
  PERMISOS_HISTORIAL,
  fechaHoraLabel,
  hasAnyPermission,
  hasPermission,
  mensajeError,
} from "@/lib/consultas";
import type { ConsultaListResponse, EstadoConsulta } from "@/types/consultas";

import { AccessDenied, BannerError, selectInlineClass } from "../stock/shared";

type FiltroEstado = "" | EstadoConsulta;

export default function ConsultasHistorialPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const { permisos } = useAuth();
  const canVer = hasAnyPermission(permisos, PERMISOS_HISTORIAL);
  const canCrear = hasPermission(permisos, "consultas:crear");

  const mascotaId = searchParams.get("mascota_id");
  // En la historia clínica de una mascota, por defecto solo las firmadas.
  const estado = (searchParams.get("estado") ?? (mascotaId ? "firmada" : "")) as FiltroEstado;

  const [data, setData] = React.useState<ConsultaListResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [cargando, setCargando] = React.useState(true);

  React.useEffect(() => {
    if (!canVer) {
      return;
    }
    let cancelado = false;
    setCargando(true);
    setError(null);
    const params = new URLSearchParams({ page_size: "100" });
    if (mascotaId) {
      params.set("mascota_id", mascotaId);
    }
    if (estado) {
      params.set("estado", estado);
    }
    void apiFetch<ConsultaListResponse>(`/api/consultas?${params.toString()}`)
      .then((res) => {
        if (!cancelado) {
          setData(res);
        }
      })
      .catch((err: unknown) => {
        if (!cancelado) {
          setError(mensajeError(err, "No se pudo cargar el historial."));
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
  }, [canVer, estado, mascotaId]);

  if (!canVer) {
    return <AccessDenied mensaje="No tenés permiso para ver el historial de consultas." />;
  }

  const nombreMascota = data?.items[0]?.mascota_nombre;
  const titulo = mascotaId
    ? `Historia clínica${nombreMascota ? ` de ${nombreMascota}` : ""}`
    : "Historial de consultas";

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <ClipboardList className="size-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Consultas</span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">{titulo}</h1>
          <p className="text-sm text-muted-foreground">
            {mascotaId
              ? "Consultas firmadas de la mascota, de la más reciente a la más antigua."
              : "Todas las consultas de la clínica."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Estado"
            className={selectInlineClass}
            value={estado}
            onChange={(event) => {
              const next = new URLSearchParams(searchParams);
              next.set("estado", event.target.value);
              setSearchParams(next);
            }}
          >
            <option value="">Todas</option>
            <option value="firmada">Firmadas</option>
            <option value="borrador">Borradores</option>
          </select>
          {canCrear ? (
            <Button asChild>
              <Link to="/consultas/nueva">
                <Plus className="size-4" />
                Nueva consulta
              </Link>
            </Button>
          ) : null}
        </div>
      </div>

      {error ? <BannerError>{error}</BannerError> : null}

      <div className="rounded-2xl border bg-card shadow-sm">
        {cargando ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 4 }, (_, i) => (
              <Skeleton key={i} className="h-10 w-full" />
            ))}
          </div>
        ) : data && data.items.length > 0 ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fecha</TableHead>
                {mascotaId ? null : <TableHead>Mascota</TableHead>}
                <TableHead>Motivo</TableHead>
                <TableHead>Diagnóstico principal</TableHead>
                <TableHead>Veterinario</TableHead>
                <TableHead>Estado</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.items.map((item) => (
                <TableRow
                  key={item.id}
                  className="cursor-pointer"
                  onClick={() => navigate(`/consultas/${item.id}`)}
                >
                  <TableCell className="whitespace-nowrap">{fechaHoraLabel(item.fecha_hora)}</TableCell>
                  {mascotaId ? null : <TableCell>{item.mascota_nombre}</TableCell>}
                  <TableCell className="max-w-xs truncate">{item.motivo ?? "—"}</TableCell>
                  <TableCell>{item.diagnostico_principal ?? "—"}</TableCell>
                  <TableCell>{item.veterinario_nombre}</TableCell>
                  <TableCell>
                    <span
                      className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                        item.estado === "firmada"
                          ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                          : "bg-amber-500/15 text-amber-800 dark:text-amber-200"
                      }`}
                    >
                      {item.estado === "firmada" ? "Firmada" : "Borrador"}
                    </span>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <p className="p-6 text-sm text-muted-foreground">
            {mascotaId
              ? "Esta mascota todavía no tiene consultas firmadas."
              : "Todavía no hay consultas registradas."}
          </p>
        )}
      </div>
    </div>
  );
}
