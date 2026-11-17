import React from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Save, Signature, Stethoscope, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";
import { useAuth } from "@/context/auth-context";
import { apiFetch } from "@/lib/api";
import {
  PERMISOS_EDICION,
  PERMISOS_LECTURA,
  armarDiagnosticosFirma,
  cambiosFicha,
  diagnosticoAnterior,
  dictadoDemoPara,
  fechaControlSugerida,
  fechaHoraLabel,
  fichaDesdeDetalle,
  hasAnyPermission,
  hasPermission,
  linkProgramarControl,
  mensajeError,
  validarFicha,
  type ClavePrincipal,
  type DecisionSugerencia,
  type DiagnosticoManual,
  type FichaErrors,
  type FichaForm,
} from "@/lib/consultas";
import type {
  ConsultaDetalle,
  ConsultaListItem,
  ConsultaListResponse,
  ConsultaSignoItem,
  PatologiaOpcion,
  SintomaOpcion,
  SugerenciasResponse,
} from "@/types/consultas";

import { AccessDenied, BannerError, BannerExito } from "../stock/shared";
import {
  DiagnosticosFirmados,
  FichaLectura,
  PanelSugerencias,
  TarjetaDictado,
  TarjetaFicha,
  TarjetaMascota,
  TarjetaSignos,
} from "./consulta-componentes";
import { TarjetaControl, TarjetaControles } from "./control-componentes";

const MANUAL_VACIO: DiagnosticoManual = { patologia_id: null, descripcion: "" };

