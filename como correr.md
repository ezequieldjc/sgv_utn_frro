# Cómo correr el proyecto

## Primera vez (instalación)

### Backend
```bash
cd /Users/ezequieldjemdjemian/Desktop/utn_frro_svg/backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload
```

### Frontend
```bash
cd /Users/ezequieldjemdjemian/Desktop/utn_frro_svg/frontend
npm install
npm run dev
```

---

## Después

### Backend
```bash
cd /Users/ezequieldjemdjemian/Desktop/utn_frro_svg/backend
source .venv/bin/activate
uvicorn app.main:app --reload
```

### Frontend
```bash
cd /Users/ezequieldjemdjemian/Desktop/utn_frro_svg/frontend
npm run dev
```

---

## Para ver la app

- Frontend: http://localhost:5173
- Backend: http://localhost:8000