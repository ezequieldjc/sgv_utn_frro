import React from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  PawPrint,
  Pencil,
  Plus,
  Search,
  ShieldOff,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { useAuth } from "@/context/auth-context";
import { useSelectTypeahead } from "@/hooks/use-select-typeahead";
import { apiFetch } from "@/lib/api";
import type {
  CatalogoOpcion,
  MascotaListResponse,
  RazaOpcion,
} from "@/types/mascotas";

const PAGE_SIZE = 50;
const ESTADO_ACTIVA_ID = 1;
const ESPECIE_DEFAULT_PATTERN = /^canin[oa]$/i;
const FILTER_SELECT_CLASS =
  "h-10 w-full min-w-0 rounded-md border border-input bg-transparent px-3 text-sm";

function hasPermission(permisos: string[], required: string): boolean {
  return permisos.includes("*") || permisos.includes(required);
}

function findEspecieDefaultId(especies: CatalogoOpcion[]): string | null {
  const match = especies.find((item) => ESPECIE_DEFAULT_PATTERN.test(item.nombre.trim()));
  return match ? String(match.id) : null;
}

function AccessDenied() {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-3 text-center">
      <div className="flex size-14 items-center justify-center rounded-2xl bg-muted">
        <ShieldOff className="size-7 text-muted-foreground" />
      </div>
      <div className="space-y-1">
        <h2 className="text-lg font-semibold tracking-tight">Acceso denegado</h2>
        <p className="max-w-sm text-sm text-muted-foreground">
          No tenés permiso para ver el listado de mascotas.
        </p>
      </div>
    </div>
  );
}

function ActionIconButton({
  label,
  to,
  children,
}: {
  label: string;
  to: string;
  children: React.ReactNode;
}) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-8 text-muted-foreground hover:text-foreground"
          aria-label={label}
          asChild
        >
          <Link to={to}>{children}</Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="top">{label}</TooltipContent>
    </Tooltip>
  );
}

