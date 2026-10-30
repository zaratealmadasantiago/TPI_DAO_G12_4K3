from routes.catalogo_routes import catalogo_bp
from routes.logistica_routes import logistica_bp
from routes.ventas_routes import ventas_bp
from routes.reportes_routes import reportes_bp

# Lista de todos los blueprints para facilitar su iteración y registro
all_blueprints = [
    catalogo_bp,
    logistica_bp,
    ventas_bp,
    reportes_bp
]