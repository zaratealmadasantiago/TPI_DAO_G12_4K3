import re
from flask import Blueprint, jsonify, request
from database import SessionLocal
from models import Bulto, EstadoBulto, CambioEstado, OrdenReposicion, DetalleOrden, CentroDistribucion, Sucursal, Producto
from datetime import datetime, timezone, timedelta

logistica_bp = Blueprint('logistica', __name__, url_prefix='/api/v1/logistica')

GMT_MINUS_3 = timezone(timedelta(hours=-3))

def ahora_gmt3():
    return datetime.now(GMT_MINUS_3).replace(tzinfo=None)

intentos_fallidos_bulto = {}

def registrar_cambio_estado(db, bulto, nuevo_estado):
    """Cierra el estado anterior con fechaHoraFin (GMT-3) y crea el nuevo CambioEstado."""
    marca_tiempo = ahora_gmt3()

    db.query(CambioEstado).filter(
        CambioEstado.idBulto == bulto.idBulto,
        CambioEstado.esActual == True
    ).update({
        "esActual": False,
        "fechaHoraFin": marca_tiempo
    })

    bulto.estadoActual = nuevo_estado

    nuevo_cambio = CambioEstado(
        fechaHoraInicio=marca_tiempo,
        fechaHoraFin=None,
        esActual=True,
        esInicial=False,
        bulto=bulto,
        estado=nuevo_estado
    )
    db.add(nuevo_cambio)

@logistica_bp.route('/ordenes-reposicion', methods=['GET'])
def listar_ordenes_reposicion():
    id_sucursal = request.args.get('idSucursal', type=int)
    db = SessionLocal()
    try:
        query = db.query(OrdenReposicion)
        if id_sucursal:
            query = query.filter(OrdenReposicion.idDestino == id_sucursal)

        ordenes = query.order_by(OrdenReposicion.idOrden.desc()).all()
        resultado = []
        for o in ordenes:
            detalles_serializados = [
                {
                    "idDetalleOrden": d.idDetalleOrden,
                    "idProducto": d.idProducto,
                    "codigoBarras": d.producto.codigoBarras if d.producto else "-",
                    "productoNombre": d.producto.nombre if d.producto else "Producto eliminado",
                    "cantidadSolicitada": d.cantidadSolicitada
                }
                for d in o.detalles
            ]

            resultado.append({
                "idOrden": o.idOrden,
                "numeroOrden": o.numeroOrden,
                "fechaSolicitud": o.fechaSolicitud.strftime("%d/%m/%Y %H:%M:%S") if o.fechaSolicitud else "-",
                "idOrigen": o.idOrigen,
                "origen": o.origen.nombre if o.origen else "Sin Origen",
                "idDestino": o.idDestino,
                "destino": o.destino.nombre if o.destino else "Sin Destino",
                "detalles": detalles_serializados
            })

        return jsonify({"status": "success", "datos": resultado}), 200
    finally:
        db.close()


@logistica_bp.route('/ordenes-reposicion', methods=['POST'])
def crear_orden_reposicion():
    data = request.json or {}
    id_destino = data.get('idDestino')
    detalles = data.get('detalles', [])

    if not id_destino:
        return jsonify({"status": "error", "mensaje": "Debe seleccionar una sucursal de destino."}), 400
    if not detalles or len(detalles) == 0:
        return jsonify({"status": "error", "mensaje": "Debe agregar al menos un producto al detalle de la orden."}), 400

    db = SessionLocal()
    try:
        sucursal = db.query(Sucursal).get(id_destino)
        if not sucursal:
            return jsonify({"status": "error", "mensaje": "Sucursal no encontrada."}), 404

        cd = db.query(CentroDistribucion).first()
        if not cd:
            return jsonify({"status": "error", "mensaje": "No hay Centro de Distribución configurado."}), 400

        ahora = ahora_gmt3()
        ultimo = db.query(OrdenReposicion).order_by(OrdenReposicion.idOrden.desc()).first()
        siguiente_num = (ultimo.idOrden + 1) if ultimo else 1
        numero_orden = f"ORD-{ahora.year}-{siguiente_num:03d}"

        nueva_orden = OrdenReposicion(
            numeroOrden=numero_orden,
            fechaSolicitud=ahora,
            idOrigen=cd.idEstablecimiento,
            idDestino=sucursal.idEstablecimiento
        )
        db.add(nueva_orden)
        db.flush()

        for item in detalles:
            id_prod = item.get('idProducto')
            cant = int(item.get('cantidadSolicitada', 0))
            if id_prod and cant > 0:
                prod = db.query(Producto).get(id_prod)
                if prod:
                    det = DetalleOrden(
                        cantidadSolicitada=cant,
                        orden=nueva_orden,
                        producto=prod
                    )
                    db.add(det)

        db.commit()
        return jsonify({
            "status": "success",
            "mensaje": f"Orden de Reposición {numero_orden} generada correctamente para {sucursal.nombre}."
        }), 201
    except Exception as e:
        db.rollback()
        return jsonify({"status": "error", "mensaje": str(e)}), 500
    finally:
        db.close()

