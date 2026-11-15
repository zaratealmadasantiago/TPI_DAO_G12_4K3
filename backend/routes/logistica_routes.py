from flask import Blueprint, jsonify, request
from database import SessionLocal
from models import (
    OrdenReposicion, DetalleOrden, Remito, Bulto, EstadoBulto,
    PreparadoState, PrecintadoState, EnTransitoState, RecibidoState,
    VerificadoState, RechazadoState, CambioEstado,
    CentroDistribucion, Sucursal, StockItem, Producto
)
from datetime import datetime, timedelta
from sqlalchemy import func

logistica_bp = Blueprint('logistica', __name__, url_prefix='/api/v1/logistica')

intentos_fallidos_bulto = {}


def a_gmt3(dt):
    if not dt:
        return None
    return (dt - timedelta(hours=3)).strftime('%d/%m/%Y %H:%M:%S')


def obtener_o_crear_estado(db, tipo, nombre_default):
    est = db.query(EstadoBulto).filter(EstadoBulto.tipo == tipo).first()
    if not est:
        clases = {
            'preparado': PreparadoState,
            'precintado': PrecintadoState,
            'en_transito': EnTransitoState,
            'recibido': RecibidoState,
            'verificado': VerificadoState,
            'rechazado': RechazadoState,
        }
        cls = clases.get(tipo, EstadoBulto)
        est = cls(nombreEstado=nombre_default)
        db.add(est)
        db.flush()
    return est


def registrar_cambio_estado(db, bulto, nuevo_estado, es_inicial=False):
    db.query(CambioEstado).filter(
        CambioEstado.idBulto == bulto.idBulto,
        CambioEstado.esActual == True
    ).update({"esActual": False})

    bulto.estadoActual = nuevo_estado

    nuevo_cambio = CambioEstado(
        fechaHoraInicio=datetime.utcnow(),
        esActual=True,
        esInicial=es_inicial,
        bulto=bulto,
        estado=nuevo_estado
    )
    db.add(nuevo_cambio)

def reintegrar_stock_cd(db, bulto):
    """
    Devuelve al Centro de Distribución (idOrigen) las cantidades de los productos
    vinculados a la Orden de Reposición del Remito cuando el bulto es RECHAZADO.
    """
    if not bulto.remito or not bulto.remito.orden:
        return

    id_cd_origen = bulto.remito.idOrigen
    detalles = bulto.remito.orden.detalles

    for det in detalles:
        stock_cd = db.query(StockItem).filter(
            StockItem.idEstablecimiento == id_cd_origen,
            StockItem.idProducto == det.idProducto
        ).first()

        if stock_cd:
            stock_cd.cantidadDisponible += det.cantidadSolicitada
        else:
            nuevo_stock = StockItem(
                idEstablecimiento=id_cd_origen,
                idProducto=det.idProducto,
                cantidadDisponible=det.cantidadSolicitada,
                cantidadReservada=0
            )
            db.add(nuevo_stock)

