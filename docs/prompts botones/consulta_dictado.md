# Consulta con dictado y apoyo al diagnóstico — `/consultas/:id`

Spec de la pantalla de consulta del prototipo (Figura 13 de la 3ra entrega) y de su API. El
diseño de datos está en `docs/flujo_de_los_datos.md` y `docs/modelo_datos_v2.md`.

## Objetivo

El veterinario abre la consulta desde el turno, dicta (o escribe) lo que observa, el sistema arma
la ficha y los signos, sugiere el top 3 de diagnósticos con su explicación, y el veterinario
corrige, acepta o descarta y firma. La consulta firmada queda en la historia clínica en solo
lectura.

**En el prototipo el NLP y el motor están simulados**, sin servicios externos:

- La grabación se simula en pantalla. Al detenerla se carga el dictado de demostración de la raza
  del paciente (`DICTADOS_DEMO` en `frontend/src/lib/consultas.ts`), que el veterinario puede
  editar o reemplazar por texto propio.
- La ficha la arma el **extractor por reglas** (`backend/app/services/nlp_simulado.py`): textos,
  peso, temperatura y signos con código, distinguiendo negados. Queda en `clinica.dictado` con
  `modelo_stt = 'texto'`, `modelo_llm = NULL` y `version_prompt = 'reglas-0.1'`.
- Las sugerencias las calcula `backend/app/services/motor_simulado.py` con la fórmula del
  documento de flujo (prevalencia × raza × frecuencias de signos presentes × complemento de los
  negados, normalizado). Lo simulado es la base de conocimiento: las frecuencias y
  predisposiciones de las 5 patologías están en el código (`BASE_CONOCIMIENTO`); la prevalencia
  sale de `clinica.patologia`. `version_motor = 'simulado-0.1'`.

## Datos que necesita

`scripts/clinica/006_datos_prototipo.sql`: permisos de consultas para VETERINARIO, códigos de las
razas del prototipo, 20 signos y 5 patologías. Los códigos tienen que coincidir con los de
`nlp_simulado.py` y `motor_simulado.py`.

## Permisos

| Acción | Permiso |
|--------|---------|
| Abrir consulta, dictar, corregir ficha y signos, descartar borrador | `consultas:crear` o `consultas:editar_historia_clinica` |
| Ver una consulta y sus sugerencias | `consultas:crear`, `consultas:ver_historia_clinica` o `consultas:ver_historial` |
| Firmar | `consultas:firmar` |
| Historial / historia clínica | `consultas:ver_historial` o `consultas:ver_historia_clinica` |

## Frontend

- `/consultas/:id` → `ConsultaPage`: dictado, ficha editable, signos (presente / negado / quitar /
  agregar a mano / asignar código), panel de sugerencias con aceptar, descartar, principal y
  explicación ("¿Por qué?"), diagnóstico manual opcional y barra con Descartar, Guardar borrador y
  Firmar. Firmada → todo en solo lectura con los diagnósticos guardados.
- Agenda → detalle del turno → **Iniciar consulta** (turno `solicitado` o `confirmado`): crea el
  borrador o retoma el existente.
- `/consultas/nueva`: buscar paciente y abrir una consulta sin turno.
- `/consultas/historial` y `/consultas/historia-clinica`: listado; con `?mascota_id=` es la
  historia clínica de la mascota (por defecto solo firmadas). Los controles llevan la etiqueta
  **Control**.
- **Controles.** Arriba de la consulta, la tarjeta de la consulta anterior muestra el diagnóstico,
  el motivo, el tratamiento indicado y la **evolución de los signos**: Persiste, Resuelto, Nuevo o
  Sin registrar. En el borrador se puede vincular, cambiar o quitar la consulta anterior, y cargar
  su diagnóstico principal como diagnóstico manual. En una consulta firmada, la tarjeta
  **Controles** lista los controles y tiene **Programar control**, que abre el alta de turno
  precargada: misma mascota, mismo profesional, tipo Control y la fecha que surge del texto
  ("control en diez días"). El botón solo se muestra con `agenda:crear_turno`.
- "Emitir receta" no está en el prototipo.

## API — `/api/consultas`

