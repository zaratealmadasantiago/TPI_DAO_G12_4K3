from flask import Blueprint, jsonify, request
from database import SessionLocal
from models import Producto, Categoria, Proveedor, Sucursal, StockItem

catalogo_bp = Blueprint('catalogo', __name__, url_prefix='/api/v1/catalogo')

# --- PRODUCTOS (ABM) ---
@catalogo_bp.route('/productos', methods=['GET'])
def listar_productos():
    db = SessionLocal()
    try:
        productos = db.query(Producto).all()
        resultado = [{
            "idProducto": p.idProducto,
            "codigoBarras": p.codigoBarras,
            "nombre": p.nombre,
            "precioVenta": p.precioVenta,
            "costoUnitario": p.costoUnitario,
            "stockMinimo": p.stockMinimo,
            "idCategoria": p.idCategoria,
            "idProveedor": p.idProveedor
        } for p in productos]
        return jsonify({"status": "success", "datos": resultado}), 200
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
            precioVenta=float(data['precioVenta']),
            costoUnitario=float(data['costoUnitario']),
            stockMinimo=int(data.get('stockMinimo', 5)),
            idCategoria=data.get('idCategoria', 1),
            idProveedor=data.get('idProveedor', 1)
        )
        db.add(nuevo_p)
        db.commit()
        return jsonify({"status": "success", "mensaje": "Producto creado exitosamente", "idProducto": nuevo_p.idProducto}), 201
    except Exception as e:
        db.rollback()
        return jsonify({"status": "error", "mensaje": str(e)}), 400
    finally:
        db.close()

@catalogo_bp.route('/productos/<int:id_producto>', methods=['PUT'])
def actualizar_producto(id_producto):
    data = request.json
    db = SessionLocal()
    try:
        p = db.query(Producto).get(id_producto)
        if not p:
            return jsonify({"status": "error", "mensaje": "Producto no encontrado"}), 404
        
        p.codigoBarras = data.get('codigoBarras', p.codigoBarras)
        p.nombre = data.get('nombre', p.nombre)
        p.precioVenta = float(data.get('precioVenta', p.precioVenta))
        p.costoUnitario = float(data.get('costoUnitario', p.costoUnitario))
        p.stockMinimo = int(data.get('stockMinimo', p.stockMinimo))
        
        db.commit()
        return jsonify({"status": "success", "mensaje": "Producto actualizado exitosamente"}), 200
    except Exception as e:
        db.rollback()
        return jsonify({"status": "error", "mensaje": str(e)}), 400
    finally:
        db.close()

@catalogo_bp.route('/productos/<int:id_producto>', methods=['DELETE'])
def eliminar_producto(id_producto):
    db = SessionLocal()
    try:
        p = db.query(Producto).get(id_producto)
        if not p:
            return jsonify({"status": "error", "mensaje": "Producto no encontrado"}), 404
        db.delete(p)
        db.commit()
        return jsonify({"status": "success", "mensaje": "Producto eliminado exitosamente"}), 200
    except Exception as e:
        db.rollback()
        return jsonify({"status": "error", "mensaje": str(e)}), 400
    finally:
        db.close()

# --- SUCURSALES ---
@catalogo_bp.route('/sucursales', methods=['GET'])
def listar_sucursales():
    db = SessionLocal()
    try:
        sucursales = db.query(Sucursal).all()
        resultado = [{
            "idEstablecimiento": s.idEstablecimiento,
            "codigo": s.codigo,
            "nombre": s.nombre,
            "direccion": s.direccion,
            "numeroSucursal": s.numeroSucursal
        } for s in sucursales]
        return jsonify({"status": "success", "datos": resultado}), 200
    finally:
        db.close()

# --- CATEGORÍAS ---
@catalogo_bp.route('/categorias', methods=['GET'])
def listar_categorias():
    db = SessionLocal()
    try:
        categorias = db.query(Categoria).all()
        resultado = [{
            "idCategoria": c.idCategoria,
            "nombre": c.nombre,
            "descripcion": c.descripcion
        } for c in categorias]
        return jsonify({"status": "success", "datos": resultado}), 200
    finally:
        db.close()

# --- PROVEEDORES ---
@catalogo_bp.route('/proveedores', methods=['GET'])
def listar_proveedores():
    db = SessionLocal()
    try:
        proveedores = db.query(Proveedor).all()
        resultado = [{
            "idProveedor": p.idProveedor,
            "cuit": p.cuit,
            "razonSocial": p.razonSocial,
            "telefonoContacto": p.telefonoContacto
        } for p in proveedores]
        return jsonify({"status": "success", "datos": resultado}), 200
    finally:
        db.close()

# --- STOCK ITEMS ---
@catalogo_bp.route('/stock', methods=['GET'])
def listar_stock():
    db = SessionLocal()
    try:
        items = db.query(StockItem).all()
        resultado = [{
            "idStockItem": s.idStockItem,
            "cantidadDisponible": s.cantidadDisponible,
            "cantidadReservada": s.cantidadReservada,
            "idProducto": s.idProducto,
            "productoNombre": s.producto.nombre if s.producto else None,
            "idEstablecimiento": s.idEstablecimiento,
            "establecimientoNombre": s.establecimiento.nombre if s.establecimiento else None
        } for s in items]
        return jsonify({"status": "success", "datos": resultado}), 200
    finally:
        db.close()