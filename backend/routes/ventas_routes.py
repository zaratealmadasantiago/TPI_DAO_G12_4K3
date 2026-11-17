from datetime import datetime
from flask import Blueprint, jsonify, request
from database import SessionLocal
from models import (
    Sucursal,
    Producto,
    StockItem,
    Venta,
    DetalleVenta,
    Efectivo,
    TarjetaCredito,
    Transferencia,
    Devolucion,
)
from patterns.strategy import crear_estrategia_pago

ventas_bp = Blueprint("ventas", __name__, url_prefix="/api/v1/ventas")


def _serializar_medio_pago(mp):
    base = {
        "idMedioPago": mp.idMedioPago,
        "tipo": mp.tipo,
        "monto": float(mp.monto or 0),
    }
    if mp.tipo == "efectivo":
        entregado = mp.montoEntregado if mp.montoEntregado is not None else mp.monto
        vuelto = mp.vuelto if mp.vuelto is not None else 0.0
        base["montoEntregado"] = float(entregado or 0)
        base["vuelto"] = float(vuelto or 0)
        base["detalle"] = f"Efectivo (Entregado: ${float(entregado or 0):.2f}, Vuelto: ${float(vuelto or 0):.2f})"
    elif mp.tipo == "tarjeta_credito":
        base["numeroTarjeta"] = mp.numeroTarjeta
        base["cuotas"] = mp.cuotas
        base["codigoAutorizacion"] = mp.codigoAutorizacion
        base["detalle"] = f"Tarjeta {mp.numeroTarjeta or ''} ({mp.cuotas or 1} cuota/s, Aut: {mp.codigoAutorizacion or '-'})"
    elif mp.tipo == "transferencia":
        base["cbuOrigen"] = mp.cbuOrigen
        base["comprobanteTransferencia"] = mp.comprobanteTransferencia
        base["detalle"] = f"Transferencia ({mp.cbuOrigen or '-'}, Comp: {mp.comprobanteTransferencia or '-'})"
    else:
        base["detalle"] = mp.tipo
    return base


def _serializar_venta(v):
    total_devuelto = sum(float(d.montoDevuelto or 0) for d in (v.devoluciones or []))
    saldo_devolucion_disponible = round(max(0.0, float(v.total or 0) - total_devuelto), 2)
    tiene_devolucion = len(v.devoluciones or []) > 0 and total_devuelto > 0

    if not tiene_devolucion:
        estado_devolucion = "-"
    elif total_devuelto >= float(v.total or 0) - 0.01:
        estado_devolucion = "Total"
    else:
        estado_devolucion = "Parcial"

    return {
        "idVenta": v.idVenta,
        "numeroComprobante": v.numeroComprobante,
        "fechaHora": v.fechaHora.strftime("%d/%m/%Y %H:%M") if v.fechaHora else "",
        "fechaHoraISO": v.fechaHora.isoformat() if v.fechaHora else "",
        "total": float(v.total or 0),
        "totalDevuelto": round(total_devuelto, 2),
        "montoDevuelto": round(total_devuelto, 2),
        "tieneDevolucion": tiene_devolucion,
        "estadoDevolucion": estado_devolucion,
        "saldoDevolucionDisponible": saldo_devolucion_disponible,
        "idSucursal": v.idSucursal,
        "sucursalNombre": v.sucursal.nombre if v.sucursal else f"Sucursal {v.idSucursal}",
        "detalles": [
            {
                "idDetalleVenta": d.idDetalleVenta,
                "idProducto": d.idProducto,
                "codigoBarras": d.producto.codigoBarras if d.producto else "-",
                "productoNombre": d.producto.nombre if d.producto else f"Producto {d.idProducto}",
                "cantidad": d.cantidad,
                "precioUnitario": float(d.precioUnitario or 0),
                "subtotal": float(d.subtotal or 0),
            }
            for d in (v.detalles or [])
        ],
        "mediosPago": [_serializar_medio_pago(mp) for mp in (v.medios_pago or [])],
        "devoluciones": [
            {
                "idDevolucion": dev.idDevolucion,
                "fechaHora": dev.fechaHora.strftime("%d/%m/%Y %H:%M") if dev.fechaHora else "",
                "motivo": dev.motivo,
                "montoDevuelto": float(dev.montoDevuelto or 0),
            }
            for dev in (v.devoluciones or [])
        ],
    }


