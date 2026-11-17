import { Link, useParams } from "react-router-dom";

import { Badge } from "@/components/ui/badge";
import { fechaHoraLabel } from "@/lib/consultas";
import { fechaLabel, pesoLabel, temperaturaLabel } from "@/lib/portal";
import type { PortalConsultaDetalle } from "@/types/portal";

import { Cargando, EncabezadoPortal, ErrorPortal, usePortal } from "./portal-componentes";

/**
 * Consulta firmada vista por el cliente. El backend solo manda lo que el cliente puede ver
 * (sin dictado, signos, porcentajes ni notas internas); esta pantalla no agrega nada más.
 */
export default function PortalConsultaPage() {
  const { id } = useParams();
  const { data, error, cargando } = usePortal<PortalConsultaDetalle>(
    `/api/portal/consultas/${id}`,
    "esa consulta",
  );

  if (cargando) {
    return <Cargando />;
  }
  if (error || !data) {
    return (
      <div className="mx-auto w-full max-w-3xl space-y-6">
        <EncabezadoPortal titulo="Consulta" volverA="/portal/mascotas" volverLabel="Mis mascotas" />
        <ErrorPortal mensaje={error ?? "No encontramos esa consulta."} />
      </div>
    );
  }

  const peso = pesoLabel(data.peso_kg);
  const temperatura = temperaturaLabel(data.temperatura_c);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <EncabezadoPortal
        titulo={`Consulta de ${data.mascota_nombre}`}
        subtitulo={`${fechaHoraLabel(data.fecha_hora)} · Atendió ${data.veterinario_nombre}`}
        volverA={`/portal/mascotas/${data.mascota_id}`}
        volverLabel={data.mascota_nombre}
      />

      {data.control_de ? (
        <p className="rounded-2xl border bg-muted/40 px-4 py-3 text-sm">
          Control de la{" "}
          <Link to={`/portal/consultas/${data.control_de.id}`} className="font-medium text-primary hover:underline">
            consulta del {fechaLabel(data.control_de.fecha_hora)}
          </Link>
          .
        </p>
      ) : null}

      <section className="space-y-4 rounded-2xl border bg-card p-4">
        {data.motivo ? (
          <div>
            <h2 className="text-sm text-muted-foreground">Motivo</h2>
            <p>{data.motivo}</p>
          </div>
        ) : null}

        <div>
          <h2 className="text-sm text-muted-foreground">Diagnóstico</h2>
          {data.diagnosticos.length === 0 ? (
            <p>Sin diagnóstico registrado.</p>
          ) : (
            <ul className="mt-1 space-y-1">
              {data.diagnosticos.map((d) => (
                <li key={`${d.nombre}-${d.principal}`} className="flex items-center gap-2">
                  <span>{d.nombre}</span>
                  {d.principal ? <Badge>Principal</Badge> : null}
                </li>
              ))}
            </ul>
          )}
        </div>

        {data.tratamiento ? (
          <div>
            <h2 className="text-sm text-muted-foreground">Tratamiento e indicaciones</h2>
            <p className="whitespace-pre-line">{data.tratamiento}</p>
          </div>
        ) : null}

        {peso || temperatura ? (
          <dl className="flex flex-wrap gap-6 text-sm">
            {peso ? (
              <div>
                <dt className="text-muted-foreground">Peso</dt>
                <dd className="font-medium">{peso}</dd>
              </div>
            ) : null}
            {temperatura ? (
              <div>
                <dt className="text-muted-foreground">Temperatura</dt>
                <dd className="font-medium">{temperatura}</dd>
              </div>
            ) : null}
          </dl>
        ) : null}
      </section>
    </div>
  );
}
