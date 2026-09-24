export interface SelectTypeaheadOption {
  value: string;
  label: string;
}

export interface SelectTypeaheadBuffer {
  text: string;
  timer: ReturnType<typeof setTimeout> | null;
}

export function normalizeTypeaheadText(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
}

export function findTypeaheadMatch(
  options: SelectTypeaheadOption[],
  buffer: string,
  currentValue: string,
): SelectTypeaheadOption | null {
  const needle = normalizeTypeaheadText(buffer);
  if (!needle) {
    return null;
  }

  const matches = options.filter((option) =>
    normalizeTypeaheadText(option.label).startsWith(needle),
  );
  if (matches.length === 0) {
    return null;
  }

  // Preferir opciones reales sobre el placeholder vacío ("Todas…", "Seleccionar…").
  const ranked =
    matches.some((option) => option.value !== "")
      ? matches.filter((option) => option.value !== "")
      : matches;

  // Misma letra repetida: ciclar entre coincidencias (comportamiento tipo select nativo).
  if (needle.length === 1) {
    const currentIndex = ranked.findIndex((option) => option.value === currentValue);
    if (currentIndex >= 0) {
      return ranked[(currentIndex + 1) % ranked.length] ?? null;
    }
  }

  return ranked[0] ?? null;
}

function isSameLetterRepeat(text: string, char: string): boolean {
  if (text.length === 0) {
    return false;
  }
  const normalizedChar = normalizeTypeaheadText(char);
  return [...text].every((item) => normalizeTypeaheadText(item) === normalizedChar);
}

export function appendTypeaheadChar(
  buffer: SelectTypeaheadBuffer,
  char: string,
  resetMs = 700,
): string {
  // "l" + "l" se trata como la misma letra (para ciclar), no como buffer "ll".
  if (isSameLetterRepeat(buffer.text, char)) {
    buffer.text = char;
  } else {
    buffer.text += char;
  }

  if (buffer.timer !== null) {
    clearTimeout(buffer.timer);
  }
  buffer.timer = setTimeout(() => {
    buffer.text = "";
    buffer.timer = null;
  }, resetMs);

  return buffer.text;
}

export function resetTypeaheadBuffer(buffer: SelectTypeaheadBuffer): void {
  if (buffer.timer !== null) {
    clearTimeout(buffer.timer);
  }
  buffer.text = "";
  buffer.timer = null;
}

export function isTypeaheadChar(key: string): boolean {
  return key.length === 1 && /[\p{L}\p{N}]/u.test(key);
}
