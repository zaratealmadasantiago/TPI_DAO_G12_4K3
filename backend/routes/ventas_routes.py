from flask import Blueprint, jsonify, request
from database import SessionLocal
from models import Venta, DetalleVenta, Efectivo, TarjetaCredito, Transferencia, Devolucion, StockItem

ventas_bp = Blueprint('ventas', __name__, url_prefix='/api/v1/ventas')

@ventas_bp.route('/', methods=['GET'])
def listar_ventas():
    db = SessionLocal()
    try:
        ventas = db.query(Venta).all()
        resultado = [{
            "idVenta": v.idVenta,
            "numeroComprobante": v.numeroComprobante,
            "fechaHora": v.fechaHora.isoformat(),
            "total": v.total,
            "idSucursal": v.idSucursal
        } for v in ventas]
        return jsonify({"status": "success", "datos": resultado}), 200
    finally:
        db.close()

@ventas_bp.route('/', methods=['POST'])
def registrar_venta():
    """
    Registra una venta, descuenta del stock y aplica la estrategia de cobro correspondiente.
    """
    data = request.json
    db = SessionLocal()
    try:
        nueva_venta = Venta(
            numeroComprobante=data['numeroComprobante'],
            idSucursal=data['idSucursal'],
            total=data['total']
        )
        db.add(nueva_venta)
        db.flush()

        # Detalle de productos y actualización de stock
        for item in data.get('detalles', []):
            detalle = DetalleVenta(
                venta=nueva_venta,
                idProducto=item['idProducto'],
                cantidad=item['cantidad'],
                precioUnitario=item['precioUnitario'],
                subtotal=item['cantidad'] * item['precioUnitario']
            )
            db.add(detalle)
            
            # Descuenta del stockItem de la sucursal
            stock = db.query(StockItem).filter(
                StockItem.idProducto == item['idProducto'],
                StockItem.idEstablecimiento == data['idSucursal']
            ).first()
            if stock:
                stock.cantidadDisponible = max(0, stock.cantidadDisponible - item['cantidad'])

        # Patrón Strategy (Medio de Pago)
        pago_info = data.get('pago', {})
        tipo_pago = pago_info.get('tipo')
        monto = pago_info.get('monto', data['total'])

        if tipo_pago == 'efectivo':
            pago = Efectivo(monto=monto, venta=nueva_venta, montoEntregado=pago_info.get('montoEntregado'), vuelto=pago_info.get('vuelto', 0.0))
        elif tipo_pago == 'tarjeta_credito':
            pago = TarjetaCredito(monto=monto, venta=nueva_venta, numeroTarjeta=pago_info.get('numeroTarjeta'), cuotas=pago_info.get('cuotas', 1), codigoAutorizacion=pago_info.get('codigoAutorizacion', 'AUT-000'))
        elif tipo_pago == 'transferencia':
            pago = Transferencia(monto=monto, venta=nueva_venta, cbuOrigen=pago_info.get('cbuOrigen'), comprobanteTransferencia=pago_info.get('comprobanteTransferencia'))
        else:
            pago = Efectivo(monto=monto, venta=nueva_venta, montoEntregado=monto, vuelto=0.0)

        db.add(pago)
        db.commit()

        return jsonify({"status": "success", "mensaje": "Venta registrada con éxito", "idVenta": nueva_venta.idVenta}), 201
    except Exception as e:
        db.rollback()
        return jsonify({"status": "error", "mensaje": str(e)}), 400
    finally:
        db.close()

@ventas_bp.route('/devoluciones', methods=['POST'])
def registrar_devolucion():
    data = request.json
    db = SessionLocal()
    try:
        # Exige validar venta de origen previa
        venta_origen = db.query(Venta).get(data['idVenta'])
        if not venta_origen:
            return jsonify({"status": "error", "mensaje": "La venta de origen especificada no existe."}), 404

        nueva_dev = Devolucion(
            idVenta=venta_origen.idVenta,
            motivo=data['motivo'],
            montoDevuelto=float(data['montoDevuelto'])
        )
        db.add(nueva_dev)
        db.commit()

        return jsonify({"status": "success", "mensaje": "Devolución registrada exitosamente"}), 201
    except Exception as e:
        db.rollback()
        return jsonify({"status": "error", "mensaje": str(e)}), 400
    finally:
        db.close()