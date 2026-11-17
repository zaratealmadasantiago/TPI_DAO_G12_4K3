from flask import Blueprint, jsonify, request
from database import SessionLocal
from models import Producto, Categoria, Proveedor, Sucursal, CentroDistribucion, Establecimiento, StockItem

catalogo_bp = Blueprint('catalogo', __name__, url_prefix='/api/v1/catalogo')

# --- PRODUCTOS (ABM + HABILITAR/DESHABILITAR + PROVEEDOR) ---
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
            "esActivo": bool(p.esActivo) if p.esActivo is not None else True,
            "idCategoria": p.idCategoria,
            "categoriaNombre": p.categoria.nombre if p.categoria else "Sin categoría",
            "idProveedor": p.idProveedor,
            "proveedorNombre": p.proveedor.razonSocial if p.proveedor else "Sin proveedor",
            "proveedorCuit": p.proveedor.cuit if p.proveedor else "-"
        } for p in productos]
        return jsonify({"status": "success", "datos": resultado}), 200
    finally:
        db.close()


@catalogo_bp.route('/productos', methods=['POST'])
def crear_producto():
    data = request.json
    db = SessionLocal()
    try:
        id_proveedor = data.get('idProveedor')
        if not id_proveedor:
            return jsonify({"status": "error", "mensaje": "Debe seleccionar un proveedor para el producto."}), 400

        proveedor = db.query(Proveedor).get(int(id_proveedor))
        if not proveedor:
            return jsonify({"status": "error", "mensaje": "El proveedor seleccionado no existe."}), 404

        nuevo_p = Producto(
            codigoBarras=str(data['codigoBarras']).strip(),
            nombre=str(data['nombre']).strip(),
            precioVenta=float(data['precioVenta']),
            costoUnitario=float(data['costoUnitario']),
            stockMinimo=int(data.get('stockMinimo', 5)),
            esActivo=True,
            idCategoria=int(data.get('idCategoria', 1)),
            idProveedor=int(id_proveedor)
        )
        db.add(nuevo_p)
        db.commit()
        return jsonify({
            "status": "success",
            "mensaje": f"Producto '{nuevo_p.nombre}' creado y asociado a '{proveedor.razonSocial}'.",
            "idProducto": nuevo_p.idProducto
        }), 201
    except Exception as e:
        db.rollback()
        return jsonify({"status": "error", "mensaje": str(e)}), 400
    finally:
        db.close()


@catalogo_bp.route('/productos/<int:id_producto>/estado', methods=['PATCH'])
def cambiar_estado_producto(id_producto):
    """Habilita o deshabilita un producto sin eliminarlo de la base de datos."""
    data = request.json or {}
    db = SessionLocal()
    try:
        p = db.query(Producto).get(id_producto)
        if not p:
            return jsonify({"status": "error", "mensaje": "Producto no encontrado"}), 404

        nuevo_estado = bool(data.get('esActivo'))
        p.esActivo = nuevo_estado
        db.commit()

        accion_txt = "habilitado" if nuevo_estado else "deshabilitado"
        return jsonify({
            "status": "success",
            "mensaje": f"Producto '{p.nombre}' {accion_txt} correctamente.",
            "esActivo": p.esActivo
        }), 200
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
                    "idProveedor": p.idProveedor,
                    "proveedorNombre": p.proveedor.razonSocial if p.proveedor else "Sin proveedor",
                    "cantidadDisponible": s.cantidadDisponible
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


