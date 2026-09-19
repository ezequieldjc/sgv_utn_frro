Actúa como un desarrollador Full Stack Senior en Python (FastAPI, SQLModel) y React (TypeScript, Vite).

Necesito actualizar el modelo de datos, los schemas de Pydantic/SQLModel y las validaciones del formulario de alta de persona en el frontend para soportar un flujo de admisión rápida.

### Contexto de Cambios en Base de Datos (Ya aplicados)
- `core.persona.fecha_nacimiento`: Ya admite nulos (`NULLABLE`).
- `core.persona.dni`: Ya admite nulos (`NULLABLE`) y se eliminó la restricción de unicidad (`UQ_Persona_DNI`).

### Requerimientos de Ajuste

1. **Backend - Módulo `core` (`Persona` y Schemas)**
   - Actualizar el modelo `Persona` (SQLModel) para reflejar opcionalidad (`None = Field(default=None, nullable=True)`) en: `sexo`, `fecha_nacimiento`, `dni` y `mail`.
   - Ajustar los esquemas de Pydantic (`PersonaCreate`, `PersonaResponse`, etc.):
     - **Obligatorios**: `nombre`, `apellido`, `celular`.
     - **Opcionales**: `dni`, `sexo`, `fecha_nacimiento`, `mail`, `domicilio_id`.
     - `dni` puede repetirse; no validar duplicidad.

2. **Backend - Módulo `clinica` (`Mascota`)**
   - Verificar y asegurar que en la entidad `Mascota` los únicos campos **OBLIGATORIOS** sean: `nombre`, `persona_id`, `raza_id` y `mascota_estado_id`.
   - Todos los demás atributos (`sexo`, `fecha_nacimiento`, `microchip`, `alertas_medicas`, `pelaje_id`, `tamanio_id`, `habitat_id`, `estado_reproductivo_id`, `temperamento_id`) deben ser estrictamente opcionales.

3. **Frontend - Formulario Alta de Persona/Cliente**
   - Actualizar el esquema de validación (Zod/Yup/React Hook Form) del formulario de alta de cliente/persona existente.
   - Formulario **Campos Requeridos**: Nombre, Apellido y Celular.
   - Formulario **Campos Opcionales**: DNI, Sexo, Fecha de Nacimiento, Email y Domicilio.
   - Si DNI queda vacío, pedir confirmación en un Dialog antes de crear con `dni = null`.
   - Domicilio se habilita mediante checkbox “Agregar domicilio”; apagado por defecto.

### Reglas Generales
- Mantener tipado estricto (TypeScript sin `any`, Python con `| None`).
- Respetar la arquitectura modular del proyecto (`core/`, `clinica/`).
- No modificar el comportamiento de `es_cliente` (debe seguir guardándose en `True` al dar de alta un cliente desde este flujo).