# --- LISTAR ÓRDENES DE REPOSICIÓN ---
@logistica_bp.route('/ordenes-reposicion', methods=['GET'])
def listar_ordenes_reposicion():
    id_sucursal = request.args.get('idSucursal', type=int)
    id_cd = request.args.get('idCentroDistribucion', type=int)
    solo_pendientes = request.args.get('soloPendientes', type=int)

    db = SessionLocal()
    try:
        query = db.query(OrdenReposicion)
        if id_sucursal:
            query = query.filter(OrdenReposicion.idDestino == id_sucursal)
        if id_cd:
            query = query.filter(OrdenReposicion.idOrigen == id_cd)
        if solo_pendientes == 1:
            query = query.filter(OrdenReposicion.estado.in_(["Esperando Aprobación", "CREADA", "ESPERANDO", "PENDIENTE"]))

        ordenes = query.order_by(OrdenReposicion.idOrden.desc()).all()
        resultado = []

        for o in ordenes:
            detalles_data = []
            stock_suficiente_total = True

            for d in o.detalles:
                stock_cd = db.query(StockItem).filter(
                    StockItem.idEstablecimiento == o.idOrigen,
                    StockItem.idProducto == d.idProducto
                ).first()
                disp_cd = stock_cd.cantidadDisponible if stock_cd else 0
                diferencia = disp_cd - d.cantidadSolicitada
                if diferencia < 0:
                    stock_suficiente_total = False

                detalles_data.append({
                    "idDetalleOrden": d.idDetalleOrden,
                    "idProducto": d.idProducto,
                    "codigoBarras": d.producto.codigoBarras if d.producto else "-",
                    "productoNombre": d.producto.nombre if d.producto else "Producto",
                    "cantidadSolicitada": d.cantidadSolicitada,
                    "stockDisponibleCD": disp_cd,
                    "stockResultanteCD": diferencia,
                    "tieneStockSuficiente": diferencia >= 0
                })

            remito_asociado = o.remitos[0] if o.remitos else None

            resultado.append({
                "idOrden": o.idOrden,
                "numeroOrden": o.numeroOrden,
                "fechaSolicitud": a_gmt3(o.fechaSolicitud),
                "estado": o.estado,
                "idOrigen": o.idOrigen,
                "origen": o.origen.nombre if o.origen else "CD",
                "idDestino": o.idDestino,
                "destino": o.destino.nombre if o.destino else "Sucursal",
                "stockSuficienteTotal": stock_suficiente_total,
                "numeroRemito": remito_asociado.numeroRemito if remito_asociado else None,
                "estadoRemito": remito_asociado.estado if remito_asociado else None,
                "detalles": detalles_data
            })

        return jsonify({"status": "success", "datos": resultado}), 200
    finally:
        db.close()


# --- CREAR ORDEN DE REPOSICIÓN (ESTADO: "Esperando Aprobación") ---
@logistica_bp.route('/ordenes-reposicion', methods=['POST'])
def crear_orden_reposicion():
    data = request.json or {}
    id_destino = data.get('idDestino')
    detalles = data.get('detalles', [])

    if not id_destino or not detalles:
        return jsonify({"status": "error", "mensaje": "Debe seleccionar sucursal e ítems."}), 400

    db = SessionLocal()
    try:
        cd = db.query(CentroDistribucion).first()
        suc = db.query(Sucursal).get(id_destino)
        if not cd or not suc:
            return jsonify({"status": "error", "mensaje": "CD o Sucursal no encontrados."}), 404

        ultimo = db.query(OrdenReposicion).order_by(OrdenReposicion.idOrden.desc()).first()
        siguiente_num = (ultimo.idOrden + 1) if ultimo else 1
        numero_orden = f"ORD-{datetime.utcnow().year}-{siguiente_num:03d}"

        nueva_orden = OrdenReposicion(
            numeroOrden=numero_orden,
            fechaSolicitud=datetime.utcnow(),
            estado="Esperando Aprobación",
            idOrigen=cd.idEstablecimiento,
            idDestino=suc.idEstablecimiento
        )
        db.add(nueva_orden)
        db.flush()

        for item in detalles:
            det = DetalleOrden(
                idOrden=nueva_orden.idOrden,
                idProducto=int(item['idProducto']),
                cantidadSolicitada=int(item['cantidadSolicitada'])
            )
            db.add(det)

        db.commit()
        return jsonify({
            "status": "success",
            "mensaje": f"Orden de Reposición {numero_orden} creada en estado 'Esperando Aprobación'."
        }), 201
    except Exception as e:
        db.rollback()
        return jsonify({"status": "error", "mensaje": str(e)}), 500
    finally:
        db.close()


