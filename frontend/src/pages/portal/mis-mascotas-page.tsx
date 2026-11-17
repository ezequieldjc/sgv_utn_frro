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
  const { data, error, cargando } = usePortal<PortalMascota[]>(
    "/api/portal/mascotas",
    "tus mascotas",
  );

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <EncabezadoPortal
        titulo="Mis mascotas"
        subtitulo="Tocá una mascota para ver sus datos y su historia clínica."
      />
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
