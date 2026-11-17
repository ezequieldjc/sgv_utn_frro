import React from "react";
import {
  AlertTriangle,
  Check,
  Info,
  Loader2,
  Mic,
  PawPrint,
  Plus,
  RefreshCw,
  Sparkles,
  Square,
  Trash2,
  X,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  SEXO_LABEL,
  edadLabel,
  formatearCronometro,
  nombreDiagnostico,
  porcentajeLabel,
  type ClavePrincipal,
  type DecisionSugerencia,
  type DiagnosticoManual,
  type FichaErrors,
  type FichaForm,
} from "@/lib/consultas";
import type {
  ConsultaDetalle,
  ConsultaSignoItem,
  DiagnosticoItem,
  MascotaResumen,
  PatologiaOpcion,
  SintomaOpcion,
  SugerenciaItem,
} from "@/types/consultas";

import { fieldClass, selectClass } from "../stock/shared";

const tarjeta = "rounded-2xl border bg-card p-5 shadow-sm";
const tituloTarjeta = "text-sm font-semibold uppercase tracking-wide text-muted-foreground";

// ---------------------------------------------------------------------------
// Mascota
// ---------------------------------------------------------------------------

export function TarjetaMascota({ mascota }: { mascota: MascotaResumen }) {
  const datos = [
    mascota.sexo ? SEXO_LABEL[mascota.sexo] ?? mascota.sexo : null,
    edadLabel(mascota.edad_meses),
    mascota.ultimo_peso ? `${Number(mascota.ultimo_peso)} kg (último)` : null,
    mascota.estado_reproductivo_nombre,
  ].filter((d): d is string => Boolean(d));

  return (
    <section className={`${tarjeta} space-y-2`}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="flex items-center gap-2 font-semibold">
            <PawPrint className="size-4 shrink-0 text-primary" />
            <span className="truncate">{mascota.nombre}</span>
          </p>
          <p className="text-sm text-muted-foreground">
            {mascota.especie_nombre} · {mascota.raza_nombre}
          </p>
        </div>
      </div>
      <p className="text-xs text-muted-foreground">
        Tutor: {mascota.tutor_nombre}
        {datos.length > 0 ? ` · ${datos.join(" · ")}` : ""}
      </p>
      {mascota.alertas_medicas ? (
        <div className="flex items-start gap-2 rounded-xl border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs font-medium text-destructive">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0" />
          <span>Alerta médica: {mascota.alertas_medicas}</span>
        </div>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Dictado (simulado)
// ---------------------------------------------------------------------------

export function TarjetaDictado({
  grabando,
  segundos,
  texto,
  procesando,
  deshabilitado,
  onIniciar,
  onDetener,
  onTexto,
  onProcesar,
}: {
  grabando: boolean;
  segundos: number;
  texto: string;
  procesando: boolean;
  deshabilitado: boolean;
  onIniciar: () => void;
  onDetener: () => void;
  onTexto: (valor: string) => void;
  onProcesar: () => void;
}) {
  return (
    <section className={`${tarjeta} space-y-4`}>
      <div className="flex flex-wrap items-center gap-4">
        <Button
          type="button"
          size="icon"
          className="size-12 rounded-full"
          variant={grabando ? "destructive" : "default"}
          onClick={grabando ? onDetener : onIniciar}
          disabled={deshabilitado || procesando}
          aria-label={grabando ? "Detener dictado" : "Iniciar dictado"}
        >
          {grabando ? <Square className="size-5" /> : <Mic className="size-5" />}
        </Button>
        <div className="min-w-0 flex-1">
          <p className="font-medium">
            {grabando ? `Grabando… ${formatearCronometro(segundos)}` : "Dictado por voz"}
          </p>
          <p className="text-xs text-muted-foreground">
            {grabando
              ? "Hacé clic para detener. El dictado no bloquea la pantalla."
              : "Hacé clic para dictar, o escribí la transcripción a mano."}
          </p>
        </div>
        {grabando ? (
          <div className="flex h-8 items-end gap-0.5" aria-hidden>
            {Array.from({ length: 16 }, (_, i) => (
              <span
                key={i}
                className="w-1 animate-pulse rounded-full bg-primary"
                style={{ height: `${30 + ((i * 37 + segundos * 13) % 70)}%`, animationDelay: `${i * 60}ms` }}
              />
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <Label htmlFor="transcripcion">Transcripción (editable)</Label>
        <Textarea
          id="transcripcion"
          rows={4}
          value={texto}
          disabled={deshabilitado || grabando}
          placeholder="Acá aparece lo que se dictó. Revisalo y procesalo para completar la ficha."
          onChange={(event) => onTexto(event.target.value)}
        />
      </div>

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Info className="size-3.5 shrink-0" />
          Prototipo: la grabación y la transcripción se simulan; la ficha la arma el extractor por
          reglas.
        </p>
        <Button
          type="button"
          onClick={onProcesar}
          disabled={deshabilitado || grabando || procesando || !texto.trim()}
        >
          {procesando ? (
            <>
              <Loader2 className="size-4 animate-spin" />
              Procesando…
            </>
          ) : (
            <>
              <Sparkles className="size-4" />
              Procesar dictado
            </>
          )}
        </Button>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Ficha
// ---------------------------------------------------------------------------

const CAMPOS_TEXTO: { campo: keyof FichaForm; label: string; filas: number }[] = [
  { campo: "anamnesis", label: "Anamnesis", filas: 3 },
  { campo: "examen_fisico", label: "Examen físico", filas: 3 },
  { campo: "tratamiento", label: "Tratamiento", filas: 2 },
  { campo: "observaciones", label: "Observaciones y estudios pedidos", filas: 2 },
];

export function TarjetaFicha({
  form,
  errors,
  autocompletada,
  onCampo,
}: {
  form: FichaForm;
  errors: FichaErrors;
  autocompletada: boolean;
  onCampo: (campo: keyof FichaForm, valor: string) => void;
}) {
  return (
    <section className={`${tarjeta} space-y-4`}>
      <div className="flex items-center gap-2">
        <h2 className={tituloTarjeta}>Ficha</h2>
        {autocompletada ? (
          <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
            autocompletada
          </span>
        ) : null}
      </div>
      <div className="grid gap-4 sm:grid-cols-[1fr_8rem_8rem]">
        <div className="space-y-2">
          <Label htmlFor="motivo">Motivo de consulta</Label>
          <Input
            id="motivo"
            value={form.motivo}
            onChange={(event) => onCampo("motivo", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="peso_kg">Peso (kg)</Label>
          <Input
            id="peso_kg"
            inputMode="decimal"
            value={form.peso_kg}
            className={fieldClass(Boolean(errors.peso_kg))}
            onChange={(event) => onCampo("peso_kg", event.target.value)}
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="temperatura_c">Temperatura (°C)</Label>
          <Input
            id="temperatura_c"
            inputMode="decimal"
            value={form.temperatura_c}
            className={fieldClass(Boolean(errors.temperatura_c))}
            onChange={(event) => onCampo("temperatura_c", event.target.value)}
          />
        </div>
      </div>
      {errors.peso_kg || errors.temperatura_c ? (
        <p className="text-sm text-destructive">{errors.peso_kg ?? errors.temperatura_c}</p>
      ) : null}
      {CAMPOS_TEXTO.map(({ campo, label, filas }) => (
        <div key={campo} className="space-y-2">
          <Label htmlFor={campo}>{label}</Label>
          <Textarea
            id={campo}
            rows={filas}
            value={form[campo]}
            onChange={(event) => onCampo(campo, event.target.value)}
          />
        </div>
      ))}
    </section>
  );
}

export function FichaLectura({ detalle }: { detalle: ConsultaDetalle }) {
  const filas: { label: string; valor: string | null }[] = [
    { label: "Motivo de consulta", valor: detalle.motivo },
    {
      label: "Peso",
      valor: detalle.peso_kg !== null ? `${Number(detalle.peso_kg)} kg` : null,
    },
    {
      label: "Temperatura",
      valor: detalle.temperatura_c !== null ? `${Number(detalle.temperatura_c)} °C` : null,
    },
    { label: "Anamnesis", valor: detalle.anamnesis },
    { label: "Examen físico", valor: detalle.examen_fisico },
    { label: "Tratamiento", valor: detalle.tratamiento },
    { label: "Observaciones y estudios pedidos", valor: detalle.observaciones },
  ];
  return (
    <section className={`${tarjeta} space-y-4`}>
      <h2 className={tituloTarjeta}>Ficha</h2>
      <dl className="grid gap-3 sm:grid-cols-2">
        {filas.map(({ label, valor }) => (
          <div key={label} className="space-y-0.5 sm:[&:nth-child(n+4)]:col-span-2">
            <dt className="text-xs font-medium text-muted-foreground">{label}</dt>
            <dd className="whitespace-pre-line text-sm">{valor ?? "—"}</dd>
          </div>
        ))}
      </dl>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Signos
// ---------------------------------------------------------------------------

export function TarjetaSignos({
  signos,
  catalogo,
  editable,
  trabajando,
  onAlternar,
  onQuitar,
  onAgregar,
  onAsignarCodigo,
}: {
  signos: ConsultaSignoItem[];
  catalogo: SintomaOpcion[];
  editable: boolean;
  trabajando: boolean;
  onAlternar: (signo: ConsultaSignoItem) => void;
  onQuitar: (signo: ConsultaSignoItem) => void;
  onAgregar: (sintomaId: number, presente: boolean) => void;
  onAsignarCodigo: (signo: ConsultaSignoItem, sintomaId: number) => void;
}) {
  const [nuevo, setNuevo] = React.useState("");
  const usados = new Set(signos.map((s) => s.sintoma_id).filter((id): id is number => id !== null));
  const disponibles = catalogo.filter((s) => !usados.has(s.id));

  return (
    <section className={`${tarjeta} space-y-4`}>
      <div className="space-y-1">
        <h2 className={tituloTarjeta}>Signos clínicos</h2>
        <p className="text-xs text-muted-foreground">
          Presente o negado («no vomita») no es lo mismo que no mencionado: el motor usa las dos
          cosas.
        </p>
      </div>

      {signos.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Todavía no hay signos. Dictá la consulta o agregalos a mano.
        </p>
      ) : (
        <ul className="divide-y rounded-xl border">
          {signos.map((signo) => (
            <li key={signo.id} className="flex flex-wrap items-center gap-3 px-3 py-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {signo.nombre ?? (
                    <span className="text-amber-700 dark:text-amber-300">Sin código</span>
                  )}
                </p>
                <p className="truncate text-xs text-muted-foreground" title={signo.texto_original}>
                  «{signo.texto_original}» · {signo.origen === "nlp" ? "dictado" : "manual"}
                  {signo.confirmado ? " · revisado" : ""}
                </p>
              </div>
              {signo.sintoma_id === null && editable ? (
                <select
                  aria-label="Asignar código"
                  className={`${selectClass} w-48`}
                  value=""
                  disabled={trabajando}
                  onChange={(event) => {
                    if (event.target.value) {
                      onAsignarCodigo(signo, Number(event.target.value));
                    }
                  }}
                >
                  <option value="">Asignar signo…</option>
                  {disponibles.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.nombre_es}
                    </option>
                  ))}
                </select>
              ) : null}
              {editable ? (
                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    size="sm"
                    variant="outline"
                    disabled={trabajando}
                    onClick={() => onAlternar(signo)}
                    className={
                      signo.presente
                        ? "border-emerald-500/40 text-emerald-700 dark:text-emerald-300"
                        : "border-destructive/40 text-destructive"
                    }
                  >
                    {signo.presente ? <Check className="size-3.5" /> : <X className="size-3.5" />}
                    {signo.presente ? "Presente" : "Negado"}
                  </Button>
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    disabled={trabajando}
                    aria-label="Quitar signo"
                    onClick={() => onQuitar(signo)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ) : (
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                    signo.presente
                      ? "bg-green-100 text-green-800 dark:bg-green-900/40 dark:text-green-300"
                      : "bg-destructive/10 text-destructive"
                  }`}
                >
                  {signo.presente ? "Presente" : "Negado"}
                </span>
              )}
            </li>
          ))}
        </ul>
      )}

      {editable ? (
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Signo para agregar"
            className={`${selectClass} min-w-0 flex-1`}
            value={nuevo}
            disabled={trabajando}
            onChange={(event) => setNuevo(event.target.value)}
          >
            <option value="">Agregar un signo a mano…</option>
            {disponibles.map((s) => (
              <option key={s.id} value={s.id}>
                {s.nombre_es}
              </option>
            ))}
          </select>
          <Button
            type="button"
            variant="outline"
            disabled={!nuevo || trabajando}
            onClick={() => {
              onAgregar(Number(nuevo), true);
              setNuevo("");
            }}
          >
            <Plus className="size-4" />
            Presente
          </Button>
          <Button
            type="button"
            variant="outline"
            disabled={!nuevo || trabajando}
            onClick={() => {
              onAgregar(Number(nuevo), false);
              setNuevo("");
            }}
          >
            <X className="size-4" />
            Negado
          </Button>
        </div>
      ) : null}
    </section>
  );
}

// ---------------------------------------------------------------------------
// Sugerencias y diagnósticos
// ---------------------------------------------------------------------------

function Explicacion({
  sugerencia,
  nombres,
}: {
  sugerencia: SugerenciaItem;
  nombres: Map<string, string>;
}) {
  const { explicacion } = sugerencia;
  const signo = (codigo: string) => nombres.get(codigo) ?? codigo;
  return (
    <details className="text-xs text-muted-foreground">
      <summary className="cursor-pointer select-none">¿Por qué?</summary>
      <ul className="mt-1 space-y-0.5 pl-3">
        <li>Prevalencia base: {explicacion.prevalencia}</li>
        <li>
          Raza:{" "}
          {explicacion.raza
            ? `predisposición ×${explicacion.raza.multiplicador}`
            : "sin predisposición registrada (×1)"}
        </li>
        {explicacion.sintomas_presentes.map((s) => (
          <li key={`p-${s.codigo}`}>
            {signo(s.codigo)}: presente, frecuencia {s.frecuencia}
            {s.sin_fila ? " (no asociado a esta patología)" : ""}
          </li>
        ))}
        {explicacion.sintomas_negados.map((s) => (
          <li key={`n-${s.codigo}`}>
            {signo(s.codigo)}: negado, ×{(1 - s.frecuencia).toFixed(2)}
          </li>
        ))}
      </ul>
      {sugerencia.estudio_sugerido ? (
        <p className="mt-1">Estudio sugerido: {sugerencia.estudio_sugerido}</p>
      ) : null}
    </details>
  );
}

export function PanelSugerencias({
  sugerencias,
  signosSinCodigo,
  cargando,
  decisiones,
  principal,
  manual,
  patologias,
  nombresSignos,
  onActualizar,
  onDecidir,
  onPrincipal,
  onManual,
}: {
  sugerencias: SugerenciaItem[];
  signosSinCodigo: number;
  cargando: boolean;
  decisiones: Record<number, DecisionSugerencia>;
  principal: ClavePrincipal;
  manual: DiagnosticoManual;
  patologias: PatologiaOpcion[];
  nombresSignos: Map<string, string>;
  onActualizar: () => void;
  onDecidir: (patologiaId: number, decision: DecisionSugerencia) => void;
  onPrincipal: (clave: ClavePrincipal) => void;
  onManual: (manual: DiagnosticoManual) => void;
}) {
  const manualActivo = manual.patologia_id !== null || manual.descripcion.trim() !== "";
  return (
    <section className={`${tarjeta} space-y-4`}>
      <div className="flex items-start justify-between gap-2">
        <div>
          <h2 className="font-semibold">Sugerencias de apoyo (IA)</h2>
          <p className="text-xs text-muted-foreground">Según signos, especie y raza</p>
        </div>
        <Button
          type="button"
          size="icon"
          variant="ghost"
          aria-label="Actualizar sugerencias"
          disabled={cargando}
          onClick={onActualizar}
        >
          <RefreshCw className={`size-4 ${cargando ? "animate-spin" : ""}`} />
        </Button>
      </div>

      {sugerencias.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          {cargando
            ? "Calculando…"
            : "Dictá la consulta o cargá signos para ver las sugerencias."}
        </p>
      ) : (
        <ul className="space-y-3">
          {sugerencias.map((s) => {
            const decision = decisiones[s.patologia_id] ?? "pendiente";
            const pct = Number(s.probabilidad_pct);
            return (
              <li
                key={s.patologia_id}
                className={`space-y-2 rounded-xl border p-3 ${
                  decision === "descartada" ? "opacity-50" : ""
                } ${decision === "aceptada" ? "border-primary/50 bg-primary/5" : ""}`}
              >
                <div className="flex items-baseline justify-between gap-2">
                  <p className="font-medium">{s.nombre}</p>
                  <span className="text-sm tabular-nums">{porcentajeLabel(pct)}</span>
                </div>
                <div className="h-1.5 overflow-hidden rounded-full bg-muted">
                  <div className="h-full rounded-full bg-primary" style={{ width: `${pct}%` }} />
                </div>
                <div className="flex flex-wrap items-center gap-2">
                  {decision === "aceptada" ? (
                    <>
                      <label className="flex items-center gap-1.5 text-xs">
                        <input
                          type="radio"
                          name="principal"
                          checked={principal === s.patologia_id}
                          onChange={() => onPrincipal(s.patologia_id)}
                        />
                        Principal
                      </label>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => onDecidir(s.patologia_id, "pendiente")}
                      >
                        Deshacer
                      </Button>
                    </>
                  ) : (
                    <>
                      <Button
                        type="button"
                        size="sm"
                        onClick={() => onDecidir(s.patologia_id, "aceptada")}
                      >
                        Aceptar
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() =>
                          onDecidir(
                            s.patologia_id,
                            decision === "descartada" ? "pendiente" : "descartada",
                          )
                        }
                      >
                        {decision === "descartada" ? "Deshacer" : "Descartar"}
                      </Button>
                    </>
                  )}
                </div>
                <Explicacion sugerencia={s} nombres={nombresSignos} />
              </li>
            );
          })}
        </ul>
      )}

      {signosSinCodigo > 0 ? (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          {signosSinCodigo === 1
            ? "1 signo sin código no entra al cálculo."
            : `${signosSinCodigo} signos sin código no entran al cálculo.`}{" "}
          Asignales un signo del catálogo.
        </p>
      ) : null}

      <div className="space-y-2 border-t pt-4">
        <p className="text-sm font-medium">Diagnóstico manual (opcional)</p>
        <select
          aria-label="Patología del catálogo"
          className={selectClass}
          value={manual.patologia_id ?? ""}
          onChange={(event) =>
            onManual({
              ...manual,
              patologia_id: event.target.value ? Number(event.target.value) : null,
            })
          }
        >
          <option value="">Patología del catálogo…</option>
          {patologias.map((p) => (
            <option key={p.id} value={p.id}>
              {p.nombre}
            </option>
          ))}
        </select>
        <Input
          aria-label="Descripción libre"
          placeholder="…o escribilo si no está en el catálogo"
          value={manual.descripcion}
          maxLength={255}
          onChange={(event) => onManual({ ...manual, descripcion: event.target.value })}
        />
        {manualActivo ? (
          <label className="flex items-center gap-1.5 text-xs">
            <input
              type="radio"
              name="principal"
              checked={principal === "manual"}
              onChange={() => onPrincipal("manual")}
            />
            Principal
          </label>
        ) : null}
      </div>

      <p className="rounded-xl border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-800 dark:text-amber-200">
        Son una ayuda para la evaluación clínica, no un diagnóstico definitivo. La decisión es del
        profesional.
      </p>
    </section>
  );
}

export function DiagnosticosFirmados({ diagnosticos }: { diagnosticos: DiagnosticoItem[] }) {
  return (
    <section className={`${tarjeta} space-y-3`}>
      <h2 className="font-semibold">Diagnósticos</h2>
      {diagnosticos.length === 0 ? (
        <p className="text-sm text-muted-foreground">Sin diagnósticos registrados.</p>
      ) : (
        <ul className="space-y-2">
          {diagnosticos.map((d) => (
            <li key={d.id} className="rounded-xl border p-3">
              <div className="flex items-baseline justify-between gap-2">
                <p className="font-medium">{nombreDiagnostico(d)}</p>
                {d.tipo_diagnostico === "principal" ? (
                  <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                    Principal
                  </span>
                ) : null}
              </div>
              <p className="text-xs text-muted-foreground">
                {d.origen === "sugerido_ia"
                  ? `Sugerido por IA (puesto ${d.ranking}, ${porcentajeLabel(d.probabilidad_pct)}) y aceptado`
                  : "Cargado por el veterinario"}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