# --- CONFIRMAR ORDEN DE REPOSICIÓN EN CD -> RESTA STOCK CD + CREA REMITO Y BULTO INCREMENTALES ---
@logistica_bp.route('/ordenes-reposicion/<int:id_orden>/confirmar', methods=['POST'])
def confirmar_orden_reposicion(id_orden):
    db = SessionLocal()
    try:
        orden = db.query(OrdenReposicion).get(id_orden)
        if not orden:
            return jsonify({"status": "error", "mensaje": "Orden de reposición no encontrada."}), 404

        if orden.estado not in ("Esperando Aprobación", "CREADA", "ESPERANDO", "PENDIENTE"):
            return jsonify({
                "status": "error",
                "mensaje": f"La orden no puede confirmarse desde el estado '{orden.estado}'."
            }), 400

        # 1. Validar stock disponible en el Centro de Distribución (StockItem)
        stocks_a_descontar = []
        for det in orden.detalles:
            stock_cd = db.query(StockItem).filter(
                StockItem.idEstablecimiento == orden.idOrigen,
                StockItem.idProducto == det.idProducto
            ).first()
            disp = stock_cd.cantidadDisponible if stock_cd else 0
            if disp < det.cantidadSolicitada:
                nombre_prod = det.producto.nombre if det.producto else f"ID {det.idProducto}"
                return jsonify({
                    "status": "error",
                    "mensaje": f"Stock insuficiente en CD para '{nombre_prod}' (Disponible: {disp}, Solicitado: {det.cantidadSolicitada})."
                }), 400
            stocks_a_descontar.append((stock_cd, det.cantidadSolicitada))

        # 2. Efectiva resta de Stock al Centro de Distribución
        for stock_cd, cant in stocks_a_descontar:
            stock_cd.cantidadDisponible -= cant

        # 3. Actualizar estado correlativo de la OR
        orden.estado = "Confirmada"

        # 4. Incremento respecto al último ID de Remito
        max_id_remito = db.query(func.max(Remito.idRemito)).scalar() or 0
        siguiente_id_remito = max_id_remito + 1
        numero_remito = f"REM-001-{siguiente_id_remito:04d}"

        remito = Remito(
            numeroRemito=numero_remito,
            fechaEmision=datetime.utcnow(),
            estado="GENERADO",
            idOrden=orden.idOrden,
            idOrigen=orden.idOrigen,
            idDestino=orden.idDestino
        )
        db.add(remito)
        db.flush()

        # 5. Incremento respecto al último ID de Bulto y creación en estado "Preparado"
        max_id_bulto = db.query(func.max(Bulto.idBulto)).scalar() or 0
        siguiente_id_bulto = max_id_bulto + 1
        codigo_bulto = f"BUL-{1000 + siguiente_id_bulto}"

        estado_preparado = obtener_o_crear_estado(db, 'preparado', 'Preparado')

        bulto = Bulto(
            codigoBulto=codigo_bulto,
            codigoPrecinto="",
            precintoIntacto=True,
            idRemito=remito.idRemito,
            idEstadoActual=estado_preparado.idEstado
        )
        db.add(bulto)
        db.flush()

        registrar_cambio_estado(db, bulto, estado_preparado, es_inicial=True)
        db.commit()

        return jsonify({
            "status": "success",
            "mensaje": (
                f"Orden {orden.numeroOrden} confirmada. Se descontó el stock del CD y se generó "
                f"el Remito #{remito.idRemito} ({numero_remito}) con el Bulto #{bulto.idBulto} ({codigo_bulto}) en estado Preparado."
            )
        }), 200
    except Exception as e:
        db.rollback()
        return jsonify({"status": "error", "mensaje": str(e)}), 500
    finally:
        db.close()

# --- RECHAZAR ORDEN DE REPOSICIÓN EN CD (SIN MOVIMIENTO DE STOCK) ---
@logistica_bp.route('/ordenes-reposicion/<int:id_orden>/rechazar', methods=['POST'])
def rechazar_orden_reposicion(id_orden):
    db = SessionLocal()
    try:
        orden = db.query(OrdenReposicion).get(id_orden)
        if not orden:
            return jsonify({"status": "error", "mensaje": "Orden de reposición no encontrada."}), 404

        if orden.estado not in ("Esperando Aprobación", "CREADA", "ESPERANDO", "PENDIENTE"):
            return jsonify({
                "status": "error",
                "mensaje": f"La orden no puede rechazarse desde el estado '{orden.estado}'."
            }), 400

        orden.estado = "Rechazada"
        db.commit()

        return jsonify({
            "status": "success",
            "mensaje": f"Orden {orden.numeroOrden} rechazada. No se realizó ningún movimiento de stock en el CD."
        }), 200
    except Exception as e:
        db.rollback()
        return jsonify({"status": "error", "mensaje": str(e)}), 500
    finally:
        db.close()

