import os
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from models.base import Base

# Construcción de la ruta hacia la carpeta backend/datos/datos.sqlite3
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
DATA_DIR = os.path.join(BASE_DIR, "datos")
os.makedirs(DATA_DIR, exist_ok=True)

DB_PATH = os.path.join(DATA_DIR, "datos.sqlite3")
DATABASE_URL = f"sqlite:///{DB_PATH}"

engine = create_engine(DATABASE_URL, echo=False)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

def init_db():
    import models  # Carga de modelos para registrar esquemas
    Base.metadata.create_all(bind=engine)