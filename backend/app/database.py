import os
from dotenv import load_dotenv
from sqlmodel import SQLModel, create_engine, Session

# Cargar las variables de entorno desde el archivo .env
load_dotenv()

# Obtener la URL de conexión de la variable de entorno
DATABASE_URL = os.getenv("DATABASE_URL")

if not DATABASE_URL:
    raise ValueError("La variable de entorno DATABASE_URL no está configurada.")

# Modificar postgres:// a postgresql:// si es necesario (Neon a veces lo devuelve sin la 'ql')
if DATABASE_URL.startswith("postgres://"):
    DATABASE_URL = DATABASE_URL.replace("postgres://", "postgresql://", 1)

# Crear el motor de la base de datos
engine = create_engine(DATABASE_URL, echo=True)  # echo=True muestra los queries SQL en consola (útil en dev)

# Función para la inyección de dependencias en FastAPI
def get_session():
    with Session(engine) as session:
        yield session