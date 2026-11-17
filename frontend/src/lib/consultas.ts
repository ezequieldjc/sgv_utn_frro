import type {
  ConsultaDetalle,
  ConsultaUpdatePayload,
  DiagnosticoFirmaPayload,
  MascotaResumen,
  PatologiaOpcion,
  SugerenciaItem,
} from "@/types/consultas";

export function hasPermission(permisos: string[], required: string): boolean {
  return permisos.includes("*") || permisos.includes(required);
}

export function hasAnyPermission(permisos: string[], required: string[]): boolean {
  return required.some((p) => hasPermission(permisos, p));
}

export const PERMISOS_EDICION = ["consultas:crear", "consultas:editar_historia_clinica"];
export const PERMISOS_LECTURA = [
  "consultas:crear",
  "consultas:ver_historia_clinica",
  "consultas:ver_historial",
];
export const PERMISOS_HISTORIAL = ["consultas:ver_historial", "consultas:ver_historia_clinica"];

/** Estados del turno desde los que se puede iniciar una consulta. */
export const ESTADOS_TURNO_ATENDIBLES = ["solicitado", "confirmado"];

// ---------------------------------------------------------------------------
// Dictado simulado
// ---------------------------------------------------------------------------

/**
 * Dictados de demostración por código de raza: el prototipo no graba audio, así que al
 * "dictar" se carga el texto del caso de la mascota. El veterinario lo puede editar antes de
 * procesarlo.
 */
export const DICTADOS_DEMO: Record<string, string> = {
  "french-bulldog":
    "Viene porque ronca mucho y se cansa enseguida cuando sale a caminar. " +
    "La dueña cuenta que a veces devuelve la comida sin esfuerzo después de comer, " +
    "que tose de noche y que nunca se desmayó. " +
    "Pesa 13,2 kilos, temperatura 38,9. " +
    "Respira con dificultad y las mucosas se ponen azuladas cuando se agita. " +
    "Indico reposo, evitar el calor y control en diez días.",
  "cocker-spaniel":
    "Viene porque sacude la cabeza y se rasca las orejas desde hace una semana. " +
    "La dueña cuenta que no tiene fiebre y come bien. " +
    "Pesa 14,5 kilos, temperatura 38,6. Al examen presenta secreción marrón en el oído izquierdo. " +
    "Pido citología de oído. Indico limpiador ótico cada 12 horas y control en siete días.",
  "labrador-retriever":
    "Viene porque renguea de la pata trasera derecha y le cuesta levantarse a la mañana. " +
    "El dueño cuenta que se cansa en los paseos largos desde hace dos meses. " +
    "Pesa 34 kilos, temperatura 38,4. Presenta dolor de cadera a la manipulación. " +
    "Pido radiografía de cadera. Indico reposo relativo y control en quince días.",
  "german-shepherd-dog":
    "Viene porque renguea de los miembros posteriores y le cuesta levantarse. " +
    "El dueño cuenta que no vomita ni tiene diarrea. " +
    "Pesa 33 kilos, temperatura 38,5. Presenta dolor de cadera a la manipulación. " +
    "Pido radiografía de cadera.",
};

export const DICTADO_DEMO_GENERICO =
  "Viene porque vomita desde ayer y tiene diarrea. " +
  "El dueño cuenta que está decaído y no come. " +
  "Pesa 12 kilos, temperatura 39,4. Presenta dolor abdominal a la palpación. " +
  "Indico dieta blanda y control en tres días.";

export function dictadoDemoPara(mascota: Pick<MascotaResumen, "raza_codigo">): string {
  return (mascota.raza_codigo && DICTADOS_DEMO[mascota.raza_codigo]) || DICTADO_DEMO_GENERICO;
}

/** El motor normaliza a 100 %: los extremos se muestran sin sugerir certeza absoluta. */
/**
 * Aviso para el panel cuando "otra causa no contemplada" pesa más que la primera sugerencia.
 * Sin sugerencias no hay nada que advertir: el panel ya pide dictar o cargar signos.
 */
