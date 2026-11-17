# Portal del cliente — `/portal`

Portal de **solo lectura** para el dueño de la mascota: sus mascotas, la historia clínica (solo
consultas firmadas), sus turnos y sus compras. Lo ve todo usuario con el permiso `portal:ver`, que
tiene el rol CLIENTE (`scripts/auth/001_portal_y_cuentas_cliente.sql`). No hay que habilitarlo
cliente por cliente.

## Pantallas

| Ruta | Qué muestra |
|------|-------------|
| `/` (inicio) | Para quien tiene `portal:ver` asignado: saludo, mis mascotas y los próximos 3 turnos. Con el comodín `*` el inicio sigue siendo el de la clínica. |
| `/portal/mascotas` | Tarjetas de mis mascotas (especie, raza, sexo, edad, estado y alerta médica). |
| `/portal/mascotas/:id` | Datos de la mascota y su historia clínica. |
| `/portal/consultas/:id` | La consulta firmada, en solo lectura. Si es un control, enlaza la consulta anterior. |
| `/portal/turnos` | Próximos (futuros, solicitados o confirmados) y anteriores, con su estado. Botón "Pedir turno" y "Cancelar turno" en los solicitados. |
| `/portal/turnos/nuevo` | Pedir turno: mascota, tipo, veterinario/a, día (desde mañana) y horario libre. |
| `/portal/compras` | Mis compras; cada una se despliega con sus renglones. |

El sidebar tiene la sección "Mi portal" (Mis mascotas, Mis turnos, Mis compras). Las pantallas
están pensadas para el celular.

## API (`backend/app/api/portal.py`)

Todos `GET`, con `portal:ver`: `/api/portal/mascotas`, `/mascotas/{id}`,
`/mascotas/{id}/consultas`, `/consultas/{id}`, `/turnos`, `/compras`, `/compras/{id}`.

## Pedir y cancelar turnos (`portal:pedir_turno`)

`GET /api/portal/turnos/opciones`, `GET /api/portal/turnos/disponibilidad`,
`POST /api/portal/turnos` y `POST /api/portal/turnos/{id}/cancelar`. El permiso y el parámetro
los crea `scripts/agenda/003_portal_pedir_turno.sql`.

- Solo para mascotas propias que se pueden atender. **El cliente no da de alta mascotas**: se
  registran en el mostrador. Sin mascotas, el portal le indica que se comunique con la clínica.
- Solo los tipos del parámetro `TIPOS_TURNO_PORTAL` (AGENDA): Consulta, Control y Vacunación.
  Cirugía no: la indica el veterinario.
- **Desde mañana en adelante.** Un turno para hoy se pide comunicándose con la clínica.
- El turno nace **`solicitado`** con canal `portal`, con las mismas validaciones de agenda que la
  app interna (`turno_service.registrar_turno`). **Lo confirma la clínica**; el cliente nunca
  confirma. Desde la app interna, la recepción sigue eligiendo solicitado (por ejemplo, para
  consultarlo con el veterinario) o confirmado.
- **El cliente solo cancela un turno suyo, futuro y `solicitado`.** Uno confirmado se cancela
  llamando a la clínica.
- La disponibilidad devuelve solo los horarios libres: no dice por qué un horario está ocupado
  (el detalle interno nombra a otros pacientes).
- Reprogramar desde el portal queda para después: se cancela y se pide otro.

## Reglas de seguridad (`backend/app/services/portal_service.py`)

1. La persona sale siempre de la sesión (`auth.usuario.persona_id`). Ningún endpoint recibe un
   `persona_id`.
2. El filtro por dueño va dentro de la consulta SQL, no "buscar y después verificar".
3. Lo ajeno y lo inexistente responden el mismo 404 (mismo código y mensaje).
4. Una consulta en borrador no existe para el cliente.
5. La persona del tutor eventual (`PERSONA_ID_TUTOR_EVENTUAL`) no tiene portal: listas vacías.
6. Schemas propios con lista blanca (`backend/app/schemas/portal.py`): no se reutilizan los del
   lado veterinario, que con los controles ahora traen signos y observaciones de la consulta
   anterior.

## Qué ve el cliente de una consulta

- **Sí:** fecha, veterinario, motivo, diagnósticos confirmados (solo el nombre, el principal
  primero), tratamiento, peso, temperatura y "Control de la consulta del …".
- **No:** dictado, signos, porcentajes, ranking, explicación y origen (IA o manual) de los
  diagnósticos, anamnesis, examen físico ni observaciones (pueden tener notas internas).

De una compra no ve quién la vendió.

## Tests

- Backend: `backend/tests/test_portal.py`. Las consultas se arman con el flujo real del
  veterinario (abrir, dictar, firmar), así se comprueba que dictado, signos y porcentajes existen
  en la base y no llegan al cliente.
- Frontend: `frontend/src/lib/portal.test.ts`, `frontend/src/pages/portal/*.test.tsx`.

## Fuera del prototipo

Reprogramar turnos desde el portal, pre-registro de mascotas por el cliente, auditoría de accesos a la historia
clínica, empleados que también son clientes (una persona tiene un solo usuario) y la mascota que
cambia de dueño (el anterior deja de verla: el filtro usa el dueño actual).
