from flask import Blueprint, jsonify, request
from database import SessionLocal
from models import GeneradorReportes

reportes_bp = Blueprint('reportes', __name__, url_prefix='/api/v1/reportes')


def ejecutar_reporte(funcion):
    """Abre la sesión, ejecuta el reporte con el GeneradorReportes y arma la respuesta."""
    db = SessionLocal()
    try:
        datos = funcion(GeneradorReportes(db))
        return jsonify({"status": "success", "datos": datos}), 200
    except ValueError:
        return jsonify({"status": "error", "mensaje": "Formato de fecha inválido (use AAAA-MM-DD)."}), 400
    except Exception as e:
        return jsonify({"status": "error", "mensaje": str(e)}), 500
    finally:
        db.close()


@reportes_bp.route('/ventas', methods=['GET'])
def reporte_ventas():
    return ejecutar_reporte(lambda g: g.reporteVentasPorPeriodo(
        request.args.get('fecha_desde'),
        request.args.get('fecha_hasta'),
        request.args.get('id_sucursal', type=int)
    ))


@reportes_bp.route('/productos-mas-vendidos', methods=['GET'])
def reporte_productos_mas_vendidos():
    return ejecutar_reporte(lambda g: g.reporteProductosMasVendidos(
        request.args.get('limite', default=10, type=int),
        request.args.get('fecha_desde'),
        request.args.get('fecha_hasta'),
        request.args.get('id_sucursal', type=int)
    ))


@reportes_bp.route('/stock', methods=['GET'])
def reporte_stock():
    return ejecutar_reporte(lambda g: g.reporteStockMinimo(
        request.args.get('id_establecimiento', type=int),
        request.args.get('solo_minimo') == '1'
    ))


@reportes_bp.route('/bultos-rechazados', methods=['GET'])
def reporte_bultos_rechazados():
    return ejecutar_reporte(lambda g: g.reporteBultosRechazados())


@reportes_bp.route('/tiempo-transito', methods=['GET'])
def reporte_tiempo_transito():
    return ejecutar_reporte(lambda g: g.reporteTiempoTransito())
