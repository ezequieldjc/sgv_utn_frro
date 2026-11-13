# Casos de ejemplo

Datos ficticios para tests y para ajustar el prompt. No son indicaciones clínicas. Las
transcripciones imitan la salida de Whisper: sin mayúsculas, con números a veces en letras y
algún error de reconocimiento.

## Caso 1: dictado completo

Transcripción:

```text
paciente macho de cuatro años viene por vómitos desde hace dos días la dueña cuenta que
comió basura del patio y que está decaído peso veintiocho coma cuatro kilos temperatura
treinta y nueve con dos frecuencia cardíaca ciento diez respiratoria veinticuatro mucosas
rosadas llenado capilar menos de dos segundos condición corporal cinco de nueve
deshidratación leve abdomen con dolor a la palpación craneal sin masas palpables
diagnóstico presuntivo gastroenteritis por indiscreción alimentaria indico dieta blanda por
tres días y maropitant uno miligramo por kilo subcutáneo cada veinticuatro horas por dos días
control en tres días
```

Ficha esperada:

```json
{
  "motivo_consulta": "Vómitos desde hace dos días",
  "anamnesis": "Comió basura del patio. Decaído según la tutora.",
  "examen_fisico": {
    "peso_kg": 28.4,
    "temperatura_c": 39.2,
    "frecuencia_cardiaca_lpm": 110,
    "frecuencia_respiratoria_rpm": 24,
    "mucosas": "rosadas",
    "tiempo_llenado_capilar_s": null,
    "condicion_corporal": 5,
    "hidratacion": "deshidratación leve"
  },
  "hallazgos": {
    "abdomen": "dolor a la palpación craneal, sin masas palpables"
  },
  "diagnostico_presuntivo": ["Gastroenteritis por indiscreción alimentaria"],
  "tratamiento": [
    {
      "medicamento": "maropitant",
      "dosis": "1 mg/kg",
      "via": "subcutánea",
      "frecuencia": "cada 24 horas",
      "duracion_dias": 2
    }
  ],
  "estudios_solicitados": [],
  "proximo_control_dias": 3,
  "observaciones": "Dieta blanda por tres días.",
  "campos_inciertos": [
    {
      "campo": "examen_fisico.tiempo_llenado_capilar_s",
      "motivo": "Se dictó 'menos de dos segundos', sin un valor exacto."
    }
  ]
}
```

## Caso 2: dictado mínimo

Transcripción:

```text
control de vacunas está todo bien peso doce kilos
```

Ficha esperada:

```json
{
  "motivo_consulta": "Control de vacunas",
  "anamnesis": null,
  "examen_fisico": {
    "peso_kg": 12.0,
    "temperatura_c": null,
    "frecuencia_cardiaca_lpm": null,
    "frecuencia_respiratoria_rpm": null,
    "mucosas": null,
    "tiempo_llenado_capilar_s": null,
    "condicion_corporal": null,
    "hidratacion": null
  },
  "hallazgos": {},
  "diagnostico_presuntivo": [],
  "tratamiento": [],
  "estudios_solicitados": [],
  "proximo_control_dias": null,
  "observaciones": "Sin hallazgos según el veterinario.",
  "campos_inciertos": []
}
```

## Caso 3: datos dudosos

Transcripción:

```text
viene por picazón hace un mes se rasca las orejas temperatura trescientos ochenta y cinco
otitis externa bilateral con secreción marrón le indico limpiador ótico y otomax dos gotas
en cada oído cada doce horas pido citología de oído
```

Ficha esperada:

```json
{
  "motivo_consulta": "Picazón desde hace un mes",
  "anamnesis": "Se rasca las orejas.",
  "examen_fisico": {
    "peso_kg": null,
    "temperatura_c": 38.5,
    "frecuencia_cardiaca_lpm": null,
    "frecuencia_respiratoria_rpm": null,
    "mucosas": null,
    "tiempo_llenado_capilar_s": null,
    "condicion_corporal": null,
    "hidratacion": null
  },
  "hallazgos": {
    "oídos": "otitis externa bilateral con secreción marrón"
  },
  "diagnostico_presuntivo": ["Otitis externa bilateral"],
  "tratamiento": [
    {
      "medicamento": "limpiador ótico",
      "dosis": null,
      "via": "ótica",
      "frecuencia": null,
      "duracion_dias": null
    },
    {
      "medicamento": "otomax",
      "dosis": "2 gotas en cada oído",
      "via": "ótica",
      "frecuencia": "cada 12 horas",
      "duracion_dias": null
    }
  ],
  "estudios_solicitados": ["Citología de oído"],
  "proximo_control_dias": null,
  "observaciones": null,
  "campos_inciertos": [
    {
      "campo": "examen_fisico.temperatura_c",
      "motivo": "Se transcribió 'trescientos ochenta y cinco'; se interpretó como 38,5 °C."
    },
    {
      "campo": "tratamiento[0]",
      "motivo": "No se dictaron dosis, frecuencia ni duración del limpiador ótico."
    }
  ]
}
```

## Caso 4: respuesta inválida de Claude

Sirve para testear el manejo de errores, no la extracción. El mock de Claude devuelve:

```text
Claro, acá tenés la ficha: {"motivo_consulta": "Vómitos", "examen_fisico": {"peso_kg": "mucho"}}
```

Resultado esperado: el service no guarda nada y responde `APIError` con código
`FICHA_INVALIDA` (status 422 o el que acuerde el equipo) y `detalle` en español.
