# La ficha del NLP y dónde se guarda

Estructura según `docs/flujo_de_los_datos.md`. **Las claves del JSON son provisorias**: las
definitivas son las del contrato 1.0 del prototipo del NLP. Lo que no cambia es a qué tabla
y columna va cada parte.

## Qué trae la ficha y dónde va

| Parte de la ficha | Clave provisoria | Destino | Notas |
|-------------------|------------------|---------|-------|
| Versión del contrato | `version` | `dictado.extraccion_json` | `"1.0"`. |
| Motivo de consulta | `motivo` | `consulta.motivo` | Texto. |
| Anamnesis | `anamnesis` | `consulta.anamnesis` | Lo que relata el propietario. |
| Examen físico | `examen_fisico` | `consulta.examen_fisico` | Texto libre: lo que el veterinario observa, palpa o mide. |
| Peso del día | `peso_kg` | `consulta.peso_kg` | `numeric(5,2)`, mayor a 0 y hasta 150. Fuera de rango → `null`. |
| Temperatura del día | `temperatura_c` | `consulta.temperatura_c` | `numeric(4,1)`, entre 30 y 45. Fuera de rango → `null`. |
| Tratamiento | `tratamiento` | `consulta.tratamiento` | Indicaciones, medicación y controles, en texto. |
| Observaciones | `observaciones` | `consulta.observaciones` | Estudios pedidos y otras notas. |
| Signos | `signos[]` | `consulta_sintoma` | Una fila por signo (ver abajo). |
| La ficha entera | (todo el JSON) | `dictado.extraccion_json` | Sin correcciones, aunque partes ya estén en otras tablas. |

Además, por cada dictado el backend guarda en `clinica.dictado`: `transcripcion` (lo que
devolvió Whisper.cpp), `modelo_stt` (por ejemplo `whisper.cpp/small-q5_1`, o `texto` si la
ficha salió de un texto en pruebas), `modelo_llm` (nulo si se usó el extractor por reglas),
`version_prompt`, `duracion_audio_s`, `latencia_stt_ms` y `latencia_llm_ms`.

## Cada signo

| Clave provisoria | Tipo | Destino en `consulta_sintoma` |
|------------------|------|-------------------------------|
| `codigo` | `str \| null` | `sintoma_id`, buscando por `sintoma.codigo`. Nulo si no se pudo mapear. |
| `texto_original` | `str` (hasta 255) | `texto_original`: el fragmento tal como se dictó. |
| `presente` | `bool` | `presente`: `false` si se negó explícitamente. |

El backend completa el resto: `consulta_id`, `dictado_id`, `origen = 'nlp'` y
`confirmado = false`. Solo puede haber una fila por código en cada consulta; las filas sin
código pueden ser varias.

## Schema Pydantic (propuesta)

En `backend/app/schemas/dictado.py`: `FichaDictado` con los campos de arriba y `SignoDictado`
para cada signo. `Decimal` para peso y temperatura, nunca `float`, con los rangos como
validaciones (`gt=0, le=150` y `ge=30, le=45`).
