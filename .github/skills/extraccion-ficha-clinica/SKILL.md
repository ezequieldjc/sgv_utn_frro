---
name: extraccion-ficha-clinica
description: Formato de la ficha clínica estructurada, reglas para extraerla de la transcripción de un dictado veterinario con Claude, prompt de extracción y casos de ejemplo para tests. Usar al trabajar en el módulo de dictado por voz, en el schema Pydantic de la ficha o en sus tests.
---

# Extracción de la ficha clínica desde un dictado

Esta skill define cómo convertir la transcripción de un dictado veterinario (perros) en una
ficha clínica estructurada. Se usa para escribir el service de extracción, el schema Pydantic
de la ficha y los tests del módulo.

> **Estado: borrador.** La historia clínica todavía no tiene tablas en Postgres (figura como
> pendiente en `docs/modelo_datos_v1.md`, US-09). El formato de
> [ficha-schema.md](./ficha-schema.md) es una propuesta para acordar con quien desarrolla la
> historia clínica y con el DBA. Cuando exista la estructura real, el schema de la ficha tiene
> que coincidir con ella.

## Recursos

- [ficha-schema.md](./ficha-schema.md): campos de la ficha, tipos, unidades y validaciones.
- [prompt-extraccion.md](./prompt-extraccion.md): el prompt de sistema que se manda a Claude.
- [ejemplos.md](./ejemplos.md): transcripciones de ejemplo con la ficha esperada. Son la base
  de los tests y de los ejemplos del prompt.

## Reglas de extracción (las más importantes)

1. **Nunca inventar.** Si el veterinario no dictó un dato, el campo va `null` o lista vacía.
   Una ficha incompleta es correcta; una ficha con datos inventados es un error grave.
2. **Normalizar unidades** a las del schema (kg, °C, lpm, rpm, segundos) y números con punto
   decimal. "Treinta y ocho y medio de temperatura" → `38.5`.
3. **Marcar la duda.** Todo dato ambiguo, que se contradiga o que la transcripción haya
   entendido mal (por ejemplo, un medicamento que no existe) va en `campos_inciertos`, con el
   campo y el motivo. El frontend los resalta para que el veterinario los revise.
4. **Los hallazgos variables van en `hallazgos`** (JSONB), como pares sistema → descripción,
   no como campos nuevos del schema.
5. **El diagnóstico es presuntivo** y lo dicta el veterinario. La extracción no sugiere
   diagnósticos propios: eso es otro módulo (asistencia diagnóstica).
6. **La identidad de la mascota no se extrae del audio.** El `mascota_id` viene de la pantalla.
   Si el dictado menciona un nombre que no coincide con la mascota elegida, se marca en
   `campos_inciertos`.
7. **Salida solo JSON** que valide contra el schema. El backend valida con Pydantic y, si
   falla, devuelve un `APIError` (`FICHA_INVALIDA`) en vez de guardar.

## Cómo se testea

- Cada caso de [ejemplos.md](./ejemplos.md) se convierte en un test parametrizado: la
  transcripción es la entrada y la llamada a Claude se mockea para devolver la ficha esperada.
  Lo que se testea es el código propio: armado del prompt, validación, normalización y manejo
  de errores.
- Casos obligatorios: dictado completo, dictado mínimo (casi todo `null`), dictado con datos
  dudosos (que llenan `campos_inciertos`) y respuesta inválida de Claude (que termina en
  `FICHA_INVALIDA`).
- Nunca se llama a la API de Claude ni a Whisper.cpp en los tests.
