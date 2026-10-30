import os
from flask import Flask, jsonify
from flask_cors import CORS
from database import init_db, DB_PATH
from routes import all_blueprints  # O importas cada blueprint por separado

app = Flask(__name__)

# Configuración de CORS para permitir conexiones desde el frontend
CORS(app)

# Registrar todos los Blueprints en la aplicación de Flask
for bp in all_blueprints:
    app.register_blueprint(bp)

@app.route('/', methods=['GET'])
def health_check():
    return jsonify({
        "status": "ok", 
        "mensaje": "API Gestor de Ventas y Logistica funcionando correctamente"
    }), 200

if __name__ == '__main__':
    print("Inicializando base de datos SQLite3...")
    init_db()
    
    # Verificación física de la base de datos
    if os.path.exists(DB_PATH):
        print(f"Base de datos SQLite3 lista en: {DB_PATH}")
    else:
        print("Advertencia: No se pudo verificar la creación del archivo SQLite3.")

    # Inicio del servidor Flask en el puerto 3000
    print("Iniciando servidor web Flask en http://127.0.0.1:3000")
    app.run(host='0.0.0.0', port=3000, debug=True)