def _generar_numero_comprobante(db, sucursal):
    ultimo = db.query(Venta).order_by(Venta.idVenta.desc()).first()
    siguiente_id = (ultimo.idVenta + 1) if ultimo else 1
    pto_venta = str(
        sucursal.numeroSucursal
        if sucursal and getattr(sucursal, "numeroSucursal", None)
        else (sucursal.idEstablecimiento if sucursal else 1)
    ).zfill(4)
    return f"FAC-{pto_venta}-{str(siguiente_id).zfill(8)}"


# --- 1. LISTAR VENTAS (FILTRABLE POR SUCURSAL) ---
@ventas_bp.route("/", methods=["GET"])
def listar_ventas():
    id_sucursal = request.args.get("idSucursal", type=int)
    db = SessionLocal()
    try:
        query = db.query(Venta).order_by(Venta.idVenta.desc())
        if id_sucursal:
            query = query.filter(Venta.idSucursal == id_sucursal)

        ventas = query.all()
        resultado = [_serializar_venta(v) for v in ventas]
        return jsonify({"status": "success", "datos": resultado}), 200
    finally:
        db.close()


# --- 2. REGISTRAR VENTA (AUTOGENERA COMPROBANTE + PATRÓN STRATEGY) ---
@ventas_bp.route("/", methods=["POST"])
def registrar_venta():
    data = request.json or {}
    db = SessionLocal()
    try:
        id_sucursal = data.get("idSucursal")
        if not id_sucursal:
            return jsonify({"status": "error", "mensaje": "Debe seleccionar una sucursal válida."}), 400

        sucursal = db.query(Sucursal).get(int(id_sucursal))
        if not sucursal:
            return jsonify({"status": "error", "mensaje": "La sucursal indicada no existe."}), 404

        detalles_req = data.get("detalles", [])
        pagos_req = data.get("pagos", [])

        if not detalles_req:
            return jsonify({"status": "error", "mensaje": "Debe agregar al menos un producto a la venta."}), 400

        if not pagos_req or len(pagos_req) > 3:
            return jsonify({"status": "error", "mensaje": "Debe ingresar entre 1 y 3 medios de pago."}), 400

        # Validar stock disponible y calcular total real
        total_venta = 0.0
        items_validados = []

        for item in detalles_req:
            id_prod = int(item["idProducto"])
            cant = int(item["cantidad"])
            precio = float(item["precioUnitario"])

            if cant <= 0:
                return jsonify({"status": "error", "mensaje": "La cantidad debe ser mayor a 0."}), 400

            producto = db.query(Producto).get(id_prod)
            if not producto:
                return jsonify({"status": "error", "mensaje": f"Producto ID {id_prod} no encontrado."}), 404

            stock = db.query(StockItem).filter(
                StockItem.idProducto == id_prod,
                StockItem.idEstablecimiento == int(id_sucursal),
            ).first()

            disp = stock.cantidadDisponible if stock else 0
            if cant > disp:
                return jsonify({
                    "status": "error",
                    "mensaje": f"Stock insuficiente para '{producto.nombre}'. Disponible: {disp} u."
                }), 400

            subtotal = round(cant * precio, 2)
            total_venta = round(total_venta + subtotal, 2)
            items_validados.append((producto, stock, cant, precio, subtotal))

        # Validar suma de medios de pago
        suma_pagos = round(sum(float(p.get("monto", 0)) for p in pagos_req), 2)
        if suma_pagos > total_venta + 0.01:
            return jsonify({
                "status": "error",
                "mensaje": f"La suma de los medios de pago (${suma_pagos:.2f}) no puede superar el total (${total_venta:.2f})."
            }), 400

        if abs(suma_pagos - total_venta) > 0.01:
            return jsonify({
                "status": "error",
                "mensaje": f"Los medios de pago (${suma_pagos:.2f}) deben cubrir exactamente el total (${total_venta:.2f})."
            }), 400

        numero_comprobante = (data.get("numeroComprobante") or "").strip() or _generar_numero_comprobante(db, sucursal)

        nueva_venta = Venta(
            numeroComprobante=numero_comprobante,
            fechaHora=datetime.now(),
            idSucursal=int(id_sucursal),
            total=total_venta,
        )
        db.add(nueva_venta)
        db.flush()

        for producto, stock, cant, precio, subtotal in items_validados:
            detalle = DetalleVenta(
                venta=nueva_venta,
                idProducto=producto.idProducto,
                cantidad=cant,
                precioUnitario=precio,
                subtotal=subtotal,
            )
            db.add(detalle)
            stock.cantidadDisponible = max(0, stock.cantidadDisponible - cant)

        comprobantes_pago = []

        for pago_info in pagos_req:
            tipo_pago = pago_info.get("tipo")
            monto = round(float(pago_info.get("monto", 0)), 2)

            if tipo_pago == "efectivo":
                entregado = round(float(pago_info.get("montoEntregado") or monto), 2)
                if entregado < monto - 0.01:
                    raise ValueError(f"En Efectivo, el monto entregado (${entregado:.2f}) no puede ser menor al importe (${monto:.2f}).")
                vuelto = round(max(0.0, entregado - monto), 2)
                pago = Efectivo(
                    monto=monto,
                    venta=nueva_venta,
                    montoEntregado=entregado,
                    vuelto=vuelto,
                )
                comprobantes_pago.append(
                    f"• Efectivo: ${monto:.2f} (Entregado: ${entregado:.2f} | Vuelto: ${vuelto:.2f})"
                )

            elif tipo_pago == "tarjeta_credito":
                cuotas = int(pago_info.get("cuotas", 1))
                planes_fijos = {
                    1: (0.0, "0,00%"),
                    3: (24.6, "284,00%"),
                    6: (33.8, "182,00%"),
                    12: (48.4, "117,00%"),
                }
                recargo_pct, cftea_txt = planes_fijos.get(cuotas, (0.0, "0,00%"))
                monto_interes = round(monto * recargo_pct / 100.0, 2)
                total_financiado = round(monto + monto_interes, 2)
                valor_cuota = round(total_financiado / max(1, cuotas), 2)

                if cuotas > 1:
                    modalidad_txt = (
                        f"{cuotas} cuotas de ${valor_cuota:.2f}/mes — "
                        f"Total Financiado: ${total_financiado:.2f} (CFTEA: {cftea_txt})"
                    )
                else:
                    modalidad_txt = f"1 cuota de ${valor_cuota:.2f} — Sin Interés (CFTEA: 0,00%)"

                auth_base = str(pago_info.get("codigoAutorizacion") or "AUT-000").strip()
                auth_final = auth_base if ("CFTEA" in auth_base) else f"{auth_base} ({modalidad_txt})"
                num_tarj = str(pago_info.get("numeroTarjeta") or "0000").strip()

                pago = TarjetaCredito(
                    monto=monto,
                    venta=nueva_venta,
                    numeroTarjeta=num_tarj,
                    cuotas=cuotas,
                    codigoAutorizacion=auth_final,
                )
                comprobantes_pago.append(
                    f"• Tarjeta Crédito (****-{num_tarj[-4:]}): Base ${monto:.2f} | {modalidad_txt} — Aut: {auth_base}"
                )

            elif tipo_pago == "transferencia":
                cbu = str(pago_info.get("cbuOrigen") or "").strip()
                comp = str(pago_info.get("comprobanteTransferencia") or "").strip()
                pago = Transferencia(
                    monto=monto,
                    venta=nueva_venta,
                    cbuOrigen=cbu,
                    comprobanteTransferencia=comp,
                )
                comprobantes_pago.append(
                    f"• Transferencia ({cbu}): ${monto:.2f} — Comp: {comp}"
                )
            else:
                return jsonify({"status": "error", "mensaje": f"Tipo de medio de pago inválido: {tipo_pago}"}), 400

            db.add(pago)

        db.commit()
        db.refresh(nueva_venta)

        return jsonify({
            "status": "success",
            "mensaje": f"Venta {nueva_venta.numeroComprobante} registrada con éxito.",
            "idVenta": nueva_venta.idVenta,
            "datos": _serializar_venta(nueva_venta),
            "comprobantesPago": comprobantes_pago,
        }), 201
    except Exception as e:
        db.rollback()
        return jsonify({"status": "error", "mensaje": str(e)}), 400
    finally:
        db.close()


