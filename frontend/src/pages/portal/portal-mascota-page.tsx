import { useParams } from "react-router-dom";
import { AlertTriangle } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { fechaLabel, pesoLabel, resumenMascota } from "@/lib/portal";
import type { PortalConsultaItem, PortalMascota } from "@/types/portal";

import {
  Cargando,
  EncabezadoPortal,
  ErrorPortal,
  TarjetaLink,
  usePortal,
  Vacio,
} from "./portal-componentes";

export default function PortalMascotaPage() {
  const { id } = useParams();
  const mascota = usePortal<PortalMascota>(`/api/portal/mascotas/${id}`, "esa mascota");
  const consultas = usePortal<PortalConsultaItem[]>(
    `/api/portal/mascotas/${id}/consultas`,
    "la historia clínica",
  );

  if (mascota.cargando) {
    return <Cargando />;
  }
  if (mascota.error || !mascota.data) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <EncabezadoPortal titulo="Mascota" volverA="/portal/mascotas" volverLabel="Mis mascotas" />
        <ErrorPortal mensaje={mascota.error ?? "No encontramos esa mascota."} />
      </div>
    );
  }

  const m = mascota.data;
  const peso = pesoLabel(m.ultimo_peso);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-8">
      <EncabezadoPortal
        titulo={m.nombre}
        subtitulo={resumenMascota(m)}
        volverA="/portal/mascotas"
        volverLabel="Mis mascotas"
      />

      <dl className="grid grid-cols-2 gap-3 rounded-2xl border bg-card p-4 text-sm sm:grid-cols-3">
        <div>
          <dt className="text-muted-foreground">Estado</dt>
          <dd className="font-medium">{m.estado_nombre}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Último peso</dt>
          <dd className="font-medium">{peso ?? "Sin registrar"}</dd>
        </div>
        <div>
          <dt className="text-muted-foreground">Nacimiento</dt>
          <dd className="font-medium">
            {m.fecha_nacimiento ? fechaLabel(`${m.fecha_nacimiento}T12:00:00`) : "Sin registrar"}
          </dd>
        </div>
        {m.alertas_medicas ? (
          <div className="col-span-full flex items-start gap-2 rounded-xl bg-amber-500/10 px-3 py-2 text-amber-800 dark:text-amber-200">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <span>{m.alertas_medicas}</span>
          </div>
        ) : null}
      </dl>

      <section className="space-y-3">
        <h2 className="text-lg font-semibold tracking-tight">Historia clínica</h2>
        {consultas.cargando ? <Cargando /> : null}
        {consultas.error ? <ErrorPortal mensaje={consultas.error} /> : null}
        {consultas.data && consultas.data.length === 0 ? (
          <Vacio>Todavía no hay consultas registradas.</Vacio>
        ) : null}
        {consultas.data?.map((c) => (
          <TarjetaLink key={c.id} to={`/portal/consultas/${c.id}`}>
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{fechaLabel(c.fecha_hora)}</span>
              {c.es_control ? <Badge variant="secondary">Control</Badge> : null}
            </div>
            <p className="truncate text-sm text-muted-foreground">
              {[c.diagnostico_principal, c.motivo].filter(Boolean).join(" · ") ||
                "Consulta general"}
            </p>
            <p className="text-xs text-muted-foreground">Atendió {c.veterinario_nombre}</p>
          </TarjetaLink>
        ))}
      </section>
    </div>
  );
}