export default function ConsultaPage() {
  const { id } = useParams();
  const consultaId = Number(id);
  const navigate = useNavigate();
  const { permisos } = useAuth();
  const canVer = hasAnyPermission(permisos, PERMISOS_LECTURA);
  const canEditar = hasAnyPermission(permisos, PERMISOS_EDICION);
  const canFirmar = hasPermission(permisos, "consultas:firmar");
  const canProgramarControl = hasPermission(permisos, "agenda:crear_turno");

  const [detalle, setDetalle] = React.useState<ConsultaDetalle | null>(null);
  const [cargando, setCargando] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [exito, setExito] = React.useState<string | null>(null);

  const [form, setForm] = React.useState<FichaForm | null>(null);
  const [guardada, setGuardada] = React.useState<FichaForm | null>(null);
  const [fichaErrors, setFichaErrors] = React.useState<FichaErrors>({});
  const [guardando, setGuardando] = React.useState(false);

  const [catalogo, setCatalogo] = React.useState<SintomaOpcion[]>([]);
  const [patologias, setPatologias] = React.useState<PatologiaOpcion[]>([]);

  const [grabando, setGrabando] = React.useState(false);
  const [segundos, setSegundos] = React.useState(0);
  const [transcripcion, setTranscripcion] = React.useState("");
  const [procesando, setProcesando] = React.useState(false);
  const [trabajandoSignos, setTrabajandoSignos] = React.useState(false);

  const [sugerencias, setSugerencias] = React.useState<SugerenciasResponse | null>(null);
  const [cargandoSugerencias, setCargandoSugerencias] = React.useState(false);
  const [decisiones, setDecisiones] = React.useState<Record<number, DecisionSugerencia>>({});
  const [principal, setPrincipal] = React.useState<ClavePrincipal>(null);
  const [manual, setManual] = React.useState<DiagnosticoManual>(MANUAL_VACIO);

  // Consultas firmadas de la mascota que pueden ser la anterior de este control.
  const [candidatas, setCandidatas] = React.useState<ConsultaListItem[]>([]);
  const [vinculando, setVinculando] = React.useState(false);

  const [confirmarFirma, setConfirmarFirma] = React.useState(false);
  const [confirmarDescarte, setConfirmarDescarte] = React.useState(false);
  const [firmando, setFirmando] = React.useState(false);

  const esBorrador = detalle?.estado === "borrador";
  const editable = Boolean(esBorrador && canEditar);
  const hayCambios = Boolean(
    form && guardada && Object.keys(cambiosFicha(form, guardada)).length > 0,
  );
  const nombresSignos = React.useMemo(
    () => new Map(catalogo.map((s) => [s.codigo, s.nombre_es])),
    [catalogo],
  );

  const aplicarDetalle = React.useCallback((nuevo: ConsultaDetalle) => {
    setDetalle(nuevo);
    const ficha = fichaDesdeDetalle(nuevo);
    setForm(ficha);
    setGuardada(ficha);
    setFichaErrors({});
  }, []);

  const cargarSugerencias = React.useCallback(async () => {
    setCargandoSugerencias(true);
    try {
      const data = await apiFetch<SugerenciasResponse>(`/api/consultas/${consultaId}/sugerencias`);
      setSugerencias(data);
      const vigentes = new Set(data.sugerencias.map((s) => s.patologia_id));
      setDecisiones((prev) =>
        Object.fromEntries(
          Object.entries(prev).filter(([patologiaId]) => vigentes.has(Number(patologiaId))),
        ),
      );
      setPrincipal((prev) => (typeof prev === "number" && !vigentes.has(prev) ? null : prev));
    } catch (err) {
      setError(mensajeError(err, "No se pudieron calcular las sugerencias."));
    } finally {
      setCargandoSugerencias(false);
    }
  }, [consultaId]);

  React.useEffect(() => {
    if (!canVer || !Number.isFinite(consultaId)) {
      setCargando(false);
      return;
    }
    let cancelado = false;
    void (async () => {
      try {
        const [data, sintomas, pats] = await Promise.all([
          apiFetch<ConsultaDetalle>(`/api/consultas/${consultaId}`),
          apiFetch<SintomaOpcion[]>("/api/consultas/catalogos/sintomas"),
          apiFetch<PatologiaOpcion[]>("/api/consultas/catalogos/patologias"),
        ]);
        if (cancelado) {
          return;
        }
        aplicarDetalle(data);
        setCatalogo(sintomas);
        setPatologias(pats);
        if (data.estado === "borrador") {
          void cargarSugerencias();
        }
      } catch (err) {
        if (!cancelado) {
          setError(mensajeError(err, "No se pudo cargar la consulta."));
        }
      } finally {
        if (!cancelado) {
          setCargando(false);
        }
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [aplicarDetalle, canVer, cargarSugerencias, consultaId]);

  const mascotaId = detalle?.mascota.id;
  const fechaConsulta = detalle?.fecha_hora;
  React.useEffect(() => {
    if (!editable || mascotaId === undefined || fechaConsulta === undefined) {
      setCandidatas([]);
      return;
    }
    let cancelado = false;
    void (async () => {
      try {
        const data = await apiFetch<ConsultaListResponse>(
          `/api/consultas?mascota_id=${mascotaId}&estado=firmada&page_size=50`,
        );
        if (!cancelado) {
          const limite = new Date(fechaConsulta).getTime();
          setCandidatas(data.items.filter((c) => new Date(c.fecha_hora).getTime() <= limite));
        }
      } catch {
        if (!cancelado) {
          setCandidatas([]);
        }
      }
    })();
    return () => {
      cancelado = true;
    };
  }, [editable, mascotaId, fechaConsulta]);

  // Cronómetro de la grabación simulada.
  React.useEffect(() => {
    if (!grabando) {
      return;
    }
    const intervalo = window.setInterval(() => setSegundos((s) => s + 1), 1000);
    return () => window.clearInterval(intervalo);
  }, [grabando]);

  async function guardarFicha(): Promise<boolean> {
    if (!form || !guardada) {
      return false;
    }
    const errores = validarFicha(form);
    setFichaErrors(errores);
    if (Object.keys(errores).length > 0) {
      document.getElementById(Object.keys(errores)[0])?.focus();
      return false;
    }
    const cambios = cambiosFicha(form, guardada);
    if (Object.keys(cambios).length === 0) {
      return true;
    }
    setGuardando(true);
    try {
      const data = await apiFetch<ConsultaDetalle>(`/api/consultas/${consultaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(cambios),
      });
      aplicarDetalle(data);
      return true;
    } catch (err) {
      setError(mensajeError(err, "No se pudo guardar el borrador."));
      return false;
    } finally {
      setGuardando(false);
    }
  }

  async function procesarDictado() {
    if (!transcripcion.trim()) {
      return;
    }
    setError(null);
    setExito(null);
    if (!(await guardarFicha())) {
      return;
    }
    setProcesando(true);
    try {
      const data = await apiFetch<ConsultaDetalle>(`/api/consultas/${consultaId}/dictados`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          texto: transcripcion,
          duracion_audio_s: segundos > 0 ? segundos : null,
        }),
      });
      aplicarDetalle(data);
      setTranscripcion("");
      setSegundos(0);
      await cargarSugerencias();
    } catch (err) {
      setError(mensajeError(err, "No se pudo procesar el dictado."));
    } finally {
      setProcesando(false);
    }
  }

  async function operarSigno(url: string, init: RequestInit) {
    setError(null);
    setTrabajandoSignos(true);
    try {
      const data = await apiFetch<ConsultaDetalle>(url, init);
      // Conserva lo que se está escribiendo en la ficha.
      setDetalle(data);
      await cargarSugerencias();
    } catch (err) {
      setError(mensajeError(err, "No se pudo actualizar el signo."));
    } finally {
      setTrabajandoSignos(false);
    }
  }

  async function vincularAnterior(padreId: number | null) {
    setError(null);
    setExito(null);
    setVinculando(true);
    try {
      const data = await apiFetch<ConsultaDetalle>(`/api/consultas/${consultaId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ consulta_padre_id: padreId }),
      });
      // Conserva lo que se está escribiendo en la ficha: el vínculo no la toca.
      setDetalle(data);
    } catch (err) {
      setError(mensajeError(err, "No se pudo vincular la consulta anterior."));
    } finally {
      setVinculando(false);
    }
  }

  function usarDiagnosticoAnterior() {
    const dx = diagnosticoAnterior(detalle?.consulta_padre ?? null);
    if (!dx) {
      return;
    }
    setManual(dx);
    if (principal === null) {
      setPrincipal("manual");
    }
    setExito("Se cargó el diagnóstico de la consulta anterior como diagnóstico manual. Revisalo antes de firmar.");
  }

  const base = `/api/consultas/${consultaId}/signos`;
  const json = { "Content-Type": "application/json" };

  async function firmar() {
    if (!sugerencias) {
      return;
    }
    setError(null);
    const { diagnosticos, error: errorFirma } = armarDiagnosticosFirma(
      sugerencias.sugerencias,
      decisiones,
      principal,
      manual,
    );
    if (errorFirma) {
      setConfirmarFirma(false);
      setError(errorFirma);
      return;
    }
    setFirmando(true);
    try {
      if (!(await guardarFicha())) {
        setConfirmarFirma(false);
        return;
      }
      const data = await apiFetch<ConsultaDetalle>(`/api/consultas/${consultaId}/firmar`, {
        method: "POST",
        headers: json,
        body: JSON.stringify({ diagnosticos }),
      });
      aplicarDetalle(data);
      setConfirmarFirma(false);
      setExito("Consulta firmada. Quedó en la historia clínica y en solo lectura.");
    } catch (err) {
      setConfirmarFirma(false);
      setError(mensajeError(err, "No se pudo firmar la consulta."));
      if ((err as { status?: number })?.status === 409) {
        await cargarSugerencias();
      }
    } finally {
      setFirmando(false);
    }
  }

  async function descartar() {
    try {
      await apiFetch<string>(`/api/consultas/${consultaId}`, { method: "DELETE" });
      navigate(detalle?.turno_id ? "/agenda" : "/consultas/historial");
    } catch (err) {
      setConfirmarDescarte(false);
      setError(mensajeError(err, "No se pudo descartar la consulta."));
    }
  }

  if (!canVer) {
    return <AccessDenied mensaje="No tenés permiso para ver consultas." />;
  }

  if (cargando) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_22rem]">
          <Skeleton className="h-96 rounded-2xl" />
          <Skeleton className="h-96 rounded-2xl" />
        </div>
      </div>
    );
  }

  if (!detalle || !form) {
    return (
      <div className="space-y-4">
        <BannerError>{error ?? "No se encontró la consulta."}</BannerError>
        <Button variant="outline" asChild>
          <Link to="/consultas/historial">
            <ArrowLeft className="size-4" />
            Volver al historial
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Stethoscope className="size-4" />
            <span className="text-xs font-medium uppercase tracking-wider">Consultas</span>
          </div>
          <h1 className="flex flex-wrap items-center gap-3 text-2xl font-semibold tracking-tight">
            Consulta de {detalle.mascota.nombre}
            <span
              className={`rounded-full px-2.5 py-0.5 text-xs font-medium ${
                esBorrador
                  ? "bg-amber-500/15 text-amber-800 dark:text-amber-200"
                  : "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
              }`}
            >
              {esBorrador ? "Borrador" : "Firmada"}
            </span>
          </h1>
          <p className="text-sm text-muted-foreground">
            {fechaHoraLabel(detalle.fecha_hora)} · {detalle.veterinario_nombre}
            {detalle.fecha_firma ? ` · firmada el ${fechaHoraLabel(detalle.fecha_firma)}` : ""}
          </p>
        </div>
        <Button variant="outline" asChild>
          <Link to={`/consultas/historial?mascota_id=${detalle.mascota.id}`}>
            Historia clínica
          </Link>
        </Button>
      </div>

      {error ? <BannerError>{error}</BannerError> : null}
      {exito ? <BannerExito>{exito}</BannerExito> : null}

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_22rem]">
        <div className="min-w-0 space-y-6">
          <TarjetaControl
            anterior={detalle.consulta_padre}
            signosActuales={detalle.signos}
            candidatas={candidatas}
            editable={editable}
            trabajando={vinculando}
            onVincular={(padreId) => void vincularAnterior(padreId)}
            onUsarDiagnostico={usarDiagnosticoAnterior}
          />
          {editable ? (
            <>
              <TarjetaDictado
                grabando={grabando}
                segundos={segundos}
                texto={transcripcion}
                procesando={procesando}
                deshabilitado={!editable}
                onIniciar={() => {
                  setSegundos(0);
                  setGrabando(true);
                }}
                onDetener={() => {
                  setGrabando(false);
                  if (!transcripcion.trim()) {
                    setTranscripcion(dictadoDemoPara(detalle.mascota));
                  }
                }}
                onTexto={setTranscripcion}
                onProcesar={() => void procesarDictado()}
              />
              <TarjetaFicha
                form={form}
                errors={fichaErrors}
                autocompletada={detalle.dictados.length > 0}
                onCampo={(campo, valor) => {
                  setForm((prev) => (prev ? { ...prev, [campo]: valor } : prev));
                  setFichaErrors((prev) => ({ ...prev, [campo]: undefined }));
                }}
              />
            </>
          ) : (
            <FichaLectura detalle={detalle} />
          )}
          <TarjetaSignos
            signos={detalle.signos}
            catalogo={catalogo}
            editable={editable}
            trabajando={trabajandoSignos}
            onAlternar={(signo: ConsultaSignoItem) =>
              void operarSigno(`${base}/${signo.id}`, {
                method: "PATCH",
                headers: json,
                body: JSON.stringify({ presente: !signo.presente }),
              })
            }
            onQuitar={(signo) => void operarSigno(`${base}/${signo.id}`, { method: "DELETE" })}
            onAgregar={(sintomaId, presente) =>
              void operarSigno(base, {
                method: "POST",
                headers: json,
                body: JSON.stringify({ sintoma_id: sintomaId, presente }),
              })
            }
            onAsignarCodigo={(signo, sintomaId) =>
              void operarSigno(`${base}/${signo.id}`, {
                method: "PATCH",
                headers: json,
                body: JSON.stringify({ sintoma_id: sintomaId }),
              })
            }
          />
          {!esBorrador && detalle.dictados.length > 0 ? (
            <section className="space-y-2 rounded-2xl border bg-card p-5 shadow-sm">
              <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
                Dictados
              </h2>
              {detalle.dictados.map((d) => (
                <p key={d.id} className="whitespace-pre-line text-sm text-muted-foreground">
                  {d.transcripcion}
                </p>
              ))}
            </section>
          ) : null}
        </div>

        <div className="min-w-0 space-y-6">
          <TarjetaMascota mascota={detalle.mascota} />
          {esBorrador ? (
            <PanelSugerencias
              sugerencias={sugerencias?.sugerencias ?? []}
              signosSinCodigo={sugerencias?.signos_sin_codigo ?? 0}
              otraCausaPct={sugerencias?.otra_causa_pct ?? null}
              evidenciaSuficiente={sugerencias?.evidencia_suficiente ?? true}
              cargando={cargandoSugerencias}
              decisiones={decisiones}
              principal={principal}
              manual={manual}
              patologias={patologias}
              nombresSignos={nombresSignos}
              onActualizar={() => void cargarSugerencias()}
              onDecidir={(patologiaId, decision) => {
                setDecisiones((prev) => ({ ...prev, [patologiaId]: decision }));
                if (decision === "aceptada" && principal === null) {
                  setPrincipal(patologiaId);
                }
                if (decision !== "aceptada" && principal === patologiaId) {
                  setPrincipal(null);
                }
              }}
              onPrincipal={setPrincipal}
              onManual={(nuevo) => {
                setManual(nuevo);
                const cargado = nuevo.patologia_id !== null || nuevo.descripcion.trim() !== "";
                if (!cargado && principal === "manual") {
                  setPrincipal(null);
                }
                if (cargado && principal === null) {
                  setPrincipal("manual");
                }
              }}
            />
          ) : (
            <>
              <DiagnosticosFirmados diagnosticos={detalle.diagnosticos} />
              <TarjetaControles
                controles={detalle.controles}
                fechaSugerida={fechaControlSugerida(detalle)}
                linkProgramar={linkProgramarControl(detalle)}
                puedeProgramar={canProgramarControl}
              />
            </>
          )}
        </div>
      </div>

      {editable ? (
        <div className="sticky bottom-0 z-20 rounded-2xl border bg-background/95 shadow-md backdrop-blur">
          <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-3">
            <p className="text-xs text-muted-foreground">
              {hayCambios ? "Hay cambios sin guardar en la ficha." : "Borrador guardado."}
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setConfirmarDescarte(true)}
                disabled={guardando || firmando}
              >
                <Trash2 className="size-4" />
                Descartar
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setExito(null);
                  void guardarFicha().then((ok) => ok && setExito("Borrador guardado."));
                }}
                disabled={guardando || !hayCambios}
              >
                {guardando ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                Guardar borrador
              </Button>
              {canFirmar ? (
                <Button
                  type="button"
                  onClick={() => setConfirmarFirma(true)}
                  disabled={guardando || firmando || procesando || grabando}
                >
                  <Signature className="size-4" />
                  Firmar consulta
                </Button>
              ) : null}
            </div>
          </div>
        </div>
      ) : null}

      <Dialog open={confirmarFirma} onOpenChange={(open) => !firmando && setConfirmarFirma(open)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Firmar consulta</DialogTitle>
            <DialogDescription>
              Se guardan los diagnósticos aceptados, se confirman los signos y la consulta queda en
              solo lectura en la historia clínica de {detalle.mascota.nombre}.
              {detalle.turno_id ? " El turno pasa a atendido." : ""}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmarFirma(false)} disabled={firmando}>
              Volver
            </Button>
            <Button onClick={() => void firmar()} disabled={firmando}>
              {firmando ? <Loader2 className="size-4 animate-spin" /> : <Signature className="size-4" />}
              Firmar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={confirmarDescarte} onOpenChange={setConfirmarDescarte}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Descartar consulta</DialogTitle>
            <DialogDescription>
              Se borra el borrador con sus dictados y signos. Esta acción no se puede deshacer.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmarDescarte(false)}>
              Volver
            </Button>
            <Button variant="destructive" onClick={() => void descartar()}>
              Descartar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
