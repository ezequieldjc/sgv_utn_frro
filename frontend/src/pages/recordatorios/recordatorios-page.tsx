import React from "react";
import { Link } from "react-router-dom";
import { BellRing, CalendarClock, Check, MessageCircle, Syringe } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api";
import { diaLabel, hasPermission } from "@/lib/consultas";
import { PERMISO_RECORDATORIOS, envioLabel, horaLabel, manana, whatsappLabel } from "@/lib/recordatorios";
import { TIPO_PREVENTIVO_LABEL, diasLabel, fechaCorta, mensajeErrorApi } from "@/lib/vacunas";
import type {
  ContactoTutor,
  RecordatorioDosis,
  RecordatorioEnviado,
  RecordatoriosResponse,
  RecordatorioTurno,
  UltimoEnvio,
} from "@/types/recordatorios";

import { AccessDenied, BannerError } from "../stock/shared";

type Origen = { turno_id: number } | { tratamiento_preventivo_id: number };

function Contacto({ tutor }: { tutor: ContactoTutor }) {
  return (
    <div className="text-sm">
      <div className="font-medium">{tutor.nombre}</div>
      <div className="text-xs text-muted-foreground">
        {tutor.whatsapp ? `WhatsApp ${whatsappLabel(tutor.whatsapp)}` : tutor.celular}
      </div>
    </div>
  );
}

/**
 * Abre WhatsApp con el mensaje armado (link wa.me, en otra pestaña) y registra el envío.
 * Es un link común y no un window.open después de esperar al backend: así el navegador no lo
 * bloquea como ventana emergente.
 */
function BotonWhatsApp({
  url,
  tutor,
  ultimo,
  envios,
  onEnviar,
}: {
  url: string | null;
  tutor: ContactoTutor;
  ultimo: UltimoEnvio | null;
  envios: number;
  onEnviar: () => void;
}) {
  const enviado = envioLabel(ultimo, envios);
  if (!url) {
    return <p className="max-w-56 text-xs text-amber-700 dark:text-amber-300">{tutor.motivo_sin_whatsapp}</p>;
  }
  return (
    <div className="flex flex-col items-end gap-1">
      <a
        href={url}
        target="_blank"
        rel="noreferrer"
        onClick={onEnviar}
        className={`inline-flex items-center gap-2 rounded-md px-3 py-1.5 text-sm font-medium shadow-sm transition-colors ${
          enviado
            ? "border bg-background hover:bg-muted"
            : "bg-[#25D366] text-white hover:bg-[#1ebe5b]"
        }`}
      >
        <MessageCircle className="size-4" />
        {enviado ? "Reenviar" : "Enviar por WhatsApp"}
      </a>
      {enviado ? (
        <span className="flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300">
          <Check className="size-3" />
          {enviado}
        </span>
      ) : null}
    </div>
  );
}

function Mensaje({ texto }: { texto: string }) {
  return (
    <details className="mt-1 text-xs text-muted-foreground">
      <summary className="cursor-pointer select-none">Ver mensaje</summary>
      <p className="mt-1 max-w-xl whitespace-pre-wrap rounded-lg bg-muted/60 p-2 text-foreground">{texto}</p>
    </details>
  );
}