# --- LISTAR BULTOS / REMITOS (CON PRODUCTOS DE SU OR Y TRAZABILIDAD) ---
@logistica_bp.route('/bultos', methods=['GET'])
def listar_bultos():
    db = SessionLocal()
    try:
        bultos = db.query(Bulto).order_by(Bulto.idBulto.desc()).all()
        resultado = []
        for b in bultos:
            rem = b.remito
            orden = rem.orden if rem else None
            origen_nombre = rem.origen.nombre if (rem and rem.origen) else "Sin Origen"
            destino_nombre = rem.destino.nombre if (rem and rem.destino) else "Sin Destino"
            fallos = intentos_fallidos_bulto.get(b.idBulto, 0)

            cambios_ordenados = sorted(b.historialEstados, key=lambda c: c.idCambioEstado)
            historial = []
            for idx, ce in enumerate(cambios_ordenados):
                siguiente_inicio = (
                    cambios_ordenados[idx + 1].fechaHoraInicio
                    if idx + 1 < len(cambios_ordenados)
                    else None
                )
                historial.append({
                    "idCambioEstado": ce.idCambioEstado,
                    "numeroOrden": orden.numeroOrden if orden else "SIN-OR",
                    "estado": ce.estado.nombreEstado if ce.estado else "-",
                    "tipoEstado": ce.estado.tipo if ce.estado else "-",
                    "fechaHoraInicio": a_gmt3(ce.fechaHoraInicio),
                    "fechaHoraFin": a_gmt3(siguiente_inicio),
                    "esInicial": ce.esInicial,
                    "esActual": ce.esActual
                })

            # Productos contenidos en el Remito/Bulto = mismos DetalleOrden de la OR
            productos_bulto = []
            if orden:
                for d in orden.detalles:
                    productos_bulto.append({
                        "codigoBarras": d.producto.codigoBarras if d.producto else "-",
                        "nombre": d.producto.nombre if d.producto else "Producto",
                        "cantidad": d.cantidadSolicitada
                    })

            resultado.append({
                "idBulto": b.idBulto,
                "codigoBulto": b.codigoBulto,
                "codigoPrecinto": b.codigoPrecinto,
                "precintoIntacto": b.precintoIntacto,
                "estadoPrecinto": "INTACTO" if b.precintoIntacto else "VIOLADO",
                "estadoActual": b.estadoActual.nombreEstado if b.estadoActual else "SIN_ESTADO",
                "estadoTipo": b.estadoActual.tipo if b.estadoActual else "",
                "idRemito": b.idRemito,
                "numeroRemito": rem.numeroRemito if rem else f"REM-{b.idRemito}",
                "estadoRemito": rem.estado if rem else "GENERADO",
                "idOrden": orden.idOrden if orden else None,
                "numeroOrden": orden.numeroOrden if orden else "SIN-OR",
                "estadoOrden": orden.estado if orden else "-",
                "idOrigen": rem.idOrigen if rem else None,
                "idDestino": rem.idDestino if rem else None,
                "origen": origen_nombre,
                "destino": destino_nombre,
                "intentosRestantes": max(0, 3 - fallos),
                "productos": productos_bulto,
                "historialEstados": historial
            })
        return jsonify({"status": "success", "datos": resultado}), 200
    finally:
        db.close()


# --- TRANSICIÓN 1 (SOLO CD): PREPARADO -> PRECINTADO ---
@logistica_bp.route('/bultos/<int:id_bulto>/asignar-precinto', methods=['POST'])
def asignar_precinto_bulto(id_bulto):
    data = request.json or {}
    codigo_precinto = (data.get('codigoPrecinto') or '').strip().upper()
    if not codigo_precinto:
        return jsonify({"status": "error", "mensaje": "Debe ingresar un código de precinto"}), 400

    db = SessionLocal()
    try:
        bulto = db.query(Bulto).get(id_bulto)
        if not bulto:
            return jsonify({"status": "error", "mensaje": "Bulto no encontrado"}), 404

        if not bulto.estadoActual or bulto.estadoActual.tipo != 'preparado':
            return jsonify({"status": "error", "mensaje": "Solo se puede asignar precinto en estado PREPARADO."}), 400

        estado_precintado = obtener_o_crear_estado(db, 'precintado', 'Precintado')
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


