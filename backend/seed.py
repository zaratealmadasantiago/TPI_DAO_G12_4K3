import os
from datetime import datetime, timedelta
from database import SessionLocal, engine, DB_PATH
from models.base import Base
from models import (
    CentroDistribucion, Sucursal, Proveedor, Categoria, Producto, StockItem,
    OrdenReposicion, DetalleOrden, Remito, Bulto, CambioEstado,
    PreparadoState, PrecintadoState, EnTransitoState, VerificadoState, RechazadoState,
    Venta, DetalleVenta, Efectivo, TarjetaCredito, Transferencia, Devolucion
)

def reset_and_seed():
    print("Reseteando esquemas de la base de datos SQLite3...")
    
    # 1. Eliminar y recrear todas las tablas para garantizar limpieza
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    
    db = SessionLocal()

    try:
        print("Iniciando sembrado de datos en la BD...")

        # 1. Estados de Bulto (Patron State)
        e_preparado = PreparadoState(nombreEstado="Preparado")
        e_precintado = PrecintadoState(nombreEstado="Precintado")
        e_transito = EnTransitoState(nombreEstado="En Transito")
        e_verificado = VerificadoState(nombreEstado="Verificado")
        e_rechazado = RechazadoState(nombreEstado="Rechazado")
        db.add_all([e_preparado, e_precintado, e_transito, e_verificado, e_rechazado])
        db.flush()

        # 2. Centro de Distribucion UNICO
        cd1 = CentroDistribucion(codigo="CD01", nombre="CD Central Buenos Aires", direccion="Av. Corrientes 1000", telefono="011-4000-0001", codigoOperativo="CD-BA-01")
        db.add(cd1)

        # 3. Sucursales (7 filas)
        suc1 = Sucursal(codigo="SUC01", nombre="Sucursal Palermo", direccion="Av. Santa Fe 2500", telefono="011-5000-0001", numeroSucursal=101, habilitadaVenta=True)
        suc2 = Sucursal(codigo="SUC02", nombre="Sucursal Belgrano", direccion="Av. Cabildo 1800", telefono="011-5000-0002", numeroSucursal=102, habilitadaVenta=True)
        suc3 = Sucursal(codigo="SUC03", nombre="Sucursal Cordoba Centro", direccion="Peatonal San Martin 150", telefono="0351-500-0003", numeroSucursal=201, habilitadaVenta=True)
        suc4 = Sucursal(codigo="SUC04", nombre="Sucursal Rosario Centro", direccion="Peatonal Cordoba 800", telefono="0341-500-0004", numeroSucursal=301, habilitadaVenta=True)
        suc5 = Sucursal(codigo="SUC05", nombre="Sucursal Norte Cordoba", direccion="Av. Colon 5000", telefono="0351-400-0002", numeroSucursal=202, habilitadaVenta=True)
        suc6 = Sucursal(codigo="SUC06", nombre="Sucursal Cuyo Mendoza", direccion="Ruta 40 Km 12", telefono="0261-400-0003", numeroSucursal=401, habilitadaVenta=True)
        suc7 = Sucursal(codigo="SUC07", nombre="Sucursal Litoral Rosario", direccion="Av. Pellegrini 3000", telefono="0341-400-0004", numeroSucursal=302, habilitadaVenta=True)
        
        db.add_all([suc1, suc2, suc3, suc4, suc5, suc6, suc7])
        db.flush()

        # 4. Proveedores (4 filas)
        prov1 = Proveedor(cuit="30-11111111-8", razonSocial="Distribuidora Tech S.A.", telefonoContacto="011-1111-2222")
        prov2 = Proveedor(cuit="30-22222222-8", razonSocial="Logistica y Alimentos S.R.L.", telefonoContacto="011-3333-4444")
        prov3 = Proveedor(cuit="30-33333333-8", razonSocial="Comercial del Sur S.A.", telefonoContacto="0351-555-6666")
        prov4 = Proveedor(cuit="30-44444444-8", razonSocial="Importadora Global Corp", telefonoContacto="0341-777-8888")
        db.add_all([prov1, prov2, prov3, prov4])

        # 5. Categorias (4 filas)
        cat1 = Categoria(nombre="Electronica", descripcion="Articulos tecnologicos y gadgetry")
        cat2 = Categoria(nombre="Indumentaria", descripcion="Ropa deportiva y formal")
        cat3 = Categoria(nombre="Hogar", descripcion="Muebles y electrodomesticos pequenos")
        cat4 = Categoria(nombre="Bebidas", descripcion="Bebidas gaseosas y aperitivos")
        db.add_all([cat1, cat2, cat3, cat4])
        db.flush()

        # 6. Productos (4 filas)
        p1 = Producto(codigoBarras="7790001001", nombre="Smart TV 55", precioVenta=450000.0, costoUnitario=300000.0, stockMinimo=5, categoria=cat1, proveedor=prov1)
        p2 = Producto(codigoBarras="7790001002", nombre="Remera Deportiva", precioVenta=25000.0, costoUnitario=12000.0, stockMinimo=20, categoria=cat2, proveedor=prov2)
        p3 = Producto(codigoBarras="7790001003", nombre="Cafetera Express", precioVenta=120000.0, costoUnitario=75000.0, stockMinimo=8, categoria=cat3, proveedor=prov3)
        p4 = Producto(codigoBarras="7790001004", nombre="Pack Bebida Cola x 6", precioVenta=8500.0, costoUnitario=5000.0, stockMinimo=50, categoria=cat4, proveedor=prov4)
        db.add_all([p1, p2, p3, p4])
        db.flush()

        # 7. StockItems (Asignaciones de Stock a Sucursales y al unico CD)
        st1 = StockItem(cantidadDisponible=15, cantidadReservada=2, producto=p1, establecimiento=suc1)
        st2 = StockItem(cantidadDisponible=50, cantidadReservada=5, producto=p2, establecimiento=suc2)
        st3 = StockItem(cantidadDisponible=10, cantidadReservada=0, producto=p3, establecimiento=suc3)
        st4 = StockItem(cantidadDisponible=100, cantidadReservada=10, producto=p4, establecimiento=cd1) # Stock en CD central
        st5 = StockItem(cantidadDisponible=25, cantidadReservada=0, producto=p1, establecimiento=suc5)
        db.add_all([st1, st2, st3, st4, st5])

        # 8. Ordenes de Reposicion (Todas parten del unico CD Central cd1)
        ord1 = OrdenReposicion(numeroOrden="ORD-2026-001", fechaSolicitud=datetime.utcnow() - timedelta(days=5), estado="DESPACHADA", origen=cd1, destino=suc1)
        ord2 = OrdenReposicion(numeroOrden="ORD-2026-002", fechaSolicitud=datetime.utcnow() - timedelta(days=3), estado="EN_TRANSITO", origen=cd1, destino=suc3)
        ord3 = OrdenReposicion(numeroOrden="ORD-2026-003", fechaSolicitud=datetime.utcnow() - timedelta(days=1), estado="CREADA", origen=cd1, destino=suc2)
        ord4 = OrdenReposicion(numeroOrden="ORD-2026-004", fechaSolicitud=datetime.utcnow(), estado="CREADA", origen=cd1, destino=suc7)
        db.add_all([ord1, ord2, ord3, ord4])
        db.flush()

        # 9. Detalles de Orden (4 filas)
        do1 = DetalleOrden(cantidadSolicitada=10, orden=ord1, producto=p1)
        do2 = DetalleOrden(cantidadSolicitada=30, orden=ord2, producto=p2)
        do3 = DetalleOrden(cantidadSolicitada=15, orden=ord3, producto=p3)
        do4 = DetalleOrden(cantidadSolicitada=80, orden=ord4, producto=p4)
        db.add_all([do1, do2, do3, do4])

        # 10. Remitos (Todos despachados desde el unico CD Central cd1)
        rem1 = Remito(numeroRemito="REM-001-0001", fechaEmision=datetime.utcnow() - timedelta(days=4), origen=cd1, destino=suc1)
        rem2 = Remito(numeroRemito="REM-001-0002", fechaEmision=datetime.utcnow() - timedelta(days=2), origen=cd1, destino=suc3)
        rem3 = Remito(numeroRemito="REM-001-0003", fechaEmision=datetime.utcnow() - timedelta(days=1), origen=cd1, destino=suc2)
        rem4 = Remito(numeroRemito="REM-001-0004", fechaEmision=datetime.utcnow(), origen=cd1, destino=suc7)
        db.add_all([rem1, rem2, rem3, rem4])
        db.flush()

        # 11. Bultos (4 filas)
        b1 = Bulto(codigoBulto="BUL-1001", codigoPrecinto="PREC-A1", precintoIntacto=True, remito=rem1, estadoActual=e_verificado)
        b2 = Bulto(codigoBulto="BUL-1002", codigoPrecinto="PREC-A2", precintoIntacto=True, remito=rem2, estadoActual=e_transito)
        b3 = Bulto(codigoBulto="BUL-1003", codigoPrecinto="PREC-A3", precintoIntacto=False, remito=rem3, estadoActual=e_rechazado)
        b4 = Bulto(codigoBulto="BUL-1004", codigoPrecinto="PREC-A4", precintoIntacto=True, remito=rem4, estadoActual=e_preparado)
        db.add_all([b1, b2, b3, b4])
        db.flush()

        # 12. Historial de Cambios de Estado (4 filas)
        ce1 = CambioEstado(fechaHoraInicio=datetime.utcnow() - timedelta(days=4), esActual=False, esInicial=True, bulto=b1, estado=e_preparado)
        ce2 = CambioEstado(fechaHoraInicio=datetime.utcnow() - timedelta(days=2), esActual=True, esInicial=False, bulto=b1, estado=e_verificado)
        ce3 = CambioEstado(fechaHoraInicio=datetime.utcnow() - timedelta(days=1), esActual=True, esInicial=False, bulto=b2, estado=e_transito)
        ce4 = CambioEstado(fechaHoraInicio=datetime.utcnow() - timedelta(hours=12), esActual=True, esInicial=False, bulto=b3, estado=e_rechazado)
        db.add_all([ce1, ce2, ce3, ce4])

        # 13. Ventas (4 filas)
        v1 = Venta(numeroComprobante="FAC-001-0001", fechaHora=datetime.utcnow() - timedelta(days=2), total=475000.0, sucursal=suc1)
        v2 = Venta(numeroComprobante="FAC-001-0002", fechaHora=datetime.utcnow() - timedelta(days=1), total=25000.0, sucursal=suc1)
        v3 = Venta(numeroComprobante="FAC-002-0001", fechaHora=datetime.utcnow() - timedelta(hours=5), total=120000.0, sucursal=suc2)
        v4 = Venta(numeroComprobante="FAC-003-0001", fechaHora=datetime.utcnow(), total=17000.0, sucursal=suc3)
        db.add_all([v1, v2, v3, v4])
        db.flush()

        # 14. Detalles de Venta (4 filas)
        dv1 = DetalleVenta(cantidad=1, precioUnitario=450000.0, subtotal=450000.0, venta=v1, producto=p1)
        dv2 = DetalleVenta(cantidad=1, precioUnitario=25000.0, subtotal=25000.0, venta=v2, producto=p2)
        dv3 = DetalleVenta(cantidad=1, precioUnitario=120000.0, subtotal=120000.0, venta=v3, producto=p3)
        dv4 = DetalleVenta(cantidad=2, precioUnitario=8500.0, subtotal=17000.0, venta=v4, producto=p4)
        db.add_all([dv1, dv2, dv3, dv4])

        # 15. Medios de Pago (4 filas)
        mp1 = TarjetaCredito(monto=475000.0, venta=v1, numeroTarjeta="**** **** **** 1234", cuotas=6, codigoAutorizacion="AUTH-998811")
        mp2 = Efectivo(monto=25000.0, venta=v2, montoEntregado=30000.0, vuelto=5000.0)
        mp3 = Transferencia(monto=120000.0, venta=v3, cbuOrigen="0170000000001122334455", comprobanteTransferencia="TR-88771122")
        mp4 = Efectivo(monto=17000.0, venta=v4, montoEntregado=20000.0, vuelto=3000.0)
        db.add_all([mp1, mp2, mp3, mp4])

        # 16. Devoluciones (4 filas)
        dev1 = Devolucion(fechaHora=datetime.utcnow() - timedelta(days=1), motivo="Producto defectuoso de fabrica", montoDevuelto=450000.0, venta=v1)
        dev2 = Devolucion(fechaHora=datetime.utcnow() - timedelta(hours=10), motivo="Talle incorrecto", montoDevuelto=25000.0, venta=v2)
        dev3 = Devolucion(fechaHora=datetime.utcnow() - timedelta(hours=2), motivo="Empaque danado", montoDevuelto=120000.0, venta=v3)
        dev4 = Devolucion(fechaHora=datetime.utcnow(), motivo="Arrepentimiento de compra", montoDevuelto=17000.0, venta=v4)
        db.add_all([dev1, dev2, dev3, dev4])

        db.commit()
        print("Sembrado completado con exito! Se cargaron 1 Centro de Distribucion y 7 Sucursales en datos.sqlite3.")

    except Exception as e:
        db.rollback()
        print(f"Error durante el sembrado de datos: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    reset_and_seed()