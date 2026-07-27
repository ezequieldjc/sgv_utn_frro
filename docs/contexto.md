# Contexto Maestro: Sistema Inteligente de Gestión Veterinaria (Yacanvet)

## Definición del Negocio y Objetivos
Yacanvet es una clínica veterinaria que requiere modernizar su gestión clínica y comercial . Actualmente operan con registros manuales y fragmentados, lo cual impacta negativamente en la velocidad de atención y el control operativo . Las problemáticas principales radican en la lentitud en el registro clínico por la dificultad para redactar en la computadora mientras se manipulan animales inquietos, sumado a la descentralización de la información por la falta de una Historia Clínica unificada . También sufren un descontrol de inventario debido a la desconexión entre los insumos utilizados médicamente y las ventas del Pet Shop, y un alto ausentismo de pacientes por olvido de los clientes .

## Solución Propuesta
La solución abarca una Historia Clínica Digital centralizada y estructurada que integra Procesamiento de Lenguaje Natural para el registro ágil mediante dictado por voz . Se suma un módulo de asistencia diagnóstica por IA que sugiere diagnósticos cruzando síntomas con la predisposición genética de la raza y especie . Además, se implementará un inventario unificado en tiempo real y la automatización de turnos (con recordatorios vía WhatsApp) y recetas electrónicas con trazabilidad legal .

## Stack Tecnológico y Arquitectura
El sistema se construye sobre un paradigma Cliente/Servidor totalmente desacoplado . La capa de presentación será una Single Page Application independiente usando React.js con TypeScript (tipado estricto, sin any), Vite, Tailwind CSS, React Router Dom y Axios o Fetch API, garantizando una interfaz fluida y tiempos de desarrollo rápidos sin hojas de estilo gigantescas . La capa de lógica de negocio será una API RESTful construida en Python con FastAPI, que además expone automáticamente documentación interactiva (Swagger UI) bajo el estándar OpenAPI — ese mismo esquema es la base para generar los tipos de TypeScript del frontend (ver database-types.mdc) y Uvicorn, asegurando alta velocidad y validación de datos con Pydantic, protegiendo las sesiones con tokens JWT y CORS . En cuanto a la persistencia de datos, se usará PostgreSQL gestionado con el ORM SQLModel y Alembic para las migraciones.
El control de acceso no se basa en roles fijos hardcodeados (ej. 'admin', 'veterinario', 'cliente'), sino en un esquema de permisos dinámico (RBAC): cada usuario tiene un rol, cada rol tiene permisos asociados, y toda validación —tanto en frontend como en backend— se resuelve por permiso específico (ej. `pacientes:read`), nunca comparando el nombre del rol directamente.

## Autenticación e Interfaz Inicial
El login vive dentro de la SPA de React + Vite y no usa convenciones de Next.js . Por ahora no existe recuperación/autogestión de contraseñas .
La pantalla de login solo debe mostrar dos mensajes de error en rojo: `Credenciales incorrectas` cuando el usuario no existe o la clave es inválida, y `Usuario deshabilitado` cuando el usuario está inhabilitado . En ambos casos se deben limpiar los campos de usuario y contraseña .
Luego de un login exitoso, el usuario entra directamente al shell principal con sidebar izquierdo, topbar superior y el área principal vacía por ahora . La visibilidad de los botones del sidebar depende de permisos, no del nombre del rol .

## Roles y Permisos
Los roles, permisos y la visibilidad del sidebar no se hardcodean en docs ni en código de UI . Al iniciar sesión, el backend debe recuperar el usuario, su rol y los permisos asociados desde la base de datos, incluir lo necesario en el JWT y el frontend debe renderizar el sidebar en base a esos permisos .

La convención de permisos a usar en las reglas y prompts es `recurso:accion` (por ejemplo `pacientes:read`, `turnos:create`, `stock:update`) . El wildcard `*` significa acceso total, pero la asignación concreta de permisos a cada rol vive en la base de datos y puede cambiar sin tocar el frontend .

## DevOps y Calidad
El entorno de desarrollo estará unificado y aislado mediante Docker y Docker Compose para garantizar paridad entre sistemas operativos . Para la calidad del código, se emplearán Ruff en Python y Prettier en el frontend, además de pruebas unitarias con Pytest . Todo esto estará orquestado por un pipeline de GitHub Actions que bloqueará despliegues ante fallas, enviando errores de producción a Sentry . El despliegue continuo se realizará alojando el frontend en Vercel o Netlify, el backend en Render o Railway, y la base de datos en Neon.tech .

## Estándares y Flujo de Trabajo
La IA debe generar código modular, con tipado estricto en Python y comentarios exhaustivos en español, evitando archivos monolíticos . El flujo de trabajo implica desarrollo local con Docker, programación en ramas de Git, validación local, integración continua en GitHub y despliegue automático a producción .

## Restricciones Críticas
El aspecto legal exige que el módulo de IA no tome decisiones sino que actúe como asistente estadístico, manteniendo la responsabilidad médica en el profesional matriculado . Además, es obligatorio aplicar buenas prácticas de seguridad para cumplir con la normativa local de privacidad de datos .
