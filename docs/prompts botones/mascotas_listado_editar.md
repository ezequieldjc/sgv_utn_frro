Actúa como un desarrollador Full Stack Senior (React/shadcn/Zod + FastAPI/SQLModel).

Necesito implementar la funcionalidad de "Editar Mascota" disparada desde el botón de edición en la grilla del Listado de Mascotas. El diseño debe ser estricto, sin asumir comportamientos fuera de esta especificación.

### 1. Frontend - Interfaz de Edición (UI en Sheet de shadcn)
Implementar un formulario dividido lógicamente (secciones o tabs).
**Reglas estrictas de campos:**
- **Especie:** SOLO LECTURA (`disabled`). No se puede cambiar.
- **Tutor:** Selector modificable (búsqueda por DNI o Nombre).
- **Raza:** Selector modificable. Sus opciones deben estar filtradas por el `especie_id` (que es fijo).
- **Estado (`mascota_estado_id`):** Selector modificable. Debe mostrar TODAS las opciones del catálogo `MascotaEstado`.
- **Peso:** ESTRICTAMENTE OMITIDO. No incluir campo de peso en esta pantalla (se gestiona por consultas).
- **Fecha de Nacimiento:** Mantener la lógica del toggle "Mes/Año" vs "Fecha Exacta" implementada en el alta.
- **Campos Clínicos Adicionales (Modificables):** Sexo, Microchip, Alertas Médicas (Textarea).
- **Catálogos Clínicos (Modificables):** Pelaje, Tamaño, Hábitat, Estado Reproductivo, Temperamento. Sus opciones DEBEN venir filtradas desde el backend según la especie del animal.

### 2. Backend - API y Lógica de Negocio (FastAPI)
- **Método y Endpoint:** Implementar `PATCH /api/mascotas/{id}` siguiendo el estándar REST para actualizaciones. 
- **Esquema Pydantic:** Crear `MascotaUpdate` con los campos opcionales. Al procesar, usar `exclude_unset=True` para actualizar solo lo que el frontend envíe.
- **Gestión de Catálogos:** Revisa el código actual. Si ya existen endpoints para traer los catálogos (`pelaje`, `tamanio`, `habitat`, `estado_reproductivo`, `temperamento`, `mascota_estado`), REUTILIZALOS. Si no existen, créalos, asegurando que los catálogos específicos reciban `especie_id` como query param para filtrar.
- **Contrato de Respuesta:** El endpoint `PATCH` debe devolver el objeto de la mascota actualizado, incluyendo las relaciones pobladas (nombres de tutor, raza, especie, estado) para que el frontend pueda actualizar la fila en la grilla sin necesidad de recargar la página entera (Mutación optimista o actualización de caché en React Query/SWR si se está usando).
- **Seguridad:** El endpoint debe estar protegido y requerir el permiso `mascotas:update`.

### 3. Consideraciones Adicionales
- Precargar el formulario usando los datos actuales de la mascota mediante `GET /api/mascotas/{id}` (asegurar que este endpoint devuelva los IDs de los catálogos asignados).
- Validar tipos estrictos en ambos extremos.
- Manejar estados de carga (`isSubmitting`) y mostrar Toasts de éxito o error.