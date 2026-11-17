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
- **17/11:**
  - `006` aplicado en Neon.
  - La rama se mergeó con el PR #28, pero a `main` en lugar de `staging`.
  - Datos de demo cargados desde la app: la veterinaria Valeria Sosa (`vsosa`), Martín Rossi con
    Coco, Carla Gómez con Thor y Mora, y turnos del 17/11.
  - La consulta de Coco quedó firmada.
- **Rama `feature/prototipo-ajustes`:**
  - El motor contempla "otra causa no contemplada" (`simulado-0.2`) y avisa cuando la evidencia
    no alcanza.
  - Los 10 casos de `docs/casos_prueba_dictado.md` corren como tests.
  - La sesión se renueva sola con el refresh token (`POST /api/auth/refresh`). Antes vencía a
    los 15 minutos, aunque se estuviera usando.

## Qué falta, en orden

1. **Volver a alinear `staging` con `main`**: abrir un PR de `main` a `staging` y mergearlo.
   Después, mergear `feature/prototipo-ajustes` a `staging`. Ese PR tiene que revisarlo otro
   integrante y pasar el CI.
2. **Turnos para el día de la presentación**: uno confirmado para cada caso del guion, el mismo
   día. La consulta toma la fecha y hora en que se inicia.
3. **Ensayar la demo completa contra Neon** al menos una vez, con el usuario veterinario. El
   turno de Luna del 17/11 quedó libre para eso.
4. **Ajustes de contenido (opcional):** revisar las frecuencias de `BASE_CONOCIMIENTO`
   (`backend/app/services/motor_simulado.py`) y los textos de `DICTADOS_DEMO`
   (`frontend/src/lib/consultas.ts`). Si se cambia un código, cambiarlo también en el script 006.

## Guion de la demo (3 casos)

| Caso | Paciente | Qué se dicta | Qué tiene que pasar |
|------|----------|--------------|---------------------|
| 1 | Coco, Bulldog Francés (ya existe, con una consulta firmada del 16/11) | Ronquidos, se cansa al caminar, regurgita, tos, **nunca se desmayó**, 13,2 kg, 38,9 °C | 7 signos, con el síncope **negado**; primera sugerencia: síndrome braquicefálico (predisposición de raza ×4). Se acepta como principal y se firma. |
| 2 | Luna, Cocker Spaniel Inglés (ya existe) | Sacude la cabeza, se rasca las orejas, secreción marrón, **no tiene fiebre** | Primera sugerencia: otitis externa. Mostrar «¿Por qué?» y una corrección a mano de un signo. |
| 3 | Thor, Labrador Retriever (ya existe) | Renguea, le cuesta levantarse, dolor de cadera | Primera sugerencia: displasia de cadera. Firmar con un diagnóstico manual secundario. |

Al final, abrir la historia clínica de una de las mascotas y mostrar la consulta firmada en solo
lectura, con sus signos, sus diagnósticos y el dictado original.

## Qué decir de lo simulado

Lo simulado son los dos extremos que dependen de servicios o datos externos: la transcripción
(whisper.cpp) y la base de conocimiento curada. Todo lo demás es el diseño definitivo:

- el contrato de la ficha;
- los códigos compartidos entre módulos;
- la fórmula del motor, que es determinística y explica cada factor;
- el motor reconoce cuándo los signos no alcanzan: suma una "otra causa no contemplada" y avisa
  **Evidencia insuficiente** (es el caso 10 de `docs/casos_prueba_dictado.md`, y conviene
  mostrarlo a propósito);
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