export default function RecordatoriosPage() {
  const { permisos } = useAuth();
  const canEnviar = hasPermission(permisos, PERMISO_RECORDATORIOS);

  const [fechaTurnos, setFechaTurnos] = React.useState<string | null>(null);
  const [data, setData] = React.useState<RecordatoriosResponse | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [cargando, setCargando] = React.useState(true);

  const cargar = React.useCallback(async (fecha: string | null) => {
    const params = fecha ? `?fecha_turnos=${fecha}` : "";
    const respuesta = await apiFetch<RecordatoriosResponse>(`/api/recordatorios/pendientes${params}`);
    setData(respuesta);
    return respuesta;
  }, []);

  React.useEffect(() => {
    if (!canEnviar) {
      return;
    }
    let cancelado = false;
    setCargando(true);
    setError(null);
    cargar(fechaTurnos)
      .catch((err: unknown) => {
        if (!cancelado) {
          setError(mensajeErrorApi(err, "No se pudieron cargar los recordatorios."));
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
  }, [canEnviar, cargar, fechaTurnos]);

  async function registrar(origen: Origen) {
    setError(null);
    try {
      await apiFetch<RecordatorioEnviado>("/api/recordatorios", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(origen),
      });
      await cargar(fechaTurnos);
    } catch (err) {
      setError(
        mensajeErrorApi(err, "WhatsApp se abrió, pero no se pudo registrar el envío en el sistema."),
      );
    }
  }

  if (!canEnviar) {
    return <AccessDenied mensaje="No tenés permiso para enviar recordatorios." />;
  }

  const fecha = fechaTurnos ?? data?.fecha_turnos ?? "";
  const esManana = data ? fecha === manana(data.hoy) : false;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-muted-foreground">
          <BellRing className="size-4" />
          <span className="text-xs font-medium uppercase tracking-wider">Agenda</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Recordatorios por WhatsApp</h1>
        <p className="max-w-3xl text-sm text-muted-foreground">
          El sistema arma el mensaje y el número de cada tutor. «Enviar por WhatsApp» lo abre listo
          para mandar y deja registrado el envío. En la Fase 2 este mismo mensaje sale solo, por la
          API de WhatsApp.
        </p>
      </div>

      {error ? <BannerError>{error}</BannerError> : null}

      <section className="rounded-2xl border bg-card shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-3 border-b px-5 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <CalendarClock className="size-4" />
            Turnos {esManana ? "de mañana" : "del"} {fecha ? diaLabel(fecha) : ""}
          </h2>
          <div className="flex items-center gap-2">
            <Label htmlFor="fecha_turnos" className="text-xs text-muted-foreground">
              Día
            </Label>
            <Input
              id="fecha_turnos"
              type="date"
              className="h-8 w-auto"
              value={fecha}
              min={data?.hoy}
              onChange={(e) => e.target.value && setFechaTurnos(e.target.value)}
            />
          </div>
        </div>
        {cargando && !data ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : data && data.turnos.length > 0 ? (
          <ul className="divide-y">
            {data.turnos.map((t: RecordatorioTurno) => (
              <li key={t.turno_id} className="flex flex-wrap items-start justify-between gap-4 px-5 py-4">
                <div className="min-w-0 space-y-1">
                  <div className="font-medium">
                    {horaLabel(t.fecha_hora_inicio)} · {t.mascota_nombre}
                    <span className="ml-2 text-xs font-normal text-muted-foreground">
                      {t.tipo_turno} con {t.veterinario_nombre}
                      {t.estado_turno === "solicitado" ? " · sin confirmar" : ""}
                    </span>
                  </div>
                  <Contacto tutor={t.tutor} />
                  <Mensaje texto={t.mensaje} />
                </div>
                <BotonWhatsApp
                  url={t.url_whatsapp}
                  tutor={t.tutor}
                  ultimo={t.ultimo_envio}
                  envios={t.envios}
                  onEnviar={() => void registrar({ turno_id: t.turno_id })}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-6 text-sm text-muted-foreground">No hay turnos pendientes para ese día.</p>
        )}
      </section>

      <section className="rounded-2xl border bg-card shadow-sm">
        <div className="border-b px-5 py-3">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-muted-foreground">
            <Syringe className="size-4" />
            Vacunas y desparasitaciones
          </h2>
          {data ? (
            <p className="mt-1 text-xs text-muted-foreground">
              Las que vencen en los próximos {data.dias_aviso_dosis} días o vencieron hace menos de{" "}
              {data.dias_aviso_dosis_vencida}, sin el refuerzo registrado.
            </p>
          ) : null}
        </div>
        {cargando && !data ? (
          <div className="space-y-2 p-4">
            <Skeleton className="h-12 w-full" />
          </div>
        ) : data && data.dosis.length > 0 ? (
          <ul className="divide-y">
            {data.dosis.map((d: RecordatorioDosis) => (
              <li
                key={d.tratamiento_preventivo_id}
                className="flex flex-wrap items-start justify-between gap-4 px-5 py-4"
              >
                <div className="min-w-0 space-y-1">
                  <div className="font-medium">
                    <Link to={`/mascotas/${d.mascota_id}/vacunas`} className="hover:underline">
                      {d.mascota_nombre}
                    </Link>{" "}
                    · {d.nombre_producto}
                    <span
                      className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${
                        d.dias_para_vencer < 0
                          ? "bg-destructive/10 text-destructive"
                          : "bg-amber-500/15 text-amber-800 dark:text-amber-200"
                      }`}
                    >
                      {diasLabel(d.dias_para_vencer)} ({fechaCorta(d.fecha_proxima_dosis)})
                    </span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {TIPO_PREVENTIVO_LABEL[d.tipo]} aplicada el {fechaCorta(d.fecha_aplicacion)}
                  </div>
                  <Contacto tutor={d.tutor} />
                  <Mensaje texto={d.mensaje} />
                </div>
                <BotonWhatsApp
                  url={d.url_whatsapp}
                  tutor={d.tutor}
                  ultimo={d.ultimo_envio}
                  envios={d.envios}
                  onEnviar={() => void registrar({ tratamiento_preventivo_id: d.tratamiento_preventivo_id })}
                />
              </li>
            ))}
          </ul>
        ) : (
          <p className="p-6 text-sm text-muted-foreground">No hay dosis para recordar.</p>
        )}
      </section>
    </div>
  );
}
