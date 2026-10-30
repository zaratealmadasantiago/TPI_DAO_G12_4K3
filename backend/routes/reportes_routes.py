from flask import Blueprint, jsonify, request
from database import SessionLocal
from models import GeneradorReportes

reportes_bp = Blueprint('reportes', __name__, url_prefix='/api/v1/reportes')

@reportes_bp.route('/ventas', methods=['GET'])
def obtener_ventas_por_periodo():
    """
    Endpoint para consultar las ventas por periodo y opcionalmente por sucursal.
    Parámetros Query:
      - fecha_desde: str (Formato YYYY-MM-DD)
      - fecha_hasta: str (Formato YYYY-MM-DD)
      - id_sucursal: int (Opcional)
    """
    fecha_desde = request.args.get('fecha_desde')
    fecha_hasta = request.args.get('fecha_hasta')
    id_sucursal = request.args.get('id_sucursal', type=int)

    db = SessionLocal()
    try:
        generador = GeneradorReportes(db)
        reporte = generador.reporteVentasPorPeriodo(
            fechaDesde=fecha_desde, 
            fechaHasta=fecha_hasta, 
            idSucursal=id_sucursal
        )
        return jsonify({
            "status": "success",
            "tipo_reporte": "Ventas por Período",
            "datos": reporte
        }), 200
    except Exception as e:
        return jsonify({"status": "error", "mensaje": str(e)}), 500
    finally:
        db.close()


@reportes_bp.route('/productos-mas-vendidos', methods=['GET'])
def obtener_productos_mas_vendidos():
    """
    Endpoint para consultar los productos con mayor volumen de venta.
    Parámetros Query:
      - limite: int (Opcional, valor por defecto: 10)
    """
    limite = request.args.get('limite', default=10, type=int)

    db = SessionLocal()
    try:
        generador = GeneradorReportes(db)
        reporte = generador.reporteProductosMasVendidos(limite=limite)
        return jsonify({
            "status": "success",
            "tipo_reporte": "Productos Más Vendidos",
            "datos": reporte
        }), 200
    except Exception as e:
        return jsonify({"status": "error", "mensaje": str(e)}), 500
    finally:
        db.close()


@reportes_bp.route('/stock-minimo', methods=['GET'])
def obtener_stock_minimo():
    """
    Endpoint para obtener alertas de productos que alcanzaron o cayeron por debajo de su stock mínimo.
    Parámetros Query:
      - id_sucursal: int (Opcional)
    """
    id_sucursal = request.args.get('id_sucursal', type=int)

    db = SessionLocal()
    try:
        generador = GeneradorReportes(db)
        reporte = generador.reporteStockMinimo(idSucursal=id_sucursal)
        return jsonify({
            "status": "success",
            "tipo_reporte": "Alertas de Stock Mínimo",
            "datos": reporte
        }), 200
    except Exception as e:
        return jsonify({"status": "error", "mensaje": str(e)}), 500
    finally:
        db.close()


@reportes_bp.route('/bultos-rechazados', methods=['GET'])
def obtener_bultos_rechazados():
    """
    Endpoint de trazabilidad para listar los bultos rechazados por violaciones de precinto o inconsistencias.
    """
    db = SessionLocal()
    try:
        generador = GeneradorReportes(db)
        reporte = generador.reporteBultosRechazados()
        return jsonify({
            "status": "success",
            "tipo_reporte": "Bultos Rechazados (Trazabilidad)",
            "datos": reporte
        }), 200
    except Exception as e:
        return jsonify({"status": "error", "mensaje": str(e)}), 500
    finally:
        db.close()