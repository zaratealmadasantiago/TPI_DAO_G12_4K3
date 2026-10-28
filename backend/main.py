from database import init_db, DB_PATH
import os

if __name__ == "__main__":
    print("Inicializando base de datos SQLite3...")
    init_db()
    
    if os.path.exists(DB_PATH):
        print(f"Base de datos SQLite3 creada exitosamente en: {DB_PATH}")
    else:
        print("Error al verificar la creación del archivo SQLite3.")