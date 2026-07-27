# 1 inicializar python para el backend 

1- 
cd backend

2- Crear el entorno virtual (venv):
python -m venv venv

3-Activar el entorno virtual:
windows:
.\venv\Scripts\activate
mac:
source venv/bin/activate

4- instlaar las librerias:
pip install -r requirements.txt

# ================================================

# 1 inicializar Alembic
1- terminal en /backend
alembic init alembic
2-cambiar el codigo de /backend/alembic/env.py
3- ejecutar
alembic revision --autogenerate -m "Init DB: core, auth, clinica, sys"