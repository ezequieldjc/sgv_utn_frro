# Formato de la ficha clínica (borrador)

Propuesta inicial para acordar con el equipo. Los nombres siguen las convenciones del
proyecto: snake_case, en español y sin inventar equivalentes de campos que ya existen (por
ejemplo, el peso se guarda en `historial_peso.peso_kg`).

## Campos

| Campo | Tipo | Unidad / formato | Notas |
|-------|------|------------------|-------|
| `motivo_consulta` | `str \| null` | texto libre | Por qué viene el paciente, en palabras del veterinario. |
| `anamnesis` | `str \| null` | texto libre | Lo que cuenta el tutor: síntomas, desde cuándo, cambios de conducta. |
| `examen_fisico.peso_kg` | `Decimal \| null` | kg, 2 decimales, > 0 y < 150 | Si se dicta, después se registra en `historial_peso`. |
| `examen_fisico.temperatura_c` | `Decimal \| null` | °C, 1 decimal, entre 30 y 45 | |
| `examen_fisico.frecuencia_cardiaca_lpm` | `int \| null` | latidos por minuto | |
| `examen_fisico.frecuencia_respiratoria_rpm` | `int \| null` | respiraciones por minuto | |
| `examen_fisico.mucosas` | `str \| null` | texto corto | Ej.: "rosadas", "pálidas". |
| `examen_fisico.tiempo_llenado_capilar_s` | `Decimal \| null` | segundos | |
| `examen_fisico.condicion_corporal` | `int \| null` | escala 1 a 9 | |
| `examen_fisico.hidratacion` | `str \| null` | texto corto | Ej.: "normal", "deshidratación leve". |
| `hallazgos` | `dict[str, str]` | sistema → descripción | Lo variable va acá (JSONB). Ej.: `{"piel": "eritema en región inguinal"}`. |
| `diagnostico_presuntivo` | `list[str]` | | Solo lo que dictó el veterinario. |
| `tratamiento` | `list[Indicacion]` | ver abajo | |
| `estudios_solicitados` | `list[str]` | | Ej.: "hemograma completo", "ecografía abdominal". |
| `proximo_control_dias` | `int \| null` | días desde hoy | "Control en una semana" → `7`. |
| `observaciones` | `str \| null` | texto libre | Lo que no encaja en otro campo. |
| `campos_inciertos` | `list[CampoIncierto]` | ver abajo | Lo que el veterinario tiene que revisar sí o sí. |

### `Indicacion`

| Campo | Tipo | Notas |
|-------|------|-------|
| `medicamento` | `str` | Nombre tal como se dictó. |
| `dosis` | `str \| null` | Con su unidad, tal como se dictó. Ej.: "0,1 mg/kg". |
| `via` | `str \| null` | Ej.: "oral", "subcutánea". |
| `frecuencia` | `str \| null` | Ej.: "cada 24 horas". |
| `duracion_dias` | `int \| null` | |

La dosis queda como texto a propósito: la extracción no calcula ni corrige dosis.

### `CampoIncierto`

| Campo | Tipo | Notas |
|-------|------|-------|
| `campo` | `str` | Ruta del campo, ej. `examen_fisico.temperatura_c` o `tratamiento[0].medicamento`. |
| `motivo` | `str` | Por qué hay que revisarlo, en español y breve. |

## Dónde vive cada cosa (propuesta)

- El schema Pydantic: `backend/app/schemas/dictado.py` (`FichaClinica`, `Indicacion`,
  `CampoIncierto`), con `Decimal` para los decimales, nunca `float`.
- La persistencia depende de la estructura que defina el DBA para la historia clínica. Lo
  esperable es una consulta con columnas fijas para los campos estables y una columna JSONB
  para `hallazgos`.
