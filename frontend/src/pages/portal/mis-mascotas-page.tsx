import { Link } from "react-router-dom";
import { Plus } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useAuth } from "@/context/auth-context";
import { PERMISO_CREAR_MASCOTA } from "@/lib/portal";
import type { PortalMascota } from "@/types/portal";

import {
  Cargando,
  EncabezadoPortal,
  ErrorPortal,
  MascotaCard,
  usePortal,
  Vacio,
} from "./portal-componentes";

export default function MisMascotasPage() {
  const { permisos } = useAuth();
  const puedeCrear = permisos.includes("*") || permisos.includes(PERMISO_CREAR_MASCOTA);
  const { data, error, cargando } = usePortal<PortalMascota[]>(
    "/api/portal/mascotas",
    "tus mascotas",
  );

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <EncabezadoPortal
          titulo="Mis mascotas"
          subtitulo="Tocá una mascota para ver sus datos y su historia clínica."
        />
        {puedeCrear ? (
          <Button asChild>
            <Link to="/portal/mascotas/nueva">
              <Plus className="size-4" />
              Agregar mascota
            </Link>
          </Button>
        ) : null}
      </div>
      {cargando ? <Cargando /> : null}
      {error ? <ErrorPortal mensaje={error} /> : null}
      {data && data.length === 0 ? (
        <Vacio>Todavía no tenés mascotas registradas en la clínica.</Vacio>
      ) : null}
      <div className="space-y-3">
        {data?.map((m) => <MascotaCard key={m.id} mascota={m} />)}
      </div>
    </div>
  );
}