# --- GESTIÓN DE STOCK (PEDIDO A PROVEEDORES EN CD / ASIGNACIÓN EN SUCURSAL) ---
@catalogo_bp.route('/establecimientos/<int:id_establecimiento>/stock', methods=['POST'])
def agregar_o_actualizar_stock_establecimiento(id_establecimiento):
    data = request.json or {}
    id_producto = data.get('idProducto')
    cantidad = int(data.get('cantidadDisponible', 0))

    if cantidad <= 0:
        return jsonify({"status": "error", "mensaje": "La cantidad debe ser mayor a 0."}), 400

    db = SessionLocal()
    try:
        est = db.query(Establecimiento).get(id_establecimiento)
        if not est:
            return jsonify({"status": "error", "mensaje": "Establecimiento no encontrado"}), 404

        if est.tipo != 'centro_distribucion':
            return jsonify({
                "status": "error",
                "mensaje": "No se puede asignar stock directamente a una sucursal. El ingreso se realiza mediante bultos verificados en Logística."
            }), 400

        prod = db.query(Producto).get(id_producto)
        if not prod:
            return jsonify({"status": "error", "mensaje": "Producto no encontrado"}), 404

        if prod.esActivo is False:
            return jsonify({
                "status": "error",
                "mensaje": f"El producto '{prod.nombre}' está DESHABILITADO. Habilítelo antes de operar."
            }), 400

        stock_item = db.query(StockItem).filter(
            StockItem.idEstablecimiento == id_establecimiento,
            StockItem.idProducto == id_producto
        ).first()

        nombre_prov = prod.proveedor.razonSocial if prod.proveedor else "Proveedor asignado"
        if stock_item:
            stock_item.cantidadDisponible += cantidad
        else:
            stock_item = StockItem(
                idEstablecimiento=id_establecimiento,
                idProducto=id_producto,
                cantidadDisponible=cantidad
            )
            db.add(stock_item)

        db.commit()
        return jsonify({
            "status": "success",
            "mensaje": (
                f"Pedido a '{nombre_prov}' registrado: se sumaron +{cantidad} u. de '{prod.nombre}' "
                f"al stock de {est.nombre} (Total actual: {stock_item.cantidadDisponible} u.)."
            ),
            "idStockItem": stock_item.idStockItem
        }), 200
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

@catalogo_bp.route('/establecimientos/<int:id_establecimiento>/pedido-masivo', methods=['POST'])
def registrar_pedido_masivo_proveedor(id_establecimiento):
    """
    Registra un pedido grande con múltiples productos hacia el Centro de Distribución,
    sumando las cantidades al StockItem de cada producto en una única transacción.
    """
    data = request.json or {}
    items = data.get('items', [])

    if not items or not isinstance(items, list):
        return jsonify({"status": "error", "mensaje": "Debe agregar al menos un producto al pedido."}), 400

    db = SessionLocal()
    try:
        est = db.query(Establecimiento).get(id_establecimiento)
        if not est:
            return jsonify({"status": "error", "mensaje": "Establecimiento no encontrado."}), 404

        if est.tipo != 'centro_distribucion':
            return jsonify({
                "status": "error",
                "mensaje": "Los pedidos a proveedores solo pueden registrarse en el Centro de Distribución."
            }), 400

        # Agrupar cantidades por idProducto por si viniera repetido
        cantidades_por_prod = {}
        for item in items:
            id_prod = int(item.get('idProducto', 0))
            cant = int(item.get('cantidad', 0))
            if id_prod <= 0 or cant <= 0:
                return jsonify({"status": "error", "mensaje": "Todos los renglones deben tener producto y cantidad mayor a 0."}), 400
            cantidades_por_prod[id_prod] = cantidades_por_prod.get(id_prod, 0) + cant

        total_unidades = 0
        for id_prod, cant in cantidades_por_prod.items():
            prod = db.query(Producto).get(id_prod)
            if not prod:
                db.rollback()
                return jsonify({"status": "error", "mensaje": f"El producto ID {id_prod} no existe."}), 404

            if prod.esActivo is False:
                db.rollback()
                return jsonify({
                    "status": "error",
                    "mensaje": f"El producto '{prod.nombre}' está DESHABILITADO. Quítelo del pedido antes de confirmar."
                }), 400

            stock_item = db.query(StockItem).filter(
                StockItem.idEstablecimiento == id_establecimiento,
                StockItem.idProducto == id_prod
            ).first()

            if stock_item:
                stock_item.cantidadDisponible += cant
            else:
                stock_item = StockItem(
                    idEstablecimiento=id_establecimiento,
                    idProducto=id_prod,
                    cantidadDisponible=cant
                )
                db.add(stock_item)

            total_unidades += cant

        db.commit()
        return jsonify({
            "status": "success",
            "mensaje": (
                f"Pedido registrado en {est.nombre}: se incorporaron {len(cantidades_por_prod)} producto(s) "
                f"({total_unidades} unidades en total) al stock del Centro de Distribución."
            )
        }), 200
    except Exception as e:
        db.rollback()
        return jsonify({"status": "error", "mensaje": str(e)}), 400
    finally:
        db.close()