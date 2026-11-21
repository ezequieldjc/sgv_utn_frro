# Vacunas y desparasitaciones de una mascota — `/mascotas/:id/vacunas`

Carnet sanitario de la mascota y registro de cada aplicación. Es la parte manual de US-15 y
US-17. El diseño de la Fase 2 (esquemas, catálogo de productos preventivos, dosis fraccionadas)
está en `docs/fase2_diseno.md`.

## Cómo se llega

- **Listado de mascotas:** ícono de jeringa en la fila.
- **Agenda:** en un turno de tipo Vacunación, el botón **Registrar vacuna** abre la pantalla con
  `?turno_id=…`. Al guardar una aplicación, el turno queda atendido.
- **Consulta:** el botón **Vacunas** abre la pantalla con `?consulta_id=…`, y la aplicación
  queda vinculada a esa consulta.

## Datos que necesita

`scripts/clinica/008_vacunas_recordatorios.sql` crea `clinica.tratamiento_preventivo`, los
permisos y los parámetros del grupo PREVENTIVA. Los productos son los del stock de los rubros
**Vacuna** y **Antiparasitario** (los crea `scripts/stock/001`): una vacuna se carga como
cualquier insumo, con su precio de venta si se cobra.

## Permisos

| Acción | Permiso |
|--------|---------|
| Ver el carnet | `vacunas:ver`, `vacunas:registrar`, `consultas:crear` o `consultas:ver_historia_clinica` |
| Registrar una aplicación | `vacunas:registrar` |

El script 008 le da `vacunas:ver` y `vacunas:registrar` a los roles que tienen `consultas:crear`,
y `vacunas:ver` a los que tienen `agenda:crear_turno`.

## Reglas

Hay dos modos de registro. **Aplicar ahora** es la aplicación de hoy en la clínica: hay que
elegir el producto del stock, la fecha es la de hoy y se descuenta un envase. Si se marca
**Cobrar al tutor**, se arma la venta a nombre del tutor con el medio de pago elegido (el mismo
servicio que la venta de mostrador; la venta y la aplicación se guardan juntas o no se guarda
ninguna). Si no se cobra, o el producto no tiene precio, el descuento queda como consumo clínico.
**Dosis anterior** registra lo que ya se dio (libreta, otra veterinaria): se escribe el producto y
la fecha, que no puede ser futura, y no se mueve stock.

El producto tiene que ser del tipo elegido: una vacuna sale del rubro Vacuna y una desparasitación,
del rubro Antiparasitario. La próxima dosis se propone sumando `DIAS_REFUERZO_VACUNA` (365) o
`DIAS_REFUERZO_DESPARASITACION` (90) a la fecha de aplicación. Se puede cambiar, tiene que ser
posterior a la aplicación, y se puede marcar **Sin refuerzo**.

**¿Completa una dosis anterior?** sirve para vincular el refuerzo con la dosis que vence. La
pantalla propone la dosis del mismo tipo, vencida o por vencer, con el mismo producto (compara los
nombres sin tildes ni mayúsculas). Una dosis se completa una sola vez, y la dosis completada deja
de aparecer en los recordatorios.

Una mascota que no se atiende (fallecida, dada de baja) muestra el carnet pero no admite
aplicaciones nuevas. Las del tutor eventual en tránsito o extraviadas sí las admiten. El peso, si
se carga al aplicar, actualiza el último peso de la mascota.

En el carnet, cada dosis muestra su estado: **Al día**, **Vence en N días** (dentro de los
`DIAS_AVISO_DOSIS`), **Venció hace N días**, **Refuerzo aplicado** o **Sin refuerzo**.

## API

| Método y ruta | Qué hace |
|---------------|----------|
| `GET /api/vacunas?mascota_id=` | Carnet: la mascota, sus aplicaciones (de la más reciente a la más antigua), la configuración y la fecha de hoy de la clínica |
| `GET /api/vacunas/productos` | Productos activos de los rubros Vacuna y Antiparasitario, con stock y precio |
| `POST /api/vacunas` | Registra una aplicación. Devuelve el ítem, la venta (si se cobró), si el turno quedó atendido y las advertencias de stock |

Errores: `MASCOTA_NO_ATENDIBLE`, `PRODUCTO_NO_PREVENTIVO`, `PRODUCTO_NO_VENDIBLE`,
`FECHA_APLICACION_INVALIDA`, `FECHA_PROXIMA_INVALIDA`, `REFUERZO_DE_OTRO_TIPO`,
`REFUERZO_ANTERIOR_A_LA_DOSIS`, `DOSIS_YA_REFORZADA`, `TURNO_DE_OTRA_MASCOTA`,
`TURNO_NO_ATENDIBLE`, `CONSULTA_DE_OTRA_MASCOTA`.

## Tests

`backend/tests/test_vacunas.py` (stock, venta, consumo clínico, dosis anteriores, refuerzos,
turno, mascota no atendible, permisos), `frontend/src/lib/vacunas.test.ts` y
`frontend/src/pages/mascotas/mascota-vacunas-page.test.tsx`.
