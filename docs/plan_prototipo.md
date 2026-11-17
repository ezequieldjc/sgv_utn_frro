# Plan para cerrar el prototipo (semana del 16/11/2026)

El objetivo es mostrar de punta a punta el circuito que la 3ra entrega define como aporte
diferencial: el veterinario abre la consulta desde el turno, dicta, el sistema arma la ficha y
sugiere diagnósticos, el veterinario decide y firma, y la consulta queda en la historia clínica.
Por acuerdo del equipo, el NLP y el motor de diagnóstico están **simulados**.

## Dónde estamos

- **Base de datos (Facu, 14/11):** aplicados en Neon `scripts/clinica/001` a `005` y
  `scripts/agenda/002`. Las tablas de la consulta existen y coinciden con los modelos. Están
  vacías `sintoma` y `patologia`, y **ningún rol tiene los permisos `consultas:*`**: sin eso, el
  veterinario no ve el menú de Consultas.
- **Consulta (rama `feature/consulta-prototipo`):** backend y frontend completos. Se puede abrir
  desde el turno, dictar (simulado), corregir ficha y signos, ver el top 3 con su explicación,
  aceptar o descartar, firmar y ver la historia clínica. El detalle está en
  `docs/prompts botones/consulta_dictado.md`. Tests: 247 del backend y 96 del frontend en verde,
  y el recorrido completo probado en el navegador.

## Qué falta, en orden

1. **Aplicar `scripts/clinica/006_datos_prototipo.sql` en Neon**, como DBA. Da los permisos de
   consultas a VETERINARIO, completa los códigos de las razas y carga 20 signos y 5 patologías.
   Sin este paso la pantalla funciona, pero no hay signos ni sugerencias.
2. **Mergear la rama** a `staging` (PR revisado por otro integrante, CI en verde).
3. **Cargar los datos de demostración desde la app**, como lo haría la clínica: los pacientes que
   falten y un turno confirmado para cada caso, el mismo día de la presentación.
4. **Ensayar la demo completa contra Neon** al menos una vez, con el usuario veterinario.
5. **Ajustes de contenido (opcional):** revisar las frecuencias de `BASE_CONOCIMIENTO`
   (`backend/app/services/motor_simulado.py`) y los textos de `DICTADOS_DEMO`
   (`frontend/src/lib/consultas.ts`). Si se cambia un código, cambiarlo también en el script 006.

## Guion de la demo (3 casos)

| Caso | Paciente | Qué se dicta | Qué tiene que pasar |
|------|----------|--------------|---------------------|
| 1 | Coco, Bulldog Francés (crear) | Ronquidos, se cansa al caminar, regurgita, tos, **nunca se desmayó**, 13,2 kg, 38,9 °C | 7 signos, con el síncope **negado**; primera sugerencia: síndrome braquicefálico (predisposición de raza ×4). Se acepta como principal y se firma. |
| 2 | Luna, Cocker Spaniel Inglés (ya existe) | Sacude la cabeza, se rasca las orejas, secreción marrón, **no tiene fiebre** | Primera sugerencia: otitis externa. Mostrar «¿Por qué?» y una corrección a mano de un signo. |
| 3 | Un Labrador Retriever (crear) | Renguea, le cuesta levantarse, dolor de cadera | Primera sugerencia: displasia de cadera. Firmar con un diagnóstico manual secundario. |

Al final, abrir la historia clínica de una de las mascotas y mostrar la consulta firmada en solo
lectura, con sus signos, sus diagnósticos y el dictado original.

## Qué decir de lo simulado

Lo simulado son los dos extremos que dependen de servicios o datos externos: la transcripción
(whisper.cpp) y la base de conocimiento curada. Todo lo demás es el diseño definitivo:

- el contrato de la ficha;
- los códigos compartidos entre módulos;
- la fórmula del motor, que es determinística y explica cada factor;
- las tablas y la firma en una sola transacción.

El dictado se procesa con el extractor por reglas, que el documento de flujo prevé como respaldo
de Claude. Reemplazar las partes simuladas por las reales no cambia la pantalla, la API ni la base.

## Fuera del prototipo (Fase 2)

- Receta electrónica.
- Alergias estructuradas: hoy se muestra la alerta médica de la mascota.
- Estudios complementarios.
- Calendario de vacunas.
- Consumo de stock desde la consulta (`stock.movimiento_stock.consulta_id`).
- La prueba E2E con Playwright que pide el Sprint 8.
- Whisper.cpp y Claude reales.
- La base de conocimiento completa.