# --- TRANSICIÓN 2 (SOLO CD): PRECINTADO -> EN TRÁNSITO ---
@logistica_bp.route('/bultos/<int:id_bulto>/confirmar-envio', methods=['POST'])
def confirmar_envio_bulto(id_bulto):
    db = SessionLocal()
    try:
        bulto = db.query(Bulto).get(id_bulto)
        if not bulto:
            return jsonify({"status": "error", "mensaje": "Bulto no encontrado"}), 404

        if not bulto.estadoActual or bulto.estadoActual.tipo != 'precintado':
            return jsonify({"status": "error", "mensaje": "Solo se puede confirmar envío en estado PRECINTADO."}), 400

        estado_transito = obtener_o_crear_estado(db, 'en_transito', 'En Tránsito')
        if bulto.remito:
            bulto.remito.fechaDespacho = datetime.utcnow()

        registrar_cambio_estado(db, bulto, estado_transito)
        db.commit()

        return jsonify({
            "status": "success",
            "mensaje": "Envío confirmado desde Centro de Distribución. El bulto ahora está EN TRÁNSITO."
        }), 200
    except Exception as e:
        db.rollback()
        return jsonify({"status": "error", "mensaje": str(e)}), 500
    finally:
        db.close()


# --- TRANSICIÓN 3 (SOLO SUCURSAL): EN TRÁNSITO -> RECIBIDO ---
@logistica_bp.route('/bultos/<int:id_bulto>/confirmar-recepcion', methods=['POST'])
def confirmar_recepcion_bulto(id_bulto):
    db = SessionLocal()
    try:
        bulto = db.query(Bulto).get(id_bulto)
        if not bulto:
            return jsonify({"status": "error", "mensaje": "Bulto no encontrado"}), 404

        if not bulto.estadoActual or bulto.estadoActual.tipo != 'en_transito':
            return jsonify({"status": "error", "mensaje": "Solo se puede confirmar recepción en estado EN TRÁNSITO."}), 400

        estado_recibido = obtener_o_crear_estado(db, 'recibido', 'Recibido')
        if bulto.remito and not bulto.remito.fechaRecepcion:
            bulto.remito.fechaRecepcion = datetime.utcnow()

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


def acreditar_stock_sucursal(db, bulto):
    remito = bulto.remito
    if not remito or not remito.orden:
        return
    id_sucursal = remito.idDestino
    for det in remito.orden.detalles:
        stock_suc = db.query(StockItem).filter(
            StockItem.idEstablecimiento == id_sucursal,
            StockItem.idProducto == det.idProducto
        ).first()
        if stock_suc:
            stock_suc.cantidadDisponible += det.cantidadSolicitada
        else:
            nuevo_stock = StockItem(
                idEstablecimiento=id_sucursal,
                idProducto=det.idProducto,
                cantidadDisponible=det.cantidadSolicitada,
                cantidadReservada=0
            )
            db.add(nuevo_stock)


