class GeneradorReportes:
    """
    Clase Controller / Service encargada de la lectura y procesamiento de consultas
    para emitir los reportes requeridos.
    """
    def __init__(self, db_session):
        self.db = db_session

    def reporteVentasPorPeriodo(self, fechaDesde, fechaHasta, idSucursal=None):
        pass

    def reporteProductosMasVendidos(self, limite=10):
        pass

    def reporteStockMinimo(self, idSucursal=None):
        pass

    def reporteBultosRechazados(self):
        pass