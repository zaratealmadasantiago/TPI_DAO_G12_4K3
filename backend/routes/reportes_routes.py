from flask import Blueprint, jsonify, request
from database import SessionLocal
from models import Venta, Bulto, StockItem, Producto, DetalleVenta
from sqlalchemy import func

reportes_bp = Blueprint('reportes', __name__, url_prefix='/api/v1/reportes')

@reportes_bp.route('/ventas', methods=['GET'])
def reportes_ventas():
    db = SessionLocal()
    try:
        id_sucursal = request.args.get('id_sucursal', type=int)
        query = db.query(Venta)
        if id_sucursal:
            query = query.filter(Venta.idSucursal == id_sucursal)
        
        ventas = query.all()
        total_recaudado = sum(v.total for v in ventas)
        
        return jsonify({
            "status": "success",
            "datos": {
                "cantidadVentas": len(ventas),
                "totalRecaudado": total_recaudado
            }
        }), 200
    finally:
        db.close()

@reportes_bp.route('/productos-mas-vendidos', methods=['GET'])
def productos_mas_vendidos():
    db = SessionLocal()
    try:
        resultados = db.query(
            Producto.nombre,
            func.sum(DetalleVenta.cantidad).label("totalVendido")
        ).join(DetalleVenta, Producto.idProducto == DetalleVenta.idProducto)\
         .group_by(Producto.idProducto)\
         .order_by(func.sum(DetalleVenta.cantidad).desc())\
         .all()

        datos = [{"producto": r[0], "totalVendido": r[1]} for r in resultados]
        return jsonify({"status": "success", "datos": datos}), 200
    finally:
        db.close()

@reportes_bp.route('/stock-minimo', methods=['GET'])
def stock_minimo():
    db = SessionLocal()
    try:
        items = db.query(StockItem).all()
        alertas = []
        for item in items:
            if item.producto and item.cantidadDisponible <= item.producto.stockMinimo:
                alertas.append({
                    "idStockItem": item.idStockItem,
                    "producto": item.producto.nombre,
                    "cantidadDisponible": item.cantidadDisponible,
                    "stockMinimo": item.producto.stockMinimo,
                    "idEstablecimiento": item.idEstablecimiento
                })
        return jsonify({"status": "success", "datos": alertas}), 200
    finally:
        db.close()

@reportes_bp.route('/bultos-rechazados', methods=['GET'])
def bultos_rechazados():
    db = SessionLocal()
    try:
        bultos = db.query(Bulto).all()
        rechazados = [{
            "idBulto": b.idBulto,
            "codigoBulto": b.codigoBulto,
            "codigoPrecinto": b.codigoPrecinto,
            "estado": b.estadoActual.nombreEstado if b.estadoActual else "Desconocido"
        } for b in bultos if b.estadoActual and b.estadoActual.tipo == 'rechazado']
        
        return jsonify({"status": "success", "datos": rechazados}), 200
    finally:
        db.close()