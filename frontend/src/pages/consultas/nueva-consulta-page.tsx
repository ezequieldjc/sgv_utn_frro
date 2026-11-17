import React from "react";
import { useNavigate } from "react-router-dom";
import { Loader2, PawPrint, Search, Stethoscope } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api";
import { hasPermission, mensajeError } from "@/lib/consultas";
import type { MascotaAgendaOpcion } from "@/types/agenda";
import type { ConsultaDetalle } from "@/types/consultas";

import { AccessDenied, BannerError } from "../stock/shared";

/** Abre una consulta sin turno: se busca el paciente y se crea el borrador. */
export default function NuevaConsultaPage() {
  const navigate = useNavigate();
  const { permisos } = useAuth();
  const canCrear = hasPermission(permisos, "consultas:crear");

  const [q, setQ] = React.useState("");
  const [resultados, setResultados] = React.useState<MascotaAgendaOpcion[]>([]);
  const [buscando, setBuscando] = React.useState(false);
  const [abriendo, setAbriendo] = React.useState<number | null>(null);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const termino = q.trim();
    if (!canCrear || termino.length < 2) {
      setResultados([]);
      return;
    }
    let cancelado = false;
    const timer = window.setTimeout(() => {
      setBuscando(true);
      void apiFetch<MascotaAgendaOpcion[]>(
        `/api/consultas/mascotas?q=${encodeURIComponent(termino)}`,
      )
        .then((res) => {
          if (!cancelado) {
            setResultados(res);
          }
        })
        .catch((err: unknown) => {
          if (!cancelado) {
            setError(mensajeError(err, "No se pudo buscar."));
          }
        })
        .finally(() => {
          if (!cancelado) {
            setBuscando(false);
          }
        });
    }, 250);
    return () => {
      cancelado = true;
      window.clearTimeout(timer);
    };
  }, [canCrear, q]);

  async function abrir(mascotaId: number) {
    setError(null);
    setAbriendo(mascotaId);
    try {
      const consulta = await apiFetch<ConsultaDetalle>("/api/consultas", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ mascota_id: mascotaId }),
      });
      navigate(`/consultas/${consulta.id}`);
    } catch (err) {
      setError(mensajeError(err, "No se pudo abrir la consulta."));
      setAbriendo(null);
    }
  }

  if (!canCrear) {
    return <AccessDenied mensaje="No tenés permiso para registrar consultas." />;
  }

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <div className="space-y-1">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Stethoscope className="size-4" />
          <span className="text-xs font-medium uppercase tracking-wider">Consultas</span>
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">Nueva consulta</h1>
        <p className="text-sm text-muted-foreground">
          Para un paciente sin turno. Si tiene turno, iniciala desde la agenda.
        </p>
      </div>

      {error ? <BannerError>{error}</BannerError> : null}

      <section className="space-y-4 rounded-2xl border bg-card p-5 shadow-sm">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            autoFocus
            aria-label="Buscar mascota"
            className="pl-9"
            placeholder="Nombre de la mascota, del tutor o DNI…"
            value={q}
            onChange={(event) => setQ(event.target.value)}
          />
        </div>
        {buscando ? (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="size-4 animate-spin" />
            Buscando…
          </p>
        ) : null}
        {!buscando && q.trim().length >= 2 && resultados.length === 0 ? (
          <p className="text-sm text-muted-foreground">No se encontraron mascotas activas.</p>
        ) : null}
        {resultados.length > 0 ? (
          <ul className="divide-y rounded-xl border">
            {resultados.map((m) => (
              <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2">
                <div className="min-w-0">
                  <p className="flex items-center gap-2 font-medium">
                    <PawPrint className="size-4 text-primary" />
                    {m.nombre}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {m.especie_nombre} · {m.raza_nombre} · Tutor: {m.tutor_nombre}{" "}
                    {m.tutor_apellido}
                  </p>
                </div>
                <Button
                  type="button"
                  size="sm"
                  disabled={abriendo !== null}
                  onClick={() => void abrir(m.id)}
                >
                  {abriendo === m.id ? <Loader2 className="size-4 animate-spin" /> : null}
                  Iniciar consulta
                </Button>
              </li>
            ))}
          </ul>
        ) : null}
      </section>
    </div>
  );
}
