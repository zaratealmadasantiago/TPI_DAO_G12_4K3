from flask import Blueprint, jsonify, request
from database import SessionLocal
from models import Venta, DetalleVenta, Efectivo, TarjetaCredito, Transferencia

ventas_bp = Blueprint('ventas', __name__, url_prefix='/api/v1/ventas')

@ventas_bp.route('/', methods=['POST'])
def registrar_venta():
    """
    Registra una venta con sus detalles y su estrategia de cobro (MedioPago).
    """
    data = request.json
    db = SessionLocal()
    try:
        # 1. Crear Venta
        nueva_venta = Venta(
            numeroComprobante=data['numeroComprobante'],
            idSucursal=data['idSucursal'],
            total=data['total']
        )
        db.add(nueva_venta)
        db.flush()

        # 2. Crear DetalleVenta
        for item in data.get('detalles', []):
            detalle = DetalleVenta(
                venta=nueva_venta,
                idProducto=item['idProducto'],
                cantidad=item['cantidad'],
                precioUnitario=item['precioUnitario'],
                subtotal=item['cantidad'] * item['precioUnitario']
            )
            db.add(detalle)

        # 3. Aplicar Patrón Strategy para Pago
        pago_data = data.get('pago')
        tipo_pago = pago_data.get('tipo')
        monto = pago_data.get('monto')

        if tipo_pago == 'efectivo':
            pago = Efectivo(monto=monto, venta=nueva_venta, montoEntregado=pago_data.get('montoEntregado'), vuelto=pago_data.get('vuelto'))
        elif tipo_pago == 'tarjeta_credito':
            pago = TarjetaCredito(monto=monto, venta=nueva_venta, numeroTarjeta=pago_data.get('numeroTarjeta'), cuotas=pago_data.get('cuotas'), codigoAutorizacion=pago_data.get('codigoAutorizacion'))
        elif tipo_pago == 'transferencia':
            pago = Transferencia(monto=monto, venta=nueva_venta, cbuOrigen=pago_data.get('cbuOrigen'), comprobanteTransferencia=pago_data.get('comprobanteTransferencia'))
        
        db.add(pago)
        db.commit()

        return jsonify({"mensaje": "Venta registrada exitosamente", "idVenta": nueva_venta.idVenta}), 201
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 400
    finally:
        db.close()