**Backend**
cd /Users/ezequieldjemdjemian/Desktop/utn_frro_svg/backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

**Frontend**
cd /Users/ezequieldjemdjemian/Desktop/utn_frro_svg/frontend
npm install
npm run dev -- --host 0.0.0.0

**Para ver lo que armé en el browser:**

Frontend: http://localhost:5173
Backend docs: http://localhost:8000/docs
