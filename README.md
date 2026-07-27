# Sistema Inteligente de Gestión Veterinaria 🐾

Yacanvet es la veterinaria para la cual se desarrolla este sistema. Esta solución integral moderniza la gestión operativa, clínica y comercial de la clínica, centraliza historias clínicas digitales, optimiza el control de inventario unificado (clínica + Pet Shop) y automatiza el flujo de turnos y recordatorios.

---

## 🚀 Stack Tecnológico

El proyecto está diseñado bajo un paradigma **Cliente/Servidor desacoplado** (Monorepo):

### **Backend**
* **Lenguaje:** Python 3.12+
* **Framework Web:** FastAPI (con generación automática de OpenAPI / Swagger UI)
* **ORM & Modelado:** SQLModel (SQLAlchemy + Pydantic)
* **Gestión de Migraciones:** Alembic
* **Base de Datos:** PostgreSQL gestionado en **Neon.tech**
* **Autenticación & Seguridad:** JWT con esquema de permisos dinámicos (RBAC) y hashing de contraseñas con Passlib/Bcrypt
* **Linter & Formateador:** Ruff

### **Frontend**
* **Librería/Framework:** React.js + TypeScript (tipado estricto)
* **Bundler:** Vite
* **Estilos:** Tailwind CSS

---

