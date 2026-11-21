# Recetas en PDF — `/recetas/historial` y botón **Receta (PDF)** de la consulta

En el prototipo, la receta sale de la consulta firmada: lo que se dicta como indicación («Indico…»,
dosis, cada cuántas horas, control) queda en el campo **Tratamiento** de la ficha, y con eso se
arma el PDF. El abstract excluye la integración con dispositivos, así que no hay impresión: el PDF
se descarga y se le envía al tutor (o lo ve en el portal). La receta electrónica con ítems,
alergias, matrícula, firma digital y código de validación es de la Fase 2
(`docs/fase2_diseno.md`).

## Dónde aparece

- **Consulta firmada** con indicaciones: botón **Receta (PDF)** junto a "Historia clínica". Al
  firmar, el mensaje avisa que la receta ya se puede descargar.
- **Recetas → Historial de recetas**: todas las consultas firmadas con indicaciones, de la más
  reciente a la más antigua, con su botón de descarga. Acepta `?mascota_id=`.
- **Recetas → Nueva receta** explica de dónde sale la receta y lleva a la consulta.

## Qué tiene el PDF

Va en A4 y sale con `reportlab` (dependencia nueva en `backend/requirements.txt`). Tiene:

- la clínica (parámetro `RAZON_SOCIAL`), el número (el de la consulta) y la fecha de firma;
- el paciente con especie, raza, sexo, edad y peso, y el tutor con DNI y celular;
- el diagnóstico principal y las alertas médicas, si tiene;
- las indicaciones bajo "Rp./", respetando los saltos de línea;
- los estudios pedidos u observaciones, si hay;
- la firma: veterinario y fecha y hora en que firmó la consulta en el sistema.

El nombre del archivo es `receta-<mascota>-<fecha>.pdf`.

## Permisos y API

| Método y ruta | Permiso |
|---------------|---------|
| `GET /api/consultas/{id}/receta.pdf` | los de lectura de consultas, `recetas:crear` o `recetas:ver_historial` |
| `GET /api/recetas?mascota_id=&page=&page_size=` | `recetas:ver_historial`, `recetas:crear`, `consultas:ver_historial` o `consultas:ver_historia_clinica` |

Errores: `RECETA_CONSULTA_SIN_FIRMAR` y `RECETA_SIN_INDICACIONES` (409). Si el backend no tiene
`reportlab` instalado, el PDF responde `PDF_NO_DISPONIBLE` (503) y el resto del sistema sigue
andando.

## Tests

`backend/tests/test_recetas.py` (PDF con su contenido, símbolos en el texto, consulta sin firmar o
sin indicaciones, historial, permisos) y `frontend/src/lib/api.test.ts` (descarga con el nombre que
manda el backend).
