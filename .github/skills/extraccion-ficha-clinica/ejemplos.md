# Casos de ejemplo

Datos ficticios para tests, no indicaciones clínicas. Las transcripciones imitan la salida de
Whisper: sin mayúsculas ni puntuación y con números en letras. Las claves del JSON son
provisorias (ver [contrato-ficha.md](./contrato-ficha.md)).

Los códigos de signos usados en el caso 1 son los que aparecen en `docs/flujo_de_los_datos.md`.
Antes de usar otro código en un test, verificá que exista en `catalogo_signos.csv`.

## Caso 1: dictado completo, con un signo negado (Coco, bulldog francés)

Transcripción:

```text
coco viene porque ronca mucho y se cansa enseguida cuando sale a caminar la dueña cuenta
que a veces devuelve la comida sin esfuerzo después de comer y que tose de noche nunca se
desmayó peso trece coma dos kilos temperatura treinta y ocho con nueve respira con
dificultad y las mucosas se ponen azuladas cuando se agita se ausculta un soplo leve indico
reposo y evitar el calor control en diez días
```

Ficha esperada:

```json
{
  "version": "1.0",
  "motivo": "Ronca mucho y se cansa enseguida al caminar",
  "anamnesis": "A veces devuelve la comida sin esfuerzo después de comer. Tose de noche. Nunca se desmayó.",
  "examen_fisico": "Respira con dificultad. Mucosas azuladas al agitarse. Soplo leve a la auscultación.",
  "peso_kg": 13.2,
  "temperatura_c": 38.9,
  "tratamiento": "Reposo y evitar el calor. Control en diez días.",
  "observaciones": null,
  "signos": [
    {"codigo": "estertor_ronquido", "texto_original": "ronca mucho", "presente": true},
    {"codigo": "intolerancia_ejercicio", "texto_original": "se cansa enseguida cuando sale a caminar", "presente": true},
    {"codigo": "regurgitacion", "texto_original": "devuelve la comida sin esfuerzo después de comer", "presente": true},
    {"codigo": "tos", "texto_original": "tose de noche", "presente": true},
    {"codigo": "sincope", "texto_original": "nunca se desmayó", "presente": false},
    {"codigo": "disnea", "texto_original": "respira con dificultad", "presente": true},
    {"codigo": "cianosis", "texto_original": "las mucosas se ponen azuladas cuando se agita", "presente": true},
    {"codigo": "soplo_cardiaco", "texto_original": "se ausculta un soplo leve", "presente": true}
  ]
}
```

Qué se testea: ocho filas en `consulta_sintoma`, con `sincope` en `presente = false`; peso y
temperatura en `consulta`; una fila en `dictado` con la ficha entera.

## Caso 2: un signo que no se puede mapear

Para el test se supone que "se chupa las patas" no tiene código en el catálogo.

Transcripción:

```text
viene porque tose desde hace una semana y se chupa las patas todo el tiempo
```

Ficha esperada:

```json
{
  "version": "1.0",
  "motivo": "Tos desde hace una semana",
  "anamnesis": "Se chupa las patas todo el tiempo.",
  "examen_fisico": null,
  "peso_kg": null,
  "temperatura_c": null,
  "tratamiento": null,
  "observaciones": null,
  "signos": [
    {"codigo": "tos", "texto_original": "tose desde hace una semana", "presente": true},
    {"codigo": null, "texto_original": "se chupa las patas todo el tiempo", "presente": true}
  ]
}
```

Qué se testea: la fila sin código se guarda con `sintoma_id` nulo y el texto original, y la
vista del motor no la usa.

## Caso 3: dictado mínimo

Transcripción:

```text
control está todo bien pesa doce kilos
```

Ficha esperada:

```json
{
  "version": "1.0",
  "motivo": "Control",
  "anamnesis": null,
  "examen_fisico": "Sin hallazgos según el veterinario.",
  "peso_kg": 12.0,
  "temperatura_c": null,
  "tratamiento": null,
  "observaciones": null,
  "signos": []
}
```

Qué se testea: ninguna fila en `consulta_sintoma`, y la consulta se actualiza igual.

## Caso 4: valor fuera de rango

Transcripción:

```text
temperatura trescientos ochenta grados tose
```

Ficha esperada:

```json
{
  "version": "1.0",
  "motivo": null,
  "anamnesis": null,
  "examen_fisico": "Temperatura dictada: trescientos ochenta grados (fuera de rango).",
  "peso_kg": null,
  "temperatura_c": null,
  "tratamiento": null,
  "observaciones": null,
  "signos": [
    {"codigo": "tos", "texto_original": "tose", "presente": true}
  ]
}
```

Qué se testea: `temperatura_c` queda nula y la frase se conserva en el texto. Si el extractor
devolviera 380, la validación Pydantic del backend lo tiene que frenar antes del `UPDATE`.

## Caso 5: falla Claude

El mock de Claude lanza una excepción (o devuelve un JSON que no valida). Resultado esperado:
el NLP usa el extractor por reglas, la ficha cumple el mismo contrato y la fila de `dictado`
queda con `modelo_llm` nulo.

## Caso 6: falla Whisper

El mock de Whisper.cpp lanza una excepción. Resultado esperado: no se inserta nada en
`dictado`, `consulta` ni `consulta_sintoma`, y la API devuelve un `APIError` con código
estable y detalle en español para que el veterinario repita el dictado.

## Caso 7: un dictado posterior no pisa lo confirmado

Partiendo del caso 1 con la fila de `tos` en `confirmado = true`, llega un dictado que dice
"no tose". Resultado esperado: la fila de `tos` no cambia.
