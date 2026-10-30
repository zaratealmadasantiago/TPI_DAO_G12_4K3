from flask import Blueprint, jsonify, request
from database import SessionLocal
from models import Bulto, EstadoBulto, CambioEstado
from datetime import datetime

logistica_bp = Blueprint('logistica', __name__, url_prefix='/api/v1/logistica')

@logistica_bp.route('/bultos/<int:id_bulto>/cambiar-estado', methods=['POST'])
def cambiar_estado_bulto(id_bulto):
    """
    Transiciona el estado del bulto y guarda el registro inmutable en CambioEstado (trazabilidad).
    """
    data = request.json
    id_nuevo_estado = data.get('idNuevoEstado')
    
    db = SessionLocal()
    try:
        bulto = db.query(Bulto).get(id_bulto)
        nuevo_estado = db.query(EstadoBulto).get(id_nuevo_estado)

        if not bulto or not nuevo_estado:
            return jsonify({"error": "Bulto o Estado no encontrado"}), 404

        # Marcar cambio de estado anterior en el historial
        db.query(CambioEstado).filter(CambioEstado.idBulto == id_bulto, CambioEstado.esActual == True).update({"esActual": False})

        # Actualizar estado actual del bulto
        bulto.idEstadoActual = nuevo_estado.idEstado

        # Crear nueva fila inmutable de CambioEstado
        nuevo_cambio = CambioEstado(
            fechaHoraInicio=datetime.utcnow(),
            esActual=True,
            esInicial=False,
            bulto=bulto,
            estado=nuevo_estado
        )
        db.add(nuevo_cambio)
        db.commit()

        return jsonify({"mensaje": f"Bulto {bulto.codigoBulto} actualizado a estado: {nuevo_estado.nombreEstado}"}), 200
    except Exception as e:
        db.rollback()
        return jsonify({"error": str(e)}), 500
    finally:
        db.close()