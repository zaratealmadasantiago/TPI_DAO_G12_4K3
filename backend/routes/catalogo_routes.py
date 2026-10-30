from flask import Blueprint, jsonify, request
from database import SessionLocal
from models import Producto, Sucursal, Categoria

catalogo_bp = Blueprint('catalogo', __name__, url_prefix='/api/v1/catalogo')

@catalogo_bp.route('/productos', methods=['GET'])
def listar_productos():
    db = SessionLocal()
    try:
        productos = db.query(Producto).all()
        resultado = [
            {
                "idProducto": p.idProducto,
                "codigoBarras": p.codigoBarras,
                "nombre": p.nombre,
                "precioVenta": p.precioVenta,
                "costoUnitario": p.costoUnitario,
                "stockMinimo": p.stockMinimo
            } for p in productos
        ]
        return jsonify(resultado), 200
    finally:
        db.close()

@catalogo_bp.route('/productos', methods=['POST'])
def crear_producto():
    data = request.json
    db = SessionLocal()
    try:
        nuevo_p = Producto(
            codigoBarras=data['codigoBarras'],
            nombre=data['nombre'],
            precioVenta=data['precioVenta'],
            costoUnitario=data['costoUnitario'],
            stockMinimo=data.get('stockMinimo', 0),
            idCategoria=data.get('idCategoria'),
            idProveedor=data.get('idProveedor')
        )
        db.add(nuevo_p)
        db.commit()
        return jsonify({"mensaje": "Producto creado exitosamente", "idProducto": nuevo_p.idProducto}), 201
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 400
    finally:
        db.close()