export function avisoEvidencia(
  sugerencias: SugerenciaItem[],
  evidenciaSuficiente: boolean,
  otraCausaPct: string | null,
): string | null {
  if (sugerencias.length === 0 || evidenciaSuficiente) {
    return null;
  }
  return (
    `Evidencia insuficiente: con estos signos, lo más probable (${porcentajeLabel(otraCausaPct)}) ` +
    "es una causa que no está en el catálogo del prototipo. Tomá las sugerencias con cautela."
  );
}

export function porcentajeLabel(valor: string | number | null): string {
  if (valor === null) {
    return "—";
  }
  const pct = Number(valor);
  if (pct >= 99.5) {
    return ">99%";
  }
  if (pct < 1) {
    return "<1%";
  }
  return `${Math.round(pct)}%`;
}

export function formatearCronometro(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = segundos % 60;
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

// ---------------------------------------------------------------------------
// Datos del paciente
// ---------------------------------------------------------------------------

export function edadLabel(meses: number | null): string | null {
  if (meses === null) {
    return null;
  }
  if (meses < 12) {
    return meses === 1 ? "1 mes" : `${meses} meses`;
  }
  const anios = Math.floor(meses / 12);
  return anios === 1 ? "1 año" : `${anios} años`;
}

export const SEXO_LABEL: Record<string, string> = { M: "Macho", H: "Hembra", U: "Sin dato" };

export function fechaHoraLabel(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

// ---------------------------------------------------------------------------
// Ficha
// ---------------------------------------------------------------------------

export interface FichaForm {
  motivo: string;
  anamnesis: string;
  examen_fisico: string;
  tratamiento: string;
  observaciones: string;
  peso_kg: string;
  temperatura_c: string;
}

export type FichaErrors = Partial<Record<keyof FichaForm, string>>;

export const CAMPOS_FICHA: (keyof FichaForm)[] = [
  "motivo",
  "anamnesis",
  "examen_fisico",
  "tratamiento",
  "observaciones",
  "peso_kg",
  "temperatura_c",
];

export function fichaDesdeDetalle(detalle: ConsultaDetalle): FichaForm {
  return {
    motivo: detalle.motivo ?? "",
    anamnesis: detalle.anamnesis ?? "",
    examen_fisico: detalle.examen_fisico ?? "",
    tratamiento: detalle.tratamiento ?? "",
    observaciones: detalle.observaciones ?? "",
    peso_kg: detalle.peso_kg !== null ? String(Number(detalle.peso_kg)) : "",
    temperatura_c: detalle.temperatura_c !== null ? String(Number(detalle.temperatura_c)) : "",
  };
}

function numero(valor: string): number | null {
  const limpio = valor.trim().replace(",", ".");
  if (!limpio) {
    return null;
  }
  const n = Number(limpio);
  return Number.isFinite(n) ? n : Number.NaN;
}

export function validarFicha(form: FichaForm): FichaErrors {
  const errors: FichaErrors = {};
  const peso = numero(form.peso_kg);
  if (peso !== null && (Number.isNaN(peso) || peso <= 0 || peso > 150)) {
    errors.peso_kg = "El peso tiene que estar entre 0 y 150 kg.";
  }
  const temperatura = numero(form.temperatura_c);
  if (temperatura !== null && (Number.isNaN(temperatura) || temperatura < 30 || temperatura > 45)) {
    errors.temperatura_c = "La temperatura tiene que estar entre 30 y 45 °C.";
  }
  return errors;
}

/** Solo los campos que cambiaron respecto de lo guardado; vacío = null. */
export function cambiosFicha(form: FichaForm, guardada: FichaForm): ConsultaUpdatePayload {
  const payload: ConsultaUpdatePayload = {};
  for (const campo of CAMPOS_FICHA) {
    if (form[campo].trim() === guardada[campo].trim()) {
      continue;
    }
    const valor = form[campo].trim();
    if (campo === "peso_kg" || campo === "temperatura_c") {
      payload[campo] = valor ? valor.replace(",", ".") : null;
    } else {
      payload[campo] = valor || null;
    }
  }
  return payload;
}

// ---------------------------------------------------------------------------
// Diagnósticos y firma
// ---------------------------------------------------------------------------

export type DecisionSugerencia = "pendiente" | "aceptada" | "descartada";

/** Clave del diagnóstico principal: el id de una patología aceptada o "manual". */
export type ClavePrincipal = number | "manual" | null;

export interface DiagnosticoManual {
  patologia_id: number | null;
  descripcion: string;
}

export function manualCargado(manual: DiagnosticoManual): boolean {
  return manual.patologia_id !== null || manual.descripcion.trim() !== "";
}

export function armarDiagnosticosFirma(
  sugerencias: SugerenciaItem[],
  decisiones: Record<number, DecisionSugerencia>,
  principal: ClavePrincipal,
  manual: DiagnosticoManual,
): { diagnosticos: DiagnosticoFirmaPayload[]; error: string | null } {
  const aceptadas = sugerencias.filter((s) => decisiones[s.patologia_id] === "aceptada");
  const diagnosticos: DiagnosticoFirmaPayload[] = aceptadas.map((s) => ({
    origen: "sugerido_ia",
    tipo_diagnostico: principal === s.patologia_id ? "principal" : "secundario",
    patologia_id: s.patologia_id,
    descripcion_libre: null,
  }));

  if (manualCargado(manual)) {
    if (
      manual.patologia_id !== null &&
      aceptadas.some((s) => s.patologia_id === manual.patologia_id)
    ) {
      return {
        diagnosticos: [],
        error: "El diagnóstico manual repite una sugerencia aceptada.",
      };
    }
    diagnosticos.push({
      origen: "manual",
      tipo_diagnostico: principal === "manual" ? "principal" : "secundario",
      patologia_id: manual.patologia_id,
      descripcion_libre: manual.descripcion.trim() || null,
    });
  }

  if (diagnosticos.length === 0) {
    return {
      diagnosticos,
      error: "Aceptá una sugerencia o cargá un diagnóstico manual para poder firmar.",
    };
  }
  if (diagnosticos.filter((d) => d.tipo_diagnostico === "principal").length !== 1) {
    return { diagnosticos, error: "Marcá cuál es el diagnóstico principal." };
  }
  return { diagnosticos, error: null };
}

export function nombreDiagnostico(
  item: { patologia_nombre: string | null; descripcion_libre: string | null },
): string {
  return item.patologia_nombre ?? item.descripcion_libre ?? "Sin descripción";
}

export function nombrePatologia(patologias: PatologiaOpcion[], id: number | null): string | null {
  if (id === null) {
    return null;
  }
  return patologias.find((p) => p.id === id)?.nombre ?? null;
}

// ---------------------------------------------------------------------------
// Errores
// ---------------------------------------------------------------------------

const MENSAJES_ERROR: Record<string, string> = {
  CONSULTA_FIRMADA: "La consulta ya está firmada y es de solo lectura.",
  CONSULTA_NO_ENCONTRADA: "La consulta no existe.",
  TURNO_NO_ATENDIBLE: "Ese turno ya no se puede atender.",
  TURNO_OTRA_MASCOTA: "El turno corresponde a otra mascota.",
  SUGERENCIA_NO_VIGENTE:
    "Las sugerencias cambiaron. Actualizá el panel y volvé a elegir antes de firmar.",
  SIGNO_DUPLICADO: "Ese signo ya está cargado en la consulta.",
  DIAGNOSTICO_DUPLICADO: "La misma patología está cargada dos veces.",
  PERMISOS_INSUFICIENTES: "No tenés permiso para hacer esto.",
};

export function mensajeError(error: unknown, fallback = "Ocurrió un error. Intentá de nuevo."): string {
  const body = (error as { body?: unknown })?.body;
  if (body && typeof body === "object" && "error" in body) {
    const codigo = (body as { error: unknown }).error;
    if (typeof codigo === "string" && MENSAJES_ERROR[codigo]) {
      return MENSAJES_ERROR[codigo];
    }
  }
  if ((error as { status?: number })?.status === 422) {
    return "Hay datos inválidos. Revisá los campos marcados.";
  }
  const mensaje = (error as Error)?.message;
  return mensaje || fallback;
}
