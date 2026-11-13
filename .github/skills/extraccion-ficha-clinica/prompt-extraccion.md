# Principios del prompt de extracción

El prompt real vive en el código del NLP y se versiona: cada cambio sube `version_prompt`,
que queda guardado en cada fila de `clinica.dictado`. Así se pueden comparar dictados
procesados con versiones distintas. Por eso no va en `sys.config`: cambiarlo cambia el
comportamiento y tiene que pasar por PR y tests.

Cualquier versión del prompt tiene que respetar esto:

1. Usar solo lo que está en la transcripción. Lo que no se dictó va `null`. Nunca completar
   con valores típicos.
2. Mapear cada signo a un código del catálogo de signos que se le pasa en el prompt (el de
   `catalogo_signos.csv`, con sus formas en rioplatense). Si no encaja en ninguno, devolverlo
   con código `null` y el texto original.
3. Distinguir un signo negado ("no tose", "nunca se desmayó") de uno no mencionado. El negado
   va con `presente: false`; el no mencionado no aparece.
4. Normalizar peso a kg y temperatura a °C con punto decimal. Si el valor es imposible (fuera
   de 0–150 kg o de 30–45 °C), dejarlo `null` y conservar la frase en `examen_fisico`.
5. No sugerir diagnósticos: eso es del motor, y la decisión es del veterinario.
6. Responder solo con el JSON del contrato, sin texto antes ni después.

Notas de implementación:

- Si la SDK de Anthropic lo permite, usar salida estructurada con el JSON Schema generado
  desde el modelo Pydantic (`FichaDictado.model_json_schema()`), en vez de confiar solo en el
  texto del prompt.
- Temperatura baja: es extracción, no redacción.
- El extractor por reglas usa el mismo catálogo y devuelve el mismo contrato. Así el resto
  del backend no necesita saber cuál de los dos armó la ficha.