# --- TRANSICIÓN 4A: RECIBIDO -> VERIFICADO / RECHAZADO (Con 3 Oportunidades) ---
@logistica_bp.route('/bultos/<int:id_bulto>/verificar-precinto', methods=['POST'])
def verificar_precinto_bulto(id_bulto):
    data = request.json
    codigo_ingresado = (data.get('codigoPrecinto') or '').strip()

    db = SessionLocal()
    try:
        bulto = db.query(Bulto).get(id_bulto)
        if not bulto:
            return jsonify({"status": "error", "mensaje": "Bulto no encontrado"}), 404

        if bulto.estadoActual and bulto.estadoActual.tipo in ('verificado', 'rechazado'):
            return jsonify({"status": "error", "mensaje": "El bulto ya alcanzó un estado final."}), 400

        estado_verificado = db.query(EstadoBulto).filter(EstadoBulto.tipo == 'verificado').first()
        estado_rechazado = db.query(EstadoBulto).filter(EstadoBulto.tipo == 'rechazado').first()

        # 1. Código correcto y precinto intacto -> VERIFICADO + Acredita stock en Sucursal Destino
        if bulto.codigoPrecinto == codigo_ingresado and bulto.precintoIntacto:
            intentos_fallidos_bulto.pop(id_bulto, None)
            registrar_cambio_estado(db, bulto, estado_verificado)

            if bulto.remito:
                bulto.remito.estado = "DISPONIBLE"
                if bulto.remito.orden:
                    bulto.remito.orden.estado = "Entregada"
                    for det in bulto.remito.orden.detalles:
                        stock_suc = db.query(StockItem).filter(
                            StockItem.idEstablecimiento == bulto.remito.idDestino,
                            StockItem.idProducto == det.idProducto
                        ).first()
                        if stock_suc:
                            stock_suc.cantidadDisponible += det.cantidadSolicitada
                        else:
                            db.add(StockItem(
                                idEstablecimiento=bulto.remito.idDestino,
                                idProducto=det.idProducto,
                                cantidadDisponible=det.cantidadSolicitada,
                                cantidadReservada=0
                            ))

            db.commit()
            return jsonify({
                "status": "success",
                "mensaje": "Precinto verificado correctamente. El bulto pasó a VERIFICADO y el stock ingresó a la sucursal."
            }), 200

        # 2. Código incorrecto -> Sumar fallo y evaluar 3 oportunidades
        fallos = intentos_fallidos_bulto.get(id_bulto, 0) + 1
        intentos_fallidos_bulto[id_bulto] = fallos

        if fallos >= 3:
            bulto.precintoIntacto = False
            registrar_cambio_estado(db, bulto, estado_rechazado)

            if bulto.remito:
                bulto.remito.estado = "RECHAZADO"
                if bulto.remito.orden:
                    bulto.remito.orden.estado = "Rechazada"

            # Devolver los productos al Centro de Distribución
            reintegrar_stock_cd(db, bulto)

            db.commit()
            intentos_fallidos_bulto.pop(id_bulto, None)
            return jsonify({
                "status": "error",
                "mensaje": "Se agotaron las 3 oportunidades. El bulto pasó a RECHAZADO y los productos volvieron al stock del Centro de Distribución."
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


# --- TRANSICIÓN 4B: RECIBIDO -> RECHAZADO DIRECTO (Precinto Violado) ---
@logistica_bp.route('/bultos/<int:id_bulto>/rechazar-violado', methods=['POST'])
def rechazar_precinto_violado(id_bulto):
    db = SessionLocal()
    try:
        bulto = db.query(Bulto).get(id_bulto)
        if not bulto:
            return jsonify({"status": "error", "mensaje": "Bulto no encontrado"}), 404

        if bulto.estadoActual and bulto.estadoActual.tipo in ('verificado', 'rechazado'):
            return jsonify({"status": "error", "mensaje": "El bulto ya alcanzó un estado final."}), 400

        estado_rechazado = db.query(EstadoBulto).filter(EstadoBulto.tipo == 'rechazado').first()

        bulto.precintoIntacto = False
        intentos_fallidos_bulto.pop(id_bulto, None)

        registrar_cambio_estado(db, bulto, estado_rechazado)

        if bulto.remito:
            bulto.remito.estado = "RECHAZADO"
            if bulto.remito.orden:
                bulto.remito.orden.estado = "Rechazada"

        # Devolver los productos al Centro de Distribución
        reintegrar_stock_cd(db, bulto)

        db.commit()

        return jsonify({
            "status": "success",
            "mensaje": "Se confirmó la violación del precinto. El bulto pasó a RECHAZADO y los productos regresaron al stock del Centro de Distribución."
        }), 200
    except Exception as e:
        db.rollback()
        return jsonify({"status": "error", "mensaje": str(e)}), 500
    finally:
        db.close()