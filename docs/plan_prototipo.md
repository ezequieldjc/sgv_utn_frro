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
  - Mergeada a `staging` (PR #30).
- **Rama `feature/control-consulta`:** control desde la consulta anterior. Mergeada a `staging`
  (PR #31).
  - Una consulta abierta desde un turno de tipo Control se vincula sola a la última firmada.
  - La consulta muestra la evolución de los signos y permite reusar el diagnóstico anterior.
  - "Programar control" agenda el turno con la fecha que surge del dictado.
  - Para la demo quedó agendado el control de Coco: jueves 26/11 a las 9:00, con Valeria,
    confirmado.
- **Rama `feature/tutor-eventual-estados`:** regla del tutor eventual.
  - Una mascota sin tutor registrado queda "En Tránsito / Rescate" (por defecto) o
    "Extraviado", nunca ACTIVA. Al asignarle un dueño pasa a ACTIVA.
  - Esos estados se atienden igual: la agenda les da turnos, aparecen en el buscador de
    pacientes y en el listado de mascotas por defecto.
  - Los estados permitidos son un parámetro (`ESTADOS_MASCOTA_TUTOR_EVENTUAL`) que crea
    `scripts/clinica/007_tutor_eventual_estados.sql`. Ese script además corrige las mascotas
    que hoy están ACTIVAS con el tutor eventual.
  - Mergeada a `staging` (PR #32). El 007 se aplicó en Neon el 17/11.
- **`scripts/auth/001_portal_y_cuentas_cliente.sql` (aplicado en Neon el 17/11):** `username` a
  100 caracteres, `portal:ver` para CLIENTE, `ventas:ver` para RECEPCIONISTA y
  `agenda:crear_turno` para VETERINARIO.
- **Rama `feature/portal-cliente`:** portal de solo lectura para el cliente (mis mascotas,
  historia clínica con las consultas firmadas, turnos y compras). Cada cliente ve solo lo suyo;
  lo ajeno responde 404. Además pide turnos (desde mañana, quedan solicitados hasta que la
  clínica los confirme) y cancela los que siguen solicitados. Requiere
  `scripts/agenda/003_portal_pedir_turno.sql` (aplicado en Neon el 17/11). Detalle en
  `docs/prompts botones/portal_cliente.md`. Mergeada a `staging` (PR #33).
- **Alta de mascota:** Canina y Felina aparecen primero en el selector de especie.
- **Rama `feature/cuentas-cliente` (18/11):** cuentas de cliente y alta de mascotas desde el
  portal. Detalle en `docs/prompts botones/cuentas_cliente.md`.
  - El mail es el usuario del cliente y todo cliente nace con su usuario CLIENTE, por los tres
    caminos: Clientes → Nuevo cliente, Admin → Usuarios con rol CLIENTE y **Crear cuenta** desde
    el login (el cliente elige su contraseña ahí, sin verificar el mail).
  - El DNI no se repite en ningún alta.
  - El cliente da de alta sus mascotas desde el portal (`portal:crear_mascota`).
  - Requiere `scripts/auth/002_portal_crear_mascota.sql` (solo datos, pendiente de aplicar).
  - Quedó para después: el envío de mails (bienvenida y "Olvidé mi contraseña").
- **Rama `feature/vacunas-recordatorios-receta`:** el punto 5, simulado de forma simple. El
  diseño de lo que falta para la entrega final está en `docs/fase2_diseno.md`.
  - **Receta en PDF** desde la consulta firmada y en **Recetas → Historial de recetas**. Sale de
    las indicaciones (`tratamiento`) y no usa tablas nuevas.
  - **Vacunas y desparasitaciones** por mascota (`/mascotas/:id/vacunas`): aplicar ahora con
    un producto del stock (descuenta un envase y, si se cobra, arma la venta al tutor) o
    registrar una dosis anterior. Cada una con su próxima dosis y el refuerzo vinculado. Desde
    un turno de Vacunación, "Registrar vacuna" lo marca atendido.
  - **Recordatorios por WhatsApp** (**Agenda → Recordatorios**): turnos de mañana y dosis por
    vencer o vencidas, con el mensaje armado y un link `wa.me` que la recepción envía con un
    clic. El envío queda registrado.
  - El Shar Pei suma predisposición a la dermatitis atópica y a la otitis en el motor, y los
    casos 11 y 12 de `docs/casos_prueba_dictado.md` son los de Felipe y Simón.
  - Requiere `scripts/clinica/008_vacunas_recordatorios.sql` (tablas, permisos, parámetros
    PREVENTIVA y el código del Shar Pei; aplicado en Neon el 17/11) y
    `pip install -r requirements.txt` por `reportlab`.
  - Datos de demo: Joaquín Ferreyra (celular de Bruno) con Felipe y Simón, dos Shar Pei. Felipe
    tiene su carnet (la séxtuple de la libreta, que vence el 20/11, y un Bravecto aplicado y
    cobrado el 17/11, venta #3) y un turno de Vacunación el 20/11 a las 9:00. Su consulta no
    está hecha: se dicta en vivo con **Iniciar dictado**. Simón tiene su carnet (un Bravecto
    vencido el 08/11 y la antirrábica del 17/11) y un turno de consulta el 18/11 a las 10:00.
    Los dos turnos son con Valeria Sosa.

## Qué falta, en orden

1. **Pasar `staging` a `main`.** El 007 ya está aplicado en Neon, y el código de `main` todavía
   solo da turnos a mascotas ACTIVAS: hasta el pase, la app publicada no atiende a las mascotas
   del tutor eventual (Lola, Bela, Bestia y Negrito).
2. **Mergear `feature/vacunas-recordatorios-receta` a `staging`.** El 008 ya está aplicado: el
   código anterior no usa nada de ese script, así que no hay apuro de orden.
3. ~~Decidir si VETERINARIO puede agendar turnos~~: resuelto, `agenda:crear_turno` se le asignó
   con `scripts/auth/001_portal_y_cuentas_cliente.sql`.
4. **Turnos para el día de la presentación**: uno confirmado para cada caso del guion, el mismo
   día. La consulta toma la fecha y hora en que se inicia.
5. **Ensayar la demo completa contra Neon** al menos una vez, con el usuario veterinario. El
   turno de Luna del 17/11 quedó libre para eso.
6. **Ajustes de contenido (opcional):** revisar las frecuencias de `BASE_CONOCIMIENTO`
   (`backend/app/services/motor_simulado.py`) y los textos de `DICTADOS_DEMO`
   (`frontend/src/lib/consultas.ts`). Si se cambia un código, cambiarlo también en el script 006.

## Guion de la demo (5 casos)

| Caso | Paciente | Qué se dicta | Qué tiene que pasar |
|------|----------|--------------|---------------------|
| 1 | Coco, Bulldog Francés (ya existe, con una consulta firmada del 16/11) | Ronquidos, se cansa al caminar, regurgita, tos, **nunca se desmayó**, 13,2 kg, 38,9 °C | 7 signos, con el síncope **negado**; primera sugerencia: síndrome braquicefálico (predisposición de raza ×4). Se acepta como principal y se firma. |
| 2 | Luna, Cocker Spaniel Inglés (ya existe) | Sacude la cabeza, se rasca las orejas, secreción marrón, **no tiene fiebre** | Primera sugerencia: otitis externa. Mostrar «¿Por qué?» y una corrección a mano de un signo. |
| 3 | Thor, Labrador Retriever (ya existe) | Renguea, le cuesta levantarse, dolor de cadera | Primera sugerencia: displasia de cadera. Firmar con un diagnóstico manual secundario. |
| 4 | Coco, control (turno del 26/11 o uno nuevo con "Programar control") | "Viene a control. Sigue roncando de noche pero ya no se cansa al caminar y no tose." | La consulta se vincula sola a la anterior. La evolución marca ronquido **Persiste** y tos e intolerancia al ejercicio **Resuelto**. El motor avisa que la evidencia no alcanza (es un control) y se firma con "Usar el diagnóstico anterior". |
| 5 | Felipe y Simón, Shar Pei de Joaquín Ferreyra (ya existen, con su carnet) | Felipe, con **Iniciar dictado** (caso 11): se rasca todo el día, se lame las patas, **no sacude la cabeza**, enrojecimiento en pliegues, axilas y entre los dedos | Primera sugerencia: dermatitis atópica (predisposición de raza ×4). Se firma y, desde la consulta, **Receta (PDF)**. En **Agenda → Recordatorios**, enviar el recordatorio del turno de Simón y el de la séxtuple de Felipe: llegan al WhatsApp de Bruno. Desde el turno de Vacunación de Felipe, **Registrar vacuna** con la séxtuple del stock: va como consumo clínico porque las vacunas no tienen precio, baja el stock, el turno queda atendido y el recordatorio de esa dosis desaparece porque queda como su refuerzo. En **Ventas → Historial de Ventas** ya está la del Bravecto de Felipe. |

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
