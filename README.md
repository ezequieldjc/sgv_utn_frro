#Sistema Inteligente de Gestión Veterinaria 🐾

es una solución integral para la modernización operativa, clínica y comercial de clínicas veterinarias. El sistema centraliza la gestión de historias clínicas digitales, optimiza el control de inventario unificado (clínica + Pet Shop) y automatiza el flujo de turnos y recordatorios.

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

### **Frontend** *(Próximamente)*
* **Librería/Framework:** React.js + TypeScript (tipado estricto)
* **Bundler:** Vite
* **Estilos:** Tailwind CSS

---

