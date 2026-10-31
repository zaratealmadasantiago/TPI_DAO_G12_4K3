from flask import Blueprint, jsonify, request
from database import SessionLocal
from models import Producto, Categoria, Proveedor, Sucursal, CentroDistribucion, Establecimiento, StockItem

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

# --- ESTABLECIMIENTOS (Sucursales y Centros de Distribución) ---
@catalogo_bp.route('/establecimientos', methods=['GET'])
def listar_establecimientos():
    """Listado unificado de todos los puntos físicos (Polimorfismo ORM)."""
    db = SessionLocal()
    try:
        establecimientos = db.query(Establecimiento).all()
        resultado = []
        for e in establecimientos:
            item = {
                "idEstablecimiento": e.idEstablecimiento,
                "codigo": e.codigo,
                "nombre": e.nombre,
                "direccion": e.direccion,
                "telefono": e.telefono,
                "tipo": e.tipo
            }
            if isinstance(e, Sucursal):
                item["numeroSucursal"] = e.numeroSucursal
                item["habilitadaVenta"] = e.habilitadaVenta
            elif isinstance(e, CentroDistribucion):
                item["codigoOperativo"] = e.codigoOperativo
            resultado.append(item)
        return jsonify({"status": "success", "datos": resultado}), 200
    finally:
        db.close()

@catalogo_bp.route('/establecimientos/sucursal', methods=['POST'])
def crear_sucursal():
    data = request.json
    db = SessionLocal()
    try:
        nueva_suc = Sucursal(
            codigo=data['codigo'],
            nombre=data['nombre'],
            direccion=data['direccion'],
            telefono=data.get('telefono', ''),
            numeroSucursal=int(data['numeroSucursal']),
            habilitadaVenta=data.get('habilitadaVenta', True)
        )
        db.add(nueva_suc)
        db.commit()
        return jsonify({"status": "success", "mensaje": "Sucursal creada exitosamente"}), 201
    except Exception as e:
        db.rollback()
        return jsonify({"status": "error", "mensaje": str(e)}), 400
    finally:
        db.close()

@catalogo_bp.route('/establecimientos/centro-distribucion', methods=['POST'])
def crear_centro_distribucion():
    data = request.json
    db = SessionLocal()
    try:
        nuevo_cd = CentroDistribucion(
            codigo=data['codigo'],
            nombre=data['nombre'],
            direccion=data['direccion'],
            telefono=data.get('telefono', ''),
            codigoOperativo=data['codigoOperativo']
        )
        db.add(nuevo_cd)
        db.commit()
        return jsonify({"status": "success", "mensaje": "Centro de Distribución creado exitosamente"}), 201
    except Exception as e:
        db.rollback()
        return jsonify({"status": "error", "mensaje": str(e)}), 400
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

# --- CONSULTAR STOCK POR ESTABLECIMIENTO PUNTUAL ---
@catalogo_bp.route('/establecimientos/<int:id_establecimiento>/stock', methods=['GET'])
def obtener_stock_establecimiento(id_establecimiento):
    """
    Retorna el listado de productos que pertenecen al stock de una sucursal o CD específica.
    """
    db = SessionLocal()
    try:
        est = db.query(Establecimiento).get(id_establecimiento)
        if not est:
            return jsonify({"status": "error", "mensaje": "Establecimiento no encontrado"}), 404

        items = db.query(StockItem).filter(StockItem.idEstablecimiento == id_establecimiento).all()
        
        stock_detalle = []
        for s in items:
            p = s.producto
            if p:
                stock_detalle.append({
                    "idStockItem": s.idStockItem,
                    "idProducto": p.idProducto,
                    "codigoBarras": p.codigoBarras,
                    "nombre": p.nombre,
                    "precioVenta": p.precioVenta,
                    "costoUnitario": p.costoUnitario,
                    "stockMinimo": p.stockMinimo,
                    "cantidadDisponible": s.cantidadDisponible,
                    "cantidadReservada": s.cantidadReservada
                })

        return jsonify({
            "status": "success", 
            "establecimiento": {
                "idEstablecimiento": est.idEstablecimiento,
                "nombre": est.nombre,
                "tipo": est.tipo
            },
            "datos": stock_detalle
        }), 200
    finally:
        db.close()

# --- GESTIÓN DE STOCK ITEM POR ESTABLECIMIENTO PUNTUAL ---

@catalogo_bp.route('/establecimientos/<int:id_establecimiento>/stock', methods=['POST'])
def agregar_o_actualizar_stock_establecimiento(id_establecimiento):
    """
    Agrega un producto al stock de un establecimiento puntual o actualiza su cantidad disponible.
    """
    data = request.json
    id_producto = data.get('idProducto')
    cantidad = int(data.get('cantidadDisponible', 0))

    db = SessionLocal()
    try:
        # Verificar que el establecimiento exista
        est = db.query(Establecimiento).get(id_establecimiento)
        if not est:
            return jsonify({"status": "error", "mensaje": "Establecimiento no encontrado"}), 404

        # Buscar si ya existe el StockItem para este producto y establecimiento
        stock_item = db.query(StockItem).filter(
            StockItem.idEstablecimiento == id_establecimiento,
            StockItem.idProducto == id_producto
        ).first()

        if stock_item:
            # Si existe, actualizamos la cantidad disponible
            stock_item.cantidadDisponible = cantidad
            mensaje = "Stock actualizado correctamente"
        else:
            # Si no existe, creamos una nueva asignación de StockItem
            stock_item = StockItem(
                idEstablecimiento=id_establecimiento,
                idProducto=id_producto,
                cantidadDisponible=cantidad,
                cantidadReservada=0
            )
            db.add(stock_item)
            mensaje = "Producto asignado al establecimiento correctamente con su stock inicial"

        db.commit()
        return jsonify({"status": "success", "mensaje": mensaje, "idStockItem": stock_item.idStockItem}), 200
    except Exception as e:
        db.rollback()
        return jsonify({"status": "error", "mensaje": str(e)}), 400
    finally:
        db.close()

@catalogo_bp.route('/stock/<int:id_stock_item>', methods=['DELETE'])
def quitar_stock_establecimiento(id_stock_item):
    """
    Elimina un StockItem (desvincula el producto del establecimiento puntual).
    """
    db = SessionLocal()
    try:
        item = db.query(StockItem).get(id_stock_item)
        if not item:
            return jsonify({"status": "error", "mensaje": "StockItem no encontrado"}), 404
        
        db.delete(item)
        db.commit()
        return jsonify({"status": "success", "mensaje": "Producto desvinculado del establecimiento"}), 200
    except Exception as e:
        db.rollback()
        return jsonify({"status": "error", "mensaje": str(e)}), 400
    finally:
        db.close()