# --- 3. LISTAR DEVOLUCIONES ---
@ventas_bp.route("/devoluciones", methods=["GET"])
def listar_devoluciones():
    id_sucursal = request.args.get("idSucursal", type=int)
    db = SessionLocal()
    try:
        query = db.query(Devolucion).join(Venta).order_by(Devolucion.idDevolucion.desc())
        if id_sucursal:
            query = query.filter(Venta.idSucursal == id_sucursal)

        devoluciones = query.all()
        resultado = [
            {
                "idDevolucion": d.idDevolucion,
                "fechaHora": d.fechaHora.strftime("%d/%m/%Y %H:%M") if d.fechaHora else "",
                "motivo": d.motivo,
                "montoDevuelto": float(d.montoDevuelto or 0),
                "idVenta": d.idVenta,
                "numeroComprobante": d.venta.numeroComprobante if d.venta else "-",
                "sucursalNombre": (
                    d.venta.sucursal.nombre if (d.venta and d.venta.sucursal) else "-"
                ),
            }
            for d in devoluciones
        ]
        return jsonify({"status": "success", "datos": resultado}), 200
    finally:
        db.close()


# --- 4. REGISTRAR DEVOLUCIÓN (VINCULADA A VENTA PREVIA + REINGRESO DE STOCK) ---
@ventas_bp.route("/devoluciones", methods=["POST"])
def registrar_devolucion():
    data = request.json or {}
    id_venta = data.get("idVenta")
    motivo = str(data.get("motivo") or "").strip()
    items_dev = data.get("items", [])
    reingresar_stock = bool(data.get("reingresarStock", True))

    if not id_venta:
        return jsonify({
            "status": "error",
            "mensaje": "Toda devolución debe estar vinculada obligatoriamente a una venta registrada.",
        }), 400
    if len(motivo) < 3:
        return jsonify({
            "status": "error",
            "mensaje": "Ingrese un motivo válido para la devolución (mínimo 3 caracteres).",
        }), 400

    db = SessionLocal()
    try:
        venta_origen = db.query(Venta).get(int(id_venta))
        if not venta_origen:
            return jsonify({
                "status": "error",
                "mensaje": "No se encontró la venta de origen especificada. No se aceptan devoluciones sin venta.",
            }), 404

        ya_devuelto = sum(float(d.montoDevuelto or 0) for d in (venta_origen.devoluciones or []))
        saldo_disponible = round(float(venta_origen.total or 0) - ya_devuelto, 2)

        if saldo_disponible <= 0:
            return jsonify({
                "status": "error",
                "mensaje": f"La venta {venta_origen.numeroComprobante} ya fue devuelta en su totalidad.",
            }), 400

        monto_devuelto = 0.0
        unidades_reingresadas = 0

        if items_dev and isinstance(items_dev, list):
            detalles_map = {d.idDetalleVenta: d for d in venta_origen.detalles}
            for it in items_dev:
                id_det = int(it.get("idDetalleVenta", 0))
                cant_dev = int(it.get("cantidad", 0))
                if cant_dev <= 0:
                    continue
                det = detalles_map.get(id_det)
                if not det:
                    return jsonify({
                        "status": "error",
                        "mensaje": f"El detalle ID {id_det} no pertenece a la venta {venta_origen.numeroComprobante}.",
                    }), 400
                if cant_dev > det.cantidad:
                    return jsonify({
                        "status": "error",
                        "mensaje": (
                            f"No puede devolver {cant_dev} u. de '{det.producto.nombre}' "
                            f"(solo se vendieron {det.cantidad} u.)."
                        ),
                    }), 400

                monto_devuelto = round(monto_devuelto + cant_dev * det.precioUnitario, 2)

                if reingresar_stock:
                    stock_item = db.query(StockItem).filter(
                        StockItem.idEstablecimiento == venta_origen.idSucursal,
                        StockItem.idProducto == det.idProducto,
                    ).first()
                    if stock_item:
                        stock_item.cantidadDisponible += cant_dev
                    else:
                        db.add(
                            StockItem(
                                idEstablecimiento=venta_origen.idSucursal,
                                idProducto=det.idProducto,
                                cantidadDisponible=cant_dev,
                            )
                        )
                    unidades_reingresadas += cant_dev
        else:
            monto_devuelto = round(float(data.get("montoDevuelto", 0)), 2)

        if monto_devuelto <= 0:
            return jsonify({
                "status": "error",
                "mensaje": "Debe seleccionar al menos una unidad o indicar un monto a devolver mayor a $0.",
            }), 400

        if monto_devuelto - saldo_disponible > 0.01:
            return jsonify({
                "status": "error",
                "mensaje": (
                    f"El monto a devolver (${monto_devuelto:.2f}) supera el saldo disponible "
                    f"de la venta (${saldo_disponible:.2f})."
                ),
            }), 400

        nueva_dev = Devolucion(
            idVenta=venta_origen.idVenta,
            fechaHora=datetime.now(),
            motivo=motivo,
            montoDevuelto=monto_devuelto,
        )
        db.add(nueva_dev)
        db.commit()

        extra_stock = (
            f" Se reingresaron {unidades_reingresadas} u. al stock de {venta_origen.sucursal.nombre}."
            if unidades_reingresadas > 0
            else ""
        )

        return jsonify({
            "status": "success",
            "mensaje": (
                f"Devolución registrada sobre {venta_origen.numeroComprobante} "
                f"por ${monto_devuelto:.2f}.{extra_stock}"
            ),
        }), 201
    except Exception as e:
        db.rollback()
        return jsonify({"status": "error", "mensaje": str(e)}), 400
    finally:
        db.close()