| Método y ruta | Qué hace |
|---------------|----------|
| `POST /api/consultas` `{mascota_id, turno_id?, consulta_padre_id?}` | Abre un borrador (201). Si el turno ya tiene consulta, devuelve esa (200). |
| `GET /api/consultas/{id}` | `ConsultaDetalle`: ficha, mascota, signos, diagnósticos, dictados, `consulta_padre` (la anterior, si es control) y `controles`. |
| `PATCH /api/consultas/{id}` | Actualiza solo los campos enviados de la ficha. `consulta_padre_id: null` desvincula la anterior. |
| `DELETE /api/consultas/{id}` | Descarta un borrador con sus dictados y signos (204). |
| `POST /api/consultas/{id}/dictados` `{texto, duracion_audio_s?}` | Procesa un dictado y devuelve la consulta actualizada. |
| `POST /api/consultas/{id}/signos` `{sintoma_id, presente}` | Agrega un signo a mano (queda revisado). |
| `PATCH /api/consultas/{id}/signos/{signo_id}` `{presente?, sintoma_id?}` | Corrige un signo (queda revisado). |
| `DELETE /api/consultas/{id}/signos/{signo_id}` | Quita un signo. |
| `GET /api/consultas/{id}/sugerencias` | Top 3 con porcentaje, explicación y estudio sugerido. No guarda nada. |
| `POST /api/consultas/{id}/firmar` `{diagnosticos: [...]}` | Firma (ver reglas). |
| `GET /api/consultas?mascota_id=&estado=` | Historial (cada ítem trae `consulta_padre_id`). |
| `GET /api/consultas/mascotas?q=` | Buscador de pacientes para abrir sin turno. |
| `GET /api/consultas/catalogos/sintomas` y `/catalogos/patologias` | Catálogos activos. |

Cada diagnóstico de la firma: `{origen: "sugerido_ia" | "manual", tipo_diagnostico: "principal" |
"secundario", patologia_id?, descripcion_libre?}`. Exactamente un principal.

### Errores

| Status | Código | Cuándo |
|--------|--------|--------|
| 400 | `TURNO_OTRA_MASCOTA` | El turno es de otra mascota. |
| 400 | `DIAGNOSTICO_DUPLICADO` | La misma patología dos veces en la firma. |
| 400 | `CONSULTA_ANTERIOR_OTRA_MASCOTA` | La consulta anterior es de otra mascota. |
| 400 | `CONSULTA_ANTERIOR_POSTERIOR` | La consulta anterior es más nueva que esta. |
| 404 | `CONSULTA_ANTERIOR_NO_ENCONTRADA` | La consulta anterior no existe. |
| 409 | `CONSULTA_ANTERIOR_NO_FIRMADA` | La consulta anterior todavía es un borrador. |
| 404 | `CONSULTA_NO_ENCONTRADA`, `MASCOTA_NO_ENCONTRADA`, `TURNO_NO_ENCONTRADO`, `SINTOMA_NO_ENCONTRADO`, `SIGNO_NO_ENCONTRADO`, `PATOLOGIA_NO_ENCONTRADA` | — |
| 409 | `TURNO_NO_ATENDIBLE` | El turno está cancelado, no asistió o ya fue atendido. |
| 409 | `CONSULTA_FIRMADA` | Se intenta modificar o descartar una consulta firmada. |
| 409 | `SUGERENCIA_NO_VIGENTE` | Se firma una sugerencia que ya no está en el top 3. |
| 409 | `SIGNO_DUPLICADO` | Se asigna a un signo un código que ya está en la consulta. |
| 422 | — | Peso fuera de 0–150, temperatura fuera de 30–45, firma sin un único principal. |

## Backend — reglas

1. La consulta nace en `borrador` con `veterinario_id` = usuario logueado y `fecha_hora` = ahora.
2. Un dictado agrega texto al final de cada campo (no borra lo anterior); peso y temperatura
   dictados reemplazan a los anteriores. Valores fuera de rango quedan nulos.
3. Un dictado **nunca pisa un signo revisado** (`confirmado = true`). Corregir o agregar un signo a
   mano lo marca revisado.
4. La firma, en una transacción: guarda los diagnósticos aceptados (`confirmado_por_usuario_id` =
   usuario logueado; en los `sugerido_ia`, ranking, porcentaje, explicación y versión los recalcula
   el backend), marca todos los signos revisados, pasa la consulta a `firmada` con `fecha_firma`,
   pasa el turno a `atendido` y actualiza `mascota.ultimo_peso` si se dictó peso.
5. Una consulta firmada no se modifica ni se borra (409).
6. **Controles** (`consulta.consulta_padre_id`, sin DDL: la columna ya estaba en Neon):
   - La consulta anterior tiene que ser de la misma mascota, estar firmada y ser previa.
   - Si la consulta se abre desde un turno cuyo tipo se llama "Control" (sin mayúsculas ni
     tildes), se vincula sola a la última firmada de la mascota. Si se renombra el tipo, el
     vínculo automático deja de funcionar, pero el manual sigue andando. Cuando exista
     `tipo_turno.codigo`, conviene comparar por código.
   - Como la anterior está firmada y una firmada no cambia, la cadena de controles nunca forma
     un ciclo.

## Tests

Backend: `backend/tests/test_consultas.py` (recorrido completo, permisos, reglas de firma,
extractor y motor). Frontend: `frontend/src/lib/consultas.test.ts`.
