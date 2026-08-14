**Crear/activar venv e instalar deps (si no lo hiciste):**
cd backend
python3 -m venv .venv
source .venv/bin/activate # (macOS/Linux) — Windows: .venv\Scripts\activate
pip install --upgrade pip setuptools wheel
pip install -r requirements.txt

**(Opcional) si querés regenerar la migración con Alembic más adelante: arreglar Alembic antes de usar autogenerate (te explico abajo).**

**Iniciar el servidor backend:**
source .venv/bin/activate
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000