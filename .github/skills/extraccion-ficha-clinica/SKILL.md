---
name: extraccion-ficha-clinica
description: Cómo el NLP convierte un dictado veterinario (perros) en la ficha del contrato 1.0 y cómo el backend la guarda en clinica.consulta, clinica.dictado y clinica.consulta_sintoma. Usar al trabajar en el módulo de dictado por voz, en el schema de la ficha, en el guardado de signos o en sus tests.
---

# Extracción de la ficha clínica desde un dictado

El diseño acordado por el equipo está en `docs/flujo_de_los_datos.md`. Esta skill resume la
parte del NLP y la convierte en reglas para programar y testear. Si algo de acá contradice
ese documento, manda el documento.

> **Pendiente:** las claves exactas del JSON salen del contrato 1.0 del prototipo del NLP
> (carpeta `yacanvet_ia`, fuera de este repo). [contrato-ficha.md](./contrato-ficha.md)
> tiene la estructura según el documento de flujo, con claves provisorias. Cuando el
> prototipo entre al repo, reemplazá esa sección por el contrato real.

## Recursos

- [contrato-ficha.md](./contrato-ficha.md): qué trae la ficha y a qué tabla y columna va
  cada parte.
- [prompt-extraccion.md](./prompt-extraccion.md): principios del prompt de extracción.
- [ejemplos.md](./ejemplos.md): dictados de ejemplo con la ficha esperada, para tests.

## El recorrido de un dictado

1. Hay una consulta en `borrador` (se abrió desde el turno). El dictado siempre pertenece a
   una consulta: la mascota y el veterinario salen de ella, nunca del audio.
2. Whisper.cpp transcribe los tramos de audio. **Si la transcripción falla, no se guarda
   nada**: el error vuelve a la pantalla y el veterinario repite. El audio nunca se guarda.
3. El extractor arma la ficha. Primero intenta con Claude; si Claude falla, sigue con el
   extractor por reglas y `modelo_llm` queda nulo.
4. El backend guarda, en una transacción:
   - `INSERT` en `clinica.dictado`, con la transcripción, la ficha entera en
     `extraccion_json` y los metadatos (`modelo_stt`, `modelo_llm`, `version_prompt`,
     duración y latencias). Esa fila **nunca se edita**.
   - `UPDATE` de los textos, el peso y la temperatura de `clinica.consulta`.
   - `INSERT` o `UPDATE` en `clinica.consulta_sintoma`, una fila por signo, con
     `origen = 'nlp'`, `dictado_id` y `confirmado = false`.
5. Después, el backend le pide el top 3 al motor. Eso no es parte del NLP.

## Reglas de extracción

1. **Nunca inventar.** Lo que no se dictó va nulo. Una ficha incompleta es correcta.
2. **Signos con código del catálogo.** Cada signo se mapea a un `codigo` de
   `catalogo_signos.csv` (97 códigos, con las formas de decirlos en rioplatense). Los módulos
   se pasan códigos, nunca ids.
3. **Negado no es lo mismo que no mencionado.** "No vomita" genera una fila con
   `presente = false`. Un signo que no se nombró no genera fila. El motor usa las dos cosas
   distinto, así que confundirlas cambia el diagnóstico.
4. **Lo que no se puede mapear se guarda igual**, con código nulo y el `texto_original`, para
   que el veterinario lo resuelva antes de firmar.
5. **Peso y temperatura dentro de rango** (peso mayor a 0 y hasta 150 kg, temperatura entre
   30 y 45 °C). Un valor imposible, típico de un error de transcripción ("380 grados"), va
   nulo y la frase queda en el texto del examen físico. El backend vuelve a validar con
   Pydantic antes del `UPDATE`, porque la base lo rechazaría.
6. **El NLP no diagnostica.** Las sugerencias son del motor y la decisión es del veterinario.
7. **Un dictado nunca pisa lo que el veterinario ya revisó.** Un signo con
   `confirmado = true` no se toca.

## Decisiones que el documento todavía no cierra

- Qué pasa con los textos cuando hay un segundo dictado: ¿se reemplazan o se agregan al
  final? ¿Y si el veterinario ya los había corregido a mano?
- Si un segundo dictado contradice a uno anterior no confirmado ("vomita" y después "no
  vomita"), lo esperable es que se actualice `presente` en la fila existente. Confirmarlo.

Hasta que el equipo lo decida, no lo implementes por tu cuenta: preguntá.

## Cómo se testea

- Los casos de [ejemplos.md](./ejemplos.md) se convierten en tests parametrizados. La llamada
  a Claude y a Whisper.cpp **siempre** se mockea: lo que se testea es el código propio
  (mapeo de códigos, rangos, guardado y reglas de actualización).
- Casos obligatorios: dictado completo; signo negado (fila con `presente = false`); signo no
  mapeable (código nulo); valor fuera de rango (va nulo); Claude falla (se usa el extractor
  por reglas y `modelo_llm` queda nulo); Whisper falla (no se guarda nada); dictado posterior
  sobre un signo confirmado (no se pisa).
