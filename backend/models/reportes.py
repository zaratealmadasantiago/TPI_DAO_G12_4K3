from datetime import datetime, timedelta
from models.catalogo import Producto, StockItem
from models.logistica import Remito, Bulto, CambioEstado, EstadoBulto
from models.ventas import Venta, DetalleVenta

NOMBRES_MEDIO_PAGO = {
    'efectivo': 'Efectivo',
    'tarjeta_credito': 'Tarjeta de Crédito',
    'transferencia': 'Transferencia',
}


def _parse_fecha(texto, fin_de_dia=False):
    """Convierte 'YYYY-MM-DD' a datetime. Si es fecha 'hasta', incluye todo ese día."""
    if not texto:
        return None
    fecha = datetime.strptime(texto, '%Y-%m-%d')
    return fecha + timedelta(days=1) if fin_de_dia else fecha


def _fmt(dt):
    return dt.strftime('%d/%m/%Y %H:%M') if dt else None


class GeneradorReportes:
    """
    Clase Controller / Service encargada de la lectura y procesamiento de consultas
    para emitir los reportes requeridos.
    """
    def __init__(self, db_session):
        self.db = db_session

    def _filtrar_ventas(self, query, fechaDesde=None, fechaHasta=None, idSucursal=None):
        desde = _parse_fecha(fechaDesde)
        hasta = _parse_fecha(fechaHasta, fin_de_dia=True)
        if desde:
            query = query.filter(Venta.fechaHora >= desde)
        if hasta:
            query = query.filter(Venta.fechaHora < hasta)
        if idSucursal:
            query = query.filter(Venta.idSucursal == idSucursal)
        return query

    # 1. Ventas e ingresos por período, local y medio de pago
    def reporteVentasPorPeriodo(self, fechaDesde=None, fechaHasta=None, idSucursal=None):
        ventas = self._filtrar_ventas(self.db.query(Venta), fechaDesde, fechaHasta, idSucursal).all()

        por_sucursal = {}
        por_medio = {}
        total_vendido = 0.0
        total_devuelto = 0.0

        for v in ventas:
            total_vendido += v.total
            devuelto = sum(d.montoDevuelto for d in v.devoluciones)
            total_devuelto += devuelto

            nombre_suc = v.sucursal.nombre if v.sucursal else f"Sucursal {v.idSucursal}"
            fila = por_sucursal.setdefault(nombre_suc, {"sucursal": nombre_suc, "cantidadVentas": 0, "totalVendido": 0.0, "totalDevuelto": 0.0})
            fila["cantidadVentas"] += 1
            fila["totalVendido"] += v.total
            fila["totalDevuelto"] += devuelto

            for mp in v.medios_pago:
                nombre_mp = NOMBRES_MEDIO_PAGO.get(mp.tipo, mp.tipo)
                fila_mp = por_medio.setdefault(nombre_mp, {"medioPago": nombre_mp, "cantidadPagos": 0, "totalCobrado": 0.0})
                fila_mp["cantidadPagos"] += 1
                fila_mp["totalCobrado"] += mp.monto

        for fila in por_sucursal.values():
            fila["ingresoNeto"] = fila["totalVendido"] - fila["totalDevuelto"]

        return {
            "resumen": {
                "cantidadVentas": len(ventas),
                "totalVendido": total_vendido,
                "totalDevuelto": total_devuelto,
                "ingresoNeto": total_vendido - total_devuelto,
            },
            "porSucursal": sorted(por_sucursal.values(), key=lambda f: f["totalVendido"], reverse=True),
            "porMedioPago": sorted(por_medio.values(), key=lambda f: f["totalCobrado"], reverse=True),
        }

    # 2. Productos más vendidos y margen de ganancia/pérdida estimado
    def reporteProductosMasVendidos(self, limite=10, fechaDesde=None, fechaHasta=None, idSucursal=None):
        query = self.db.query(DetalleVenta).join(Venta)
        detalles = self._filtrar_ventas(query, fechaDesde, fechaHasta, idSucursal).all()

        por_producto = {}
        for d in detalles:
            p = d.producto
            fila = por_producto.setdefault(p.idProducto, {
                "producto": p.nombre,
                "codigoBarras": p.codigoBarras,
                "cantidadVendida": 0,
                "ingresos": 0.0,
                "costo": 0.0,
            })
            fila["cantidadVendida"] += d.cantidad
            fila["ingresos"] += d.subtotal
            fila["costo"] += d.cantidad * p.costoUnitario

        filas = sorted(por_producto.values(), key=lambda f: f["cantidadVendida"], reverse=True)[:limite]
        for f in filas:
            f["margen"] = f["ingresos"] - f["costo"]
            f["margenPorcentaje"] = round(f["margen"] / f["ingresos"] * 100, 2) if f["ingresos"] else 0.0
        return filas

    # 3. Existencias actuales, valorización y productos en stock mínimo
    def reporteStockMinimo(self, idEstablecimiento=None, soloBajoMinimo=False):
        query = self.db.query(StockItem).join(Producto)
        if idEstablecimiento:
            query = query.filter(StockItem.idEstablecimiento == idEstablecimiento)

        items = []
        for s in query.all():
            p = s.producto
            bajo_minimo = s.cantidadDisponible <= (p.stockMinimo or 0)
            if soloBajoMinimo and not bajo_minimo:
                continue
            items.append({
                "establecimiento": s.establecimiento.nombre if s.establecimiento else "-",
                "producto": p.nombre,
                "cantidadDisponible": s.cantidadDisponible,
                "stockMinimo": p.stockMinimo,
                "bajoMinimo": bajo_minimo,
                "valorizacion": s.cantidadDisponible * p.costoUnitario,
            })

        items.sort(key=lambda i: (not i["bajoMinimo"], i["establecimiento"], i["producto"]))
        return {
            "resumen": {
                "totalUnidades": sum(i["cantidadDisponible"] for i in items),
                "valorizacionTotal": sum(i["valorizacion"] for i in items),
                "cantidadBajoMinimo": sum(1 for i in items if i["bajoMinimo"]),
            },
            "items": items,
        }

    # 4. Bultos rechazados y merma por rotura de precinto
    def reporteBultosRechazados(self):
        bultos = self.db.query(Bulto).join(EstadoBulto, Bulto.idEstadoActual == EstadoBulto.idEstado)\
            .filter(EstadoBulto.tipo == 'rechazado').all()

        filas = []
        for b in bultos:
            remito = b.remito
            detalles = remito.orden.detalles if (remito and remito.orden) else []
            cambio = self.db.query(CambioEstado).filter(
                CambioEstado.idBulto == b.idBulto,
                CambioEstado.esActual == True
            ).first()
            filas.append({
                "codigoBulto": b.codigoBulto,
                "numeroRemito": remito.numeroRemito if remito else "-",
                "destino": remito.destino.nombre if (remito and remito.destino) else "-",
                "precintoIntacto": b.precintoIntacto,
                "fechaRechazo": _fmt(cambio.fechaHoraInicio) if cambio else None,
                "unidades": sum(d.cantidadSolicitada for d in detalles),
                "valorMerma": sum(d.cantidadSolicitada * d.producto.costoUnitario for d in detalles),
            })

        return {
            "resumen": {
                "cantidadBultos": len(filas),
                "totalUnidades": sum(f["unidades"] for f in filas),
                "valorTotal": sum(f["valorMerma"] for f in filas),
            },
            "bultos": filas,
        }

    # 5. Tiempo promedio de tránsito CD -> locales (despacho hasta recepción)
    def reporteTiempoTransito(self):
        remitos = self.db.query(Remito).filter(
            Remito.fechaDespacho.isnot(None),
            Remito.fechaRecepcion.isnot(None)
        ).all()

        por_sucursal = {}
        total_horas = 0.0
        for r in remitos:
            horas = (r.fechaRecepcion - r.fechaDespacho).total_seconds() / 3600
            total_horas += horas
            nombre = r.destino.nombre if r.destino else f"Sucursal {r.idDestino}"
            fila = por_sucursal.setdefault(nombre, {"sucursal": nombre, "cantidadEnvios": 0, "horas": 0.0})
            fila["cantidadEnvios"] += 1
            fila["horas"] += horas

        filas = []
        for f in por_sucursal.values():
            filas.append({
                "sucursal": f["sucursal"],
                "cantidadEnvios": f["cantidadEnvios"],
                "promedioHoras": round(f["horas"] / f["cantidadEnvios"], 2),
            })
        filas.sort(key=lambda f: f["promedioHoras"], reverse=True)

        return {
            "promedioGeneralHoras": round(total_horas / len(remitos), 2) if remitos else 0.0,
            "cantidadEnvios": len(remitos),
            "porSucursal": filas,
        }