@logistica_bp.route('/bultos', methods=['GET'])
def listar_bultos():
    id_sucursal = request.args.get('idSucursal', type=int)
    db = SessionLocal()
    try:
        bultos = db.query(Bulto).all()
        resultado = []
        for b in bultos:
            id_destino_remito = b.remito.idDestino if b.remito else None
            if id_sucursal and id_destino_remito != id_sucursal:
                continue

            origen_nombre = b.remito.origen.nombre if (b.remito and b.remito.origen) else "Sin Origen"
            destino_nombre = b.remito.destino.nombre if (b.remito and b.remito.destino) else "Sin Destino"
            fallos = intentos_fallidos_bulto.get(b.idBulto, 0)

            cambios_ordenados = sorted(
                b.historialEstados,
                key=lambda c: (c.fechaHoraInicio or datetime.min, c.idCambioEstado)
            )

            historial_serializado = [
                {
                    "idCambioEstado": ce.idCambioEstado,
                    "estado": ce.estado.nombreEstado if ce.estado else "SIN_ESTADO",
                    "tipoEstado": ce.estado.tipo if ce.estado else "",
                    "fechaHoraInicio": ce.fechaHoraInicio.strftime("%d/%m/%Y %H:%M:%S") if ce.fechaHoraInicio else "-",
                    "fechaHoraFin": ce.fechaHoraFin.strftime("%d/%m/%Y %H:%M:%S") if ce.fechaHoraFin else "En curso",
                    "esInicial": ce.esInicial,
                    "esActual": ce.esActual
                }
                for ce in cambios_ordenados
            ]

            estado_precinto_texto = "INTACTO" if b.precintoIntacto else "VIOLADO"

            resultado.append({
                "idBulto": b.idBulto,
                "codigoBulto": b.codigoBulto,
                "precintoIntacto": b.precintoIntacto,
                "estadoPrecinto": estado_precinto_texto,
                "estadoActual": b.estadoActual.nombreEstado if b.estadoActual else "SIN_ESTADO",
                "estadoTipo": b.estadoActual.tipo if b.estadoActual else "",
                "idRemito": b.idRemito,
                "numeroRemito": b.remito.numeroRemito if b.remito else "-",
                "idDestino": id_destino_remito,
                "origen": origen_nombre,
                "destino": destino_nombre,
                "intentosRestantes": max(0, 3 - fallos),
                "historialEstados": historial_serializado
            })
        return jsonify({"status": "success", "datos": resultado}), 200
    finally:
        db.close()


@logistica_bp.route('/bultos/<int:id_bulto>/asignar-precinto', methods=['POST'])
def asignar_precinto_bulto(id_bulto):
    data = request.json
    codigo_precinto = (data.get('codigoPrecinto') or '').strip().upper()
    if not re.match(r'^[A-Z0-9-]{6,10}$', codigo_precinto):
        return jsonify({
            "status": "error",
            "mensaje": "El Codigo Precinto debe estar comprendido entre 6 y 10 caracteres a-z 0-9 -"
        }), 400

    db = SessionLocal()
    try:
        bulto = db.query(Bulto).get(id_bulto)
        if not bulto:
            return jsonify({"status": "error", "mensaje": "Bulto no encontrado"}), 404

        estado_precintado = db.query(EstadoBulto).filter(EstadoBulto.tipo == 'precintado').first()
        bulto.codigoPrecinto = codigo_precinto
        bulto.precintoIntacto = True

        registrar_cambio_estado(db, bulto, estado_precintado)
        db.commit()

        return jsonify({
            "status": "success",
            "mensaje": f"Precinto '{codigo_precinto}' asignado. El bulto ahora está PRECINTADO."
        }), 200
    except Exception as e:
        db.rollback()
        return jsonify({"status": "error", "mensaje": str(e)}), 500
    finally:
        db.close()


@logistica_bp.route('/bultos/<int:id_bulto>/confirmar-envio', methods=['POST'])
def confirmar_envio_bulto(id_bulto):
    db = SessionLocal()
    try:
        bulto = db.query(Bulto).get(id_bulto)
        if not bulto:
            return jsonify({"status": "error", "mensaje": "Bulto no encontrado"}), 404

        estado_transito = db.query(EstadoBulto).filter(EstadoBulto.tipo == 'en_transito').first()
        if bulto.remito and not bulto.remito.fechaDespacho:
            bulto.remito.fechaDespacho = ahora_gmt3()

        registrar_cambio_estado(db, bulto, estado_transito)
        db.commit()

        return jsonify({
            "status": "success",
            "mensaje": "Envío confirmado. El bulto ahora está EN TRÁNSITO."
        }), 200
    except Exception as e:
        db.rollback()
        return jsonify({"status": "error", "mensaje": str(e)}), 500
    finally:
        db.close()


