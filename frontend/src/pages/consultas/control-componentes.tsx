import React from "react";
import { Link } from "react-router-dom";
import { CalendarPlus, History, Loader2, Stethoscope, Unlink } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  CAMBIO_SIGNO_LABEL,
  ESTADO_SIGNO_LABEL,
  diaLabel,
  diagnosticoAnterior,
  evolucionSignos,
  nombreDiagnostico,
  type CambioSigno,
} from "@/lib/consultas";
import type {
  ConsultaAnteriorResumen,
  ConsultaListItem,
  ConsultaSignoItem,
  ControlResumen,
} from "@/types/consultas";

import { selectClass } from "../stock/shared";

const tarjeta = "rounded-2xl border bg-card p-5 shadow-sm";
const tituloTarjeta = "text-sm font-semibold uppercase tracking-wide text-muted-foreground";

const COLOR_CAMBIO: Record<CambioSigno, string> = {
  resuelto: "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300",
  persiste: "bg-amber-500/15 text-amber-800 dark:text-amber-200",
  nuevo: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-300",
  sin_registrar: "bg-muted text-muted-foreground",
};

function fechaCorta(iso: string): string {
  return new Date(iso).toLocaleDateString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function etiquetaCandidata(consulta: ConsultaListItem): string {
  return `${fechaCorta(consulta.fecha_hora)} · ${
    consulta.diagnostico_principal ?? consulta.motivo ?? "Sin diagnóstico"
  }`;
}

/** Signos de la consulta anterior contra los de esta: qué persiste, qué se resolvió, qué es nuevo. */
function TablaEvolucion({
  anteriores,
  actuales,
}: {
  anteriores: ConsultaSignoItem[];
  actuales: ConsultaSignoItem[];
}) {
  const filas = evolucionSignos(anteriores, actuales);
  if (filas.length === 0) {
    return <p className="text-sm text-muted-foreground">No hay signos para comparar.</p>;
  }
  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-xs text-muted-foreground">
          <th className="py-1 font-medium">Signo</th>
          <th className="py-1 font-medium">Antes</th>
          <th className="py-1 font-medium">Ahora</th>
          <th className="py-1">
            <span className="sr-only">Evolución</span>
          </th>
        </tr>
      </thead>
      <tbody>
        {filas.map((fila) => (
          <tr key={fila.codigo} className="border-t">
            <td className="py-1.5 pr-2">{fila.nombre}</td>
            <td className="py-1.5 pr-2 text-muted-foreground">{ESTADO_SIGNO_LABEL[fila.antes]}</td>
            <td className="py-1.5 pr-2 text-muted-foreground">{ESTADO_SIGNO_LABEL[fila.ahora]}</td>
            <td className="py-1.5 text-right">
              <span
                className={`whitespace-nowrap rounded-full px-2 py-0.5 text-[11px] font-medium ${
                  COLOR_CAMBIO[fila.cambio]
                }`}
              >
                {CAMBIO_SIGNO_LABEL[fila.cambio]}
              </span>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

/**
 * La consulta anterior de un control: qué se diagnosticó, qué se indicó y cómo evolucionaron los
 * signos. En un borrador permite vincularla, cambiarla, quitarla y reusar el diagnóstico.
 */
export function TarjetaControl({
  anterior,
  signosActuales,
  candidatas,
  editable,
  trabajando,
  onVincular,
  onUsarDiagnostico,
}: {
  anterior: ConsultaAnteriorResumen | null;
  signosActuales: ConsultaSignoItem[];
  candidatas: ConsultaListItem[];
  editable: boolean;
  trabajando: boolean;
  onVincular: (consultaId: number | null) => void;
  onUsarDiagnostico: () => void;
}) {
  const [elegida, setElegida] = React.useState("");

  if (!anterior) {
    if (!editable || candidatas.length === 0) {
      return null;
    }
    return (
      <section className={`${tarjeta} space-y-3`}>
        <div className="flex items-center gap-2">
          <History className="size-4 text-muted-foreground" />
          <h2 className={tituloTarjeta}>¿Es un control?</h2>
        </div>
        <p className="text-sm text-muted-foreground">
          Vinculala a la consulta anterior para ver qué se indicó y cómo evolucionaron los signos.
        </p>
        <div className="flex flex-wrap gap-2">
          <select
            aria-label="Consulta anterior"
            className={`${selectClass} min-w-0 flex-1`}
            value={elegida}
            onChange={(event) => setElegida(event.target.value)}
          >
            <option value="">Elegí la consulta anterior…</option>
            {candidatas.map((c) => (
              <option key={c.id} value={c.id}>
                {etiquetaCandidata(c)}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            disabled={!elegida || trabajando}
            onClick={() => onVincular(Number(elegida))}
          >
            {trabajando ? <Loader2 className="size-4 animate-spin" /> : null}
            Vincular
          </Button>
        </div>
      </section>
    );
  }

  const principal = anterior.diagnosticos.find((d) => d.tipo_diagnostico === "principal");
  const puedeUsarDiagnostico = editable && diagnosticoAnterior(anterior) !== null;
  const otras = candidatas.filter((c) => c.id !== anterior.id);

  return (
    <section className={`${tarjeta} space-y-4`}>
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="space-y-0.5">
          <div className="flex items-center gap-2">
            <History className="size-4 text-muted-foreground" />
            <h2 className={tituloTarjeta}>Control de la consulta del {fechaCorta(anterior.fecha_hora)}</h2>
          </div>
          <p className="text-xs text-muted-foreground">
            {anterior.veterinario_nombre}
            {anterior.peso_kg ? ` · pesaba ${Number(anterior.peso_kg)} kg` : ""}
          </p>
        </div>
        <Button type="button" variant="ghost" size="sm" asChild>
          <Link to={`/consultas/${anterior.id}`}>Ver consulta</Link>
        </Button>
      </div>

      <dl className="grid gap-3 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-xs text-muted-foreground">Diagnóstico</dt>
          <dd className="font-medium">{principal ? nombreDiagnostico(principal) : "Sin diagnóstico"}</dd>
        </div>
        <div>
          <dt className="text-xs text-muted-foreground">Motivo</dt>
          <dd>{anterior.motivo ?? "—"}</dd>
        </div>
        {anterior.tratamiento ? (
          <div className="sm:col-span-2">
            <dt className="text-xs text-muted-foreground">Tratamiento indicado</dt>
            <dd className="whitespace-pre-line">{anterior.tratamiento}</dd>
          </div>
        ) : null}
      </dl>

      <div className="space-y-1.5">
        <p className="text-sm font-medium">Evolución de los signos</p>
        <TablaEvolucion anteriores={anterior.signos} actuales={signosActuales} />
      </div>

      {editable ? (
        <div className="flex flex-wrap items-center gap-2 border-t pt-3">
          {puedeUsarDiagnostico ? (
            <Button type="button" size="sm" variant="outline" onClick={onUsarDiagnostico}>
              <Stethoscope className="size-4" />
              Usar el diagnóstico anterior
            </Button>
          ) : null}
          {otras.length > 0 ? (
            <select
              aria-label="Cambiar la consulta anterior"
              className={`${selectClass} h-8 w-auto min-w-0 text-xs`}
              value=""
              disabled={trabajando}
              onChange={(event) => {
                if (event.target.value) {
                  onVincular(Number(event.target.value));
                }
              }}
            >
              <option value="">Cambiar por otra consulta…</option>
              {otras.map((c) => (
                <option key={c.id} value={c.id}>
                  {etiquetaCandidata(c)}
                </option>
              ))}
            </select>
          ) : null}
          <Button
            type="button"
            size="sm"
            variant="ghost"
            disabled={trabajando}
            onClick={() => onVincular(null)}
          >
            {trabajando ? <Loader2 className="size-4 animate-spin" /> : <Unlink className="size-4" />}
            No es un control
          </Button>
        </div>
      ) : null}
    </section>
  );
}

/** En una consulta firmada: sus controles y el acceso para programar el próximo. */
export function TarjetaControles({
  controles,
  fechaSugerida,
  linkProgramar,
  puedeProgramar,
}: {
  controles: ControlResumen[];
  fechaSugerida: string | null;
  linkProgramar: string;
  puedeProgramar: boolean;
}) {
  return (
    <section className={`${tarjeta} space-y-3`}>
      <h2 className="font-semibold">Controles</h2>
      {controles.length === 0 ? (
        <p className="text-sm text-muted-foreground">Todavía no hay controles de esta consulta.</p>
      ) : (
        <ul className="space-y-2">
          {controles.map((control) => (
            <li key={control.id}>
              <Link
                to={`/consultas/${control.id}`}
                className="block rounded-xl border p-3 transition-colors hover:bg-muted/50"
              >
                <div className="flex items-baseline justify-between gap-2">
                  <span className="font-medium">{fechaCorta(control.fecha_hora)}</span>
                  <span
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${
                      control.estado === "firmada"
                        ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                        : "bg-amber-500/15 text-amber-800 dark:text-amber-200"
                    }`}
                  >
                    {control.estado === "firmada" ? "Firmada" : "Borrador"}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">
                  {control.diagnostico_principal ?? control.motivo ?? "Sin diagnóstico todavía"}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
      {fechaSugerida ? (
        <p className="text-xs text-muted-foreground">
          Control sugerido por el tratamiento: {diaLabel(fechaSugerida)}.
        </p>
      ) : null}
      {puedeProgramar ? (
        <Button className="w-full" asChild>
          <Link to={linkProgramar}>
            <CalendarPlus className="size-4" />
            Programar control
          </Link>
        </Button>
      ) : (
        <p className="text-xs text-muted-foreground">Para agendar el control, pedíselo a recepción.</p>
      )}
    </section>
  );
}
