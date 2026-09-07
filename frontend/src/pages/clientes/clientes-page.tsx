import React from "react";
import { Link } from "react-router-dom";
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Eye,
  PawPrint,
  Pencil,
  Plus,
  Search,
  ShieldOff,
  Users,
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
import { apiFetch } from "@/lib/api";
import type { ClienteListItem } from "@/types/clientes";

type SortKey =
  | "nombre"
  | "apellido"
  | "dni"
  | "sexo"
  | "celular"
  | "fecha_alta"
  | "ciudad"
  | "edad";
type SortDir = "asc" | "desc";

function hasPermission(permisos: string[], required: string): boolean {
  return permisos.includes("*") || permisos.includes(required);
}

function formatFechaAlta(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  const day = String(date.getDate()).padStart(2, "0");
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

function matchesSearch(cliente: ClienteListItem, query: string): boolean {
  const normalized = query.trim().toLowerCase();
  if (!normalized) {
    return true;
  }

  return (
    cliente.nombre.toLowerCase().includes(normalized) ||
    cliente.apellido.toLowerCase().includes(normalized) ||
    cliente.dni.toLowerCase().includes(normalized)
  );
}

function compareClientes(a: ClienteListItem, b: ClienteListItem, sortKey: SortKey): number {
  switch (sortKey) {
    case "nombre":
      return a.nombre.toLowerCase().localeCompare(b.nombre.toLowerCase(), "es");
    case "apellido":
      return a.apellido.toLowerCase().localeCompare(b.apellido.toLowerCase(), "es");
    case "dni":
      return a.dni.localeCompare(b.dni, "es");
    case "sexo":
      return a.sexo.localeCompare(b.sexo, "es");
    case "celular":
      return a.celular.localeCompare(b.celular, "es");
    case "fecha_alta":
      return new Date(a.fecha_alta).getTime() - new Date(b.fecha_alta).getTime();
    case "ciudad": {
      const ciudadA = (a.ciudad ?? "").toLowerCase();
      const ciudadB = (b.ciudad ?? "").toLowerCase();
      return ciudadA.localeCompare(ciudadB, "es");
    }
    case "edad":
      return a.edad - b.edad;
    default:
      return 0;
  }
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
          No tenés permiso para ver el listado de clientes.
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

function SortableHead({
  label,
  sortKey,
  activeKey,
  activeDir,
  onSort,
}: {
  label: string;
  sortKey: SortKey;
  activeKey: SortKey;
  activeDir: SortDir;
  onSort: (key: SortKey) => void;
}) {
  const isActive = activeKey === sortKey;
  const Icon = !isActive ? ArrowUpDown : activeDir === "asc" ? ArrowUp : ArrowDown;

  return (
    <TableHead>
      <button
        type="button"
        className="inline-flex items-center gap-1.5 font-medium hover:text-foreground"
        onClick={() => onSort(sortKey)}
      >
        {label}
        <Icon
          className={`size-3.5 ${isActive ? "text-foreground" : "text-muted-foreground"}`}
        />
      </button>
    </TableHead>
  );
}

function ClientesTableSkeleton() {
  return (
    <div className="space-y-3 p-4">
      {Array.from({ length: 5 }).map((_, index) => (
        <Skeleton key={index} className="h-10 w-full rounded-md" />
      ))}
    </div>
  );
}

export default function ClientesPage() {
  const { permisos } = useAuth();
  const [clientes, setClientes] = React.useState<ClienteListItem[]>([]);
  const [search, setSearch] = React.useState("");
  const [isLoading, setIsLoading] = React.useState(true);
  const [errorMessage, setErrorMessage] = React.useState<string | null>(null);
  const [sortKey, setSortKey] = React.useState<SortKey>("apellido");
  const [sortDir, setSortDir] = React.useState<SortDir>("asc");

  const canView = hasPermission(permisos, "clientes:ver_listado");
  const canCreate = hasPermission(permisos, "clientes:crear");
  const canEdit = hasPermission(permisos, "clientes:editar");

  React.useEffect(() => {
    if (!canView) {
      setIsLoading(false);
      return;
    }

    let cancelled = false;

    async function loadClientes() {
      setIsLoading(true);
      setErrorMessage(null);
      try {
        const data = await apiFetch<ClienteListItem[]>("/api/clientes");
        if (!cancelled) {
          setClientes(data);
        }
      } catch (error) {
        if (!cancelled) {
          const status = (error as { status?: number }).status;
          if (status === 403) {
            setErrorMessage("No tenés permisos para listar clientes.");
          } else {
            setErrorMessage("No se pudieron cargar los clientes. Intentá de nuevo.");
          }
          setClientes([]);
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false);
        }
      }
    }

    void loadClientes();

    return () => {
      cancelled = true;
    };
  }, [canView]);

  const filteredClientes = React.useMemo(() => {
    const filtered = clientes.filter((cliente) => matchesSearch(cliente, search));
    return [...filtered].sort((a, b) => {
      const result = compareClientes(a, b, sortKey);
      return sortDir === "asc" ? result : -result;
    });
  }, [clientes, search, sortKey, sortDir]);

  function handleSort(key: SortKey) {
    if (sortKey === key) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
      return;
    }
    setSortKey(key);
    setSortDir("asc");
  }

  if (!canView) {
    return <AccessDenied />;
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="space-y-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Users className="size-4" />
            <span className="text-xs font-medium uppercase tracking-wider">
              Mascotas y Clientes
            </span>
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">Listado de Clientes</h1>
          <p className="text-sm text-muted-foreground">
            Administración de clientes de la clínica.
          </p>
        </div>

        <div className="mb-6 flex items-center justify-between gap-4">
          <div className="relative w-full max-w-sm">
            <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Buscar por nombre, apellido o DNI..."
              className="h-10 bg-background pl-9"
              disabled={isLoading}
            />
          </div>

          {canCreate ? (
            <Button type="button" className="shrink-0" asChild>
              <Link to="/clientes/nuevo">
                <Plus className="size-4" />
                Nuevo Cliente
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
            <ClientesTableSkeleton />
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="hover:bg-transparent">
                  <SortableHead
                    label="Nombre"
                    sortKey="nombre"
                    activeKey={sortKey}
                    activeDir={sortDir}
                    onSort={handleSort}
                  />
                  <SortableHead
                    label="Apellido"
                    sortKey="apellido"
                    activeKey={sortKey}
                    activeDir={sortDir}
                    onSort={handleSort}
                  />
                  <SortableHead
                    label="DNI"
                    sortKey="dni"
                    activeKey={sortKey}
                    activeDir={sortDir}
                    onSort={handleSort}
                  />
                  <SortableHead
                    label="Sexo"
                    sortKey="sexo"
                    activeKey={sortKey}
                    activeDir={sortDir}
                    onSort={handleSort}
                  />
                  <SortableHead
                    label="Celular"
                    sortKey="celular"
                    activeKey={sortKey}
                    activeDir={sortDir}
                    onSort={handleSort}
                  />
                  <SortableHead
                    label="Fecha Alta"
                    sortKey="fecha_alta"
                    activeKey={sortKey}
                    activeDir={sortDir}
                    onSort={handleSort}
                  />
                  <SortableHead
                    label="Ciudad"
                    sortKey="ciudad"
                    activeKey={sortKey}
                    activeDir={sortDir}
                    onSort={handleSort}
                  />
                  <SortableHead
                    label="Edad"
                    sortKey="edad"
                    activeKey={sortKey}
                    activeDir={sortDir}
                    onSort={handleSort}
                  />
                  <TableHead className="text-left">Acciones</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filteredClientes.length === 0 ? (
                  <TableRow className="hover:bg-transparent">
                    <TableCell colSpan={9} className="h-32 text-center">
                      <div className="flex flex-col items-center gap-2 text-muted-foreground">
                        <Search className="size-5" />
                        <p className="text-sm">
                          {clientes.length === 0
                            ? "No hay clientes para mostrar."
                            : "No se encontraron clientes con ese criterio."}
                        </p>
                      </div>
                    </TableCell>
                  </TableRow>
                ) : (
                  filteredClientes.map((cliente) => (
                    <TableRow key={cliente.id} className="hover:bg-muted/50">
                      <TableCell className="font-medium">{cliente.nombre}</TableCell>
                      <TableCell className="font-medium">{cliente.apellido}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {cliente.dni}
                      </TableCell>
                      <TableCell>{cliente.sexo}</TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {cliente.celular}
                      </TableCell>
                      <TableCell className="tabular-nums text-muted-foreground">
                        {formatFechaAlta(cliente.fecha_alta)}
                      </TableCell>
                      <TableCell className="text-muted-foreground">
                        {cliente.ciudad ?? "-"}
                      </TableCell>
                      <TableCell className="tabular-nums">{cliente.edad}</TableCell>
                      <TableCell className="text-left">
                        <div className="flex items-center justify-start gap-1">
                          {canEdit ? (
                            <ActionIconButton
                              label="Editar"
                              to={`/clientes/${cliente.id}/editar`}
                            >
                              <Pencil className="size-4" />
                            </ActionIconButton>
                          ) : null}

                          {canView ? (
                            <ActionIconButton
                              label="Ver Mascotas"
                              to={`/mascotas?cliente_id=${cliente.id}`}
                            >
                              <PawPrint className="size-4" />
                            </ActionIconButton>
                          ) : null}

                          {canView ? (
                            <ActionIconButton
                              label="Ver detalle"
                              to={`/clientes/${cliente.id}`}
                            >
                              <Eye className="size-4" />
                            </ActionIconButton>
                          ) : null}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))
                )}
              </TableBody>
            </Table>
          )}
        </div>

        {!isLoading ? (
          <p className="text-xs text-muted-foreground">
            {filteredClientes.length} de {clientes.length} clientes
          </p>
        ) : null}
      </div>
    </TooltipProvider>
  );
}