@logistica_bp.route('/bultos/<int:id_bulto>/confirmar-recepcion', methods=['POST'])
def confirmar_recepcion_bulto(id_bulto):
    db = SessionLocal()
    try:
        bulto = db.query(Bulto).get(id_bulto)
        if not bulto:
            return jsonify({"status": "error", "mensaje": "Bulto no encontrado"}), 404

        estado_recibido = db.query(EstadoBulto).filter(EstadoBulto.tipo == 'recibido').first()
        if not estado_recibido:
            from models import RecibidoState
            estado_recibido = RecibidoState(nombreEstado="Recibido")
            db.add(estado_recibido)
            db.flush()

        if bulto.remito and not bulto.remito.fechaRecepcion:
            bulto.remito.fechaRecepcion = ahora_gmt3()

        registrar_cambio_estado(db, bulto, estado_recibido)
        db.commit()

        destino = bulto.remito.destino.nombre if (bulto.remito and bulto.remito.destino) else "la sucursal"
        return jsonify({
            "status": "success",
            "mensaje": f"Recepción confirmada en {destino}. El bulto pasó a estado RECIBIDO."
        }), 200
    except Exception as e:
        db.rollback()
        return jsonify({"status": "error", "mensaje": str(e)}), 500
    finally:
        db.close()


@logistica_bp.route('/bultos/<int:id_bulto>/verificar-precinto', methods=['POST'])
def verificar_precinto_bulto(id_bulto):
    data = request.json
    codigo_ingresado = (data.get('codigoPrecinto') or '').strip().upper()
    if not re.match(r'^[A-Z0-9-]{6,10}$', codigo_ingresado):
        return jsonify({
            "status": "error",
            "mensaje": "El Codigo Precinto debe estar comprendido entre 6 y 10 caracteres a-z 0-9 -"
        }), 400

    db = SessionLocal()
    try:
        bulto = db.query(Bulto).get(id_bulto)
        if not bulto:
            return jsonify({"status": "error", "mensaje": "Bulto no encontrado"}), 404

        estado_verificado = db.query(EstadoBulto).filter(EstadoBulto.tipo == 'verificado').first()
        estado_rechazado = db.query(EstadoBulto).filter(EstadoBulto.tipo == 'rechazado').first()

        if bulto.codigoPrecinto == codigo_ingresado and bulto.precintoIntacto:
            intentos_fallidos_bulto.pop(id_bulto, None)
            registrar_cambio_estado(db, bulto, estado_verificado)
            db.commit()
            return jsonify({
                "status": "success",
                "mensaje": "Precinto verificado correctamente. El bulto pasó a estado VERIFICADO."
            }), 200

        fallos = intentos_fallidos_bulto.get(id_bulto, 0) + 1
        intentos_fallidos_bulto[id_bulto] = fallos

        if fallos >= 3:
            bulto.precintoIntacto = False
            registrar_cambio_estado(db, bulto, estado_rechazado)
            db.commit()
            intentos_fallidos_bulto.pop(id_bulto, None)
            return jsonify({
                "status": "error",
                "mensaje": "Se agotaron las 3 oportunidades. El bulto pasó definitivamente a estado RECHAZADO."
            }), 200
        else:
            restantes = 3 - fallos
            return jsonify({
                "status": "warning",
                "mensaje": f"Código de precinto incorrecto. Le quedan {restantes} oportunidad(es) antes de rechazar el bulto."
            }), 200
    except Exception as e:
        db.rollback()
        return jsonify({"status": "error", "mensaje": str(e)}), 500
    finally:
        db.close()


@logistica_bp.route('/bultos/<int:id_bulto>/rechazar-violado', methods=['POST'])
def rechazar_precinto_violado(id_bulto):
    db = SessionLocal()
    try:
        bulto = db.query(Bulto).get(id_bulto)
        if not bulto:
            return jsonify({"status": "error", "mensaje": "Bulto no encontrado"}), 404

        estado_rechazado = db.query(EstadoBulto).filter(EstadoBulto.tipo == 'rechazado').first()

        bulto.precintoIntacto = False
        intentos_fallidos_bulto.pop(id_bulto, None)

        registrar_cambio_estado(db, bulto, estado_rechazado)
        db.commit()

        return jsonify({
            "status": "success",
            "mensaje": "Se ha confirmado la violación del precinto. El bulto pasó a estado RECHAZADO."
        }), 200
    except Exception as e:
        db.rollback()
        return jsonify({"status": "error", "mensaje": str(e)}), 500
    finally:
        db.close()