export default function MascotasPage() {
  const { permisos } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const { handleTypeaheadKeyDown, clearTypeahead } = useSelectTypeahead();
  const canView = hasPermission(permisos, "mascotas:ver_listado");
  const canCreate = hasPermission(permisos, "mascotas:crear");
  const canEdit = hasPermission(permisos, "mascotas:editar");
  const canViewHistorial = hasPermission(permisos, "consultas:ver_historial");

  const clienteIdParam = searchParams.get("cliente_id");
  const especieFromUrl = searchParams.get("especie_id");
  const initialEstado = searchParams.get("mascota_estado_id") ?? String(ESTADO_ACTIVA_ID);

  const [q, setQ] = React.useState(searchParams.get("q") ?? "");
  const [debouncedQ, setDebouncedQ] = React.useState(q);
  const [especieId, setEspecieId] = React.useState(especieFromUrl ?? "");
  const [razaId, setRazaId] = React.useState(searchParams.get("raza_id") ?? "");
  const [estadoId, setEstadoId] = React.useState(initialEstado);
  const [page, setPage] = React.useState(Number(searchParams.get("page") ?? "1") || 1);

  const [especies, setEspecies] = React.useState<CatalogoOpcion[]>([]);
  const [razas, setRazas] = React.useState<RazaOpcion[]>([]);
  const [estados, setEstados] = React.useState<CatalogoOpcion[]>([]);
  const [data, setData] = React.useState<MascotaListResponse | null>(null);
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const pendingEspecieDefault = React.useRef(especieFromUrl === null);
  const [especieReady, setEspecieReady] = React.useState(especieFromUrl !== null);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setDebouncedQ(q), 300);
    return () => window.clearTimeout(timer);
  }, [q]);

  React.useEffect(() => {
    if (!canView) {
      return;
    }
    void (async () => {
      try {
        const [esp, est] = await Promise.all([
          apiFetch<CatalogoOpcion[]>("/api/mascotas/especies"),
          apiFetch<CatalogoOpcion[]>("/api/mascotas/estados"),
        ]);
        setEspecies(esp);
        setEstados(est);
      } catch {
        pendingEspecieDefault.current = false;
        setEspecieReady(true);
        setErrorMessage("No se pudieron cargar los filtros del listado.");
      }
    })();
  }, [canView]);

  React.useEffect(() => {
    if (!pendingEspecieDefault.current) {
      setEspecieReady(true);
      return;
    }
    if (especies.length === 0) {
      return;
    }
    const defaultId = findEspecieDefaultId(especies);
    pendingEspecieDefault.current = false;
    if (defaultId) {
      setEspecieId(defaultId);
      setPage(1);
    }
    setEspecieReady(true);
  }, [especies]);

  React.useEffect(() => {
    if (!canView || !especieId) {
      setRazas([]);
      return;
    }
    void (async () => {
      try {
        const rows = await apiFetch<RazaOpcion[]>(
          `/api/mascotas/razas?especie_id=${especieId}`,
        );
        setRazas(rows);
      } catch {
        setRazas([]);
      }
    })();
  }, [canView, especieId]);

  React.useEffect(() => {
    if (!canView) {
      setIsLoading(false);
      return;
    }
    if (!especieReady) {
      return;
    }
    let cancelled = false;
    void (async () => {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const params = new URLSearchParams();
        params.set("page", String(page));
        params.set("page_size", String(PAGE_SIZE));
        if (debouncedQ.trim()) {
          params.set("q", debouncedQ.trim());
        }
        if (especieId) {
          params.set("especie_id", especieId);
        }
        if (razaId) {
          params.set("raza_id", razaId);
        }
        if (estadoId) {
          params.set("mascota_estado_id", estadoId);
        }
        if (clienteIdParam) {
          params.set("cliente_id", clienteIdParam);
        }
        const response = await apiFetch<MascotaListResponse>(
          `/api/mascotas?${params.toString()}`,
        );
        if (!cancelled) {
          setData(response);
        }
      } catch {
        if (!cancelled) {
          setErrorMessage("No se pudieron cargar las mascotas.");
          setData(null);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [canView, especieReady, page, debouncedQ, especieId, razaId, estadoId, clienteIdParam]);

  React.useEffect(() => {
    const next = new URLSearchParams();
    if (debouncedQ.trim()) {
      next.set("q", debouncedQ.trim());
    }
    if (especieId) {
      next.set("especie_id", especieId);
    }
    if (razaId) {
      next.set("raza_id", razaId);
    }
    if (estadoId) {
      next.set("mascota_estado_id", estadoId);
    }
    if (clienteIdParam) {
      next.set("cliente_id", clienteIdParam);
    }
    if (page > 1) {
      next.set("page", String(page));
    }
    setSearchParams(next, { replace: true });
  }, [
    debouncedQ,
    especieId,
    razaId,
    estadoId,
    page,
    clienteIdParam,
    setSearchParams,
  ]);

  if (!canView) {
    return <AccessDenied />;
  }

  const totalPages = data ? Math.max(1, Math.ceil(data.total / data.page_size)) : 1;
  const nuevoHref = clienteIdParam
    ? `/mascotas/nuevo?cliente_id=${clienteIdParam}`
    : "/mascotas/nuevo";

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-muted-foreground">
          <PawPrint className="size-4" />
          <span className="text-xs font-medium uppercase tracking-wider">
            Mascotas y Clientes
          </span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Listado de Mascotas</h1>
        <p className="text-sm text-muted-foreground">
          {clienteIdParam
            ? `Filtrado por tutor #${clienteIdParam}.`
            : "Admisión y consulta de mascotas de la clínica."}
        </p>
      </div>

      <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
        <div className="relative w-full lg:max-w-sm lg:shrink-0">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={q}
            onChange={(event) => {
              setPage(1);
              setQ(event.target.value);
            }}
            placeholder="Buscar por nombre, DNI o microchip..."
            className="h-10 bg-background pl-9"
          />
        </div>
        <div className="grid w-full min-w-0 grid-cols-1 gap-3 sm:grid-cols-3 lg:min-w-0 lg:flex-1">
          <select
            className={FILTER_SELECT_CLASS}
            value={especieId}
            onBlur={clearTypeahead}
            onKeyDown={(event) => {
              handleTypeaheadKeyDown(
                event,
                [
                  { value: "", label: "Todas las especies" },
                  ...especies.map((item) => ({
                    value: String(item.id),
                    label: item.nombre,
                  })),
                ],
                especieId,
                (value) => {
                  setPage(1);
                  setEspecieId(value);
                  setRazaId("");
                },
              );
            }}
            onChange={(event) => {
              setPage(1);
              setEspecieId(event.target.value);
              setRazaId("");
            }}
          >
            <option value="">Todas las especies</option>
            {especies.map((item) => (
              <option key={item.id} value={String(item.id)}>
                {item.nombre}
              </option>
            ))}
          </select>
          <select
            className={FILTER_SELECT_CLASS}
            value={razaId}
            disabled={!especieId}
            onBlur={clearTypeahead}
            onKeyDown={(event) => {
              handleTypeaheadKeyDown(
                event,
                [
                  { value: "", label: "Todas las razas" },
                  ...razas.map((item) => ({
                    value: String(item.id),
                    label: item.nombre,
                  })),
                ],
                razaId,
                (value) => {
                  setPage(1);
                  setRazaId(value);
                },
              );
            }}
            onChange={(event) => {
              setPage(1);
              setRazaId(event.target.value);
            }}
          >
            <option value="">Todas las razas</option>
            {razas.map((item) => (
              <option key={item.id} value={String(item.id)}>
                {item.nombre}
              </option>
            ))}
          </select>
          <select
            className={FILTER_SELECT_CLASS}
            value={estadoId}
            onBlur={clearTypeahead}
            onKeyDown={(event) => {
              handleTypeaheadKeyDown(
                event,
                [
                  { value: "", label: "Todos los estados" },
                  ...estados.map((item) => ({
                    value: String(item.id),
                    label: item.nombre,
                  })),
                ],
                estadoId,
                (value) => {
                  setPage(1);
                  setEstadoId(value);
                },
              );
            }}
            onChange={(event) => {
              setPage(1);
              setEstadoId(event.target.value);
            }}
          >
            <option value="">Todos los estados</option>
            {estados.map((item) => (
              <option key={item.id} value={String(item.id)}>
                {item.nombre}
              </option>
            ))}
          </select>
        </div>
        {canCreate ? (
          <Button asChild className="w-full shrink-0 lg:w-auto">
            <Link to={nuevoHref}>
              <Plus className="size-4" />
              Nueva Mascota
            </Link>
          </Button>
        ) : null}
      </div>

      {errorMessage ? (
        <div className="rounded-2xl border border-destructive/30 bg-destructive/5 px-4 py-3 text-sm text-destructive">
          {errorMessage}
        </div>
      ) : null}

      <div className="overflow-hidden rounded-2xl border bg-card shadow-sm">
        {isLoading ? (
          <div className="space-y-2 p-4">
            {Array.from({ length: 6 }).map((_, index) => (
              <Skeleton key={index} className="h-10 w-full rounded-md" />
            ))}
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow className="hover:bg-transparent">
                <TableHead>Nombre</TableHead>
                <TableHead>Especie</TableHead>
                <TableHead>Raza</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Tutor</TableHead>
                <TableHead>DNI Tutor</TableHead>
                <TableHead className="text-left">Acciones</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {!data || data.items.length === 0 ? (
                <TableRow className="hover:bg-transparent">
                  <TableCell colSpan={7} className="h-28 text-center text-sm text-muted-foreground">
                    No hay mascotas para mostrar con los filtros actuales.
                  </TableCell>
                </TableRow>
              ) : (
                data.items.map((mascota) => (
                  <TableRow key={mascota.id} className="hover:bg-muted/50">
                    <TableCell className="font-medium">{mascota.nombre}</TableCell>
                    <TableCell>{mascota.especie_nombre}</TableCell>
                    <TableCell>{mascota.raza_nombre}</TableCell>
                    <TableCell>{mascota.mascota_estado_nombre}</TableCell>
                    <TableCell>
                      {mascota.tutor_nombre} {mascota.tutor_apellido}
                    </TableCell>
                    <TableCell className="tabular-nums text-muted-foreground">
                      {mascota.tutor_dni ?? "-"}
                    </TableCell>
                    <TableCell className="text-left">
                      <TooltipProvider>
                        <div className="flex items-center justify-start gap-1">
                          {canEdit ? (
                            <ActionIconButton
                              label="Editar"
                              to={`/mascotas/${mascota.id}/editar`}
                            >
                              <Pencil className="size-4" />
                            </ActionIconButton>
                          ) : null}

                          {canViewHistorial ? (
                            <ActionIconButton
                              label="Historial de consultas"
                              to={`/consultas/historial?mascota_id=${mascota.id}`}
                            >
                              <ClipboardList className="size-4" />
                            </ActionIconButton>
                          ) : null}
                        </div>
                      </TooltipProvider>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        )}
      </div>

      <div className="flex items-center justify-between gap-3">
        <p className="text-sm text-muted-foreground">
          {data
            ? `${data.items.length} de ${data.total} mascotas · página ${data.page} / ${totalPages}`
            : null}
        </p>
        <div className="flex items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page <= 1 || isLoading}
            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
          >
            <ChevronLeft className="size-4" />
            Anterior
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={page >= totalPages || isLoading}
            onClick={() => setPage((prev) => prev + 1)}
          >
            Siguiente
            <ChevronRight className="size-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
