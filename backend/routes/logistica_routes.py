from flask import Blueprint, jsonify, request
from database import SessionLocal
from models import Bulto, EstadoBulto, CambioEstado
from datetime import datetime

logistica_bp = Blueprint('logistica', __name__, url_prefix='/api/v1/logistica')

@logistica_bp.route('/bultos', methods=['GET'])
def listar_bultos():
    db = SessionLocal()
    try:
        bultos = db.query(Bulto).all()
        resultado = [{
            "idBulto": b.idBulto,
            "codigoBulto": b.codigoBulto,
            "codigoPrecinto": b.codigoPrecinto,
            "precintoIntacto": b.precintoIntacto,
            "estadoActual": b.estadoActual.nombreEstado if b.estadoActual else "SIN_ESTADO",
            "idRemito": b.idRemito
        } for b in bultos]
        return jsonify({"status": "success", "datos": resultado}), 200
    finally:
        db.close()

@logistica_bp.route('/bultos/<int:id_bulto>/verificar-precinto', methods=['POST'])
def verificar_precinto_bulto(id_bulto):
    """
    Aplica la regla del Patrón State: Inspecciona el precinto.
    Si coincide y está intacto transiciona a 'Verificado'; si falla, pasa a 'Rechazado'.
    """
    data = request.json
    codigo_ingresado = data.get('codigoPrecinto')
    
    db = SessionLocal()
    try:
        bulto = db.query(Bulto).get(id_bulto)
        if not bulto:
            return jsonify({"status": "error", "mensaje": "Bulto no encontrado"}), 404

        # Obtener estados de la BD
        estado_verificado = db.query(EstadoBulto).filter(EstadoBulto.tipo == 'verificado').first()
        estado_rechazado = db.query(EstadoBulto).filter(EstadoBulto.tipo == 'rechazado').first()

        # Evaluación de regla de negocio
        if bulto.codigoPrecinto == codigo_ingresado and bulto.precintoIntacto:
            nuevo_estado = estado_verificado
            mensaje = "Precinto verificado correctamente. Bulto en estado VERIFICADO."
        else:
            bulto.precintoIntacto = False
            nuevo_estado = estado_rechazado
            mensaje = "Precinto violado o incorrecto. Bulto RECHAZADO."

        # Registrar trazabilidad inmutable (CambioEstado)
        db.query(CambioEstado).filter(CambioEstado.idBulto == id_bulto, CambioEstado.esActual == True).update({"esActual": False})
        
        bulto.estadoActual = nuevo_estado
        
        nuevo_cambio = CambioEstado(
            fechaHoraInicio=datetime.utcnow(),
            esActual=True,
            esInicial=False,
            bulto=bulto,
            estado=nuevo_estado
        )
        db.add(nuevo_cambio)
        db.commit()

        return jsonify({"status": "success", "mensaje": mensaje, "nuevoEstado": nuevo_estado.nombreEstado}), 200
    except Exception as e:
        db.rollback()
        return jsonify({"status": "error", "mensaje": str(e)}), 500
    finally:
        db.close()