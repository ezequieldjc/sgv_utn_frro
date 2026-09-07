import React from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";

export function ClienteDetallePage() {
  const { id } = useParams();
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Detalle de Cliente</h1>
        <p className="text-sm text-muted-foreground">
          Detalle del cliente #{id} (en construcción).
        </p>
      </div>
      <Link to="/clientes" className="text-sm font-medium text-primary underline">
        Volver al listado de clientes
      </Link>
    </div>
  );
}

export function ClienteEditarPage() {
  const { id } = useParams();
  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Editar Cliente</h1>
        <p className="text-sm text-muted-foreground">
          Edición del cliente #{id} (en construcción).
        </p>
      </div>
      <Link to="/clientes" className="text-sm font-medium text-primary underline">
        Volver al listado de clientes
      </Link>
    </div>
  );
}

export function MascotasStubPage() {
  const [searchParams] = useSearchParams();
  const clienteId = searchParams.get("cliente_id");

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-2xl font-semibold tracking-tight">Listado de Mascotas</h1>
        <p className="text-sm text-muted-foreground">
          {clienteId
            ? `Mascotas del cliente #${clienteId} (módulo en construcción).`
            : "Módulo de mascotas en construcción."}
        </p>
      </div>
      {clienteId ? (
        <Link to="/clientes" className="text-sm font-medium text-primary underline">
          Volver al listado de clientes
        </Link>
      ) : null}
    </div>
  );
}
