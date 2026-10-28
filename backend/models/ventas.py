from sqlalchemy import Column, Integer, String, Float, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from models.base import Base

class Venta(Base):
    __tablename__ = 'ventas'

    idVenta = Column(Integer, primary_key=True, autoincrement=True)
    numeroComprobante = Column(String(50), nullable=False, unique=True)
    fechaHora = Column(DateTime, default=datetime.utcnow)
    total = Column(Float, default=0.0)

    idSucursal = Column(Integer, ForeignKey('sucursales.idEstablecimiento'), nullable=False)

    sucursal = relationship("Sucursal")
    detalles = relationship("DetalleVenta", back_populates="venta", cascade="all, delete-orphan")
    medios_pago = relationship("MedioPago", back_populates="venta", cascade="all, delete-orphan")
    devoluciones = relationship("Devolucion", back_populates="venta")

class DetalleVenta(Base):
    __tablename__ = 'detalles_venta'

    idDetalleVenta = Column(Integer, primary_key=True, autoincrement=True)
    cantidad = Column(Integer, nullable=False)
    precioUnitario = Column(Float, nullable=False)
    subtotal = Column(Float, nullable=False)

    idVenta = Column(Integer, ForeignKey('ventas.idVenta'), nullable=False)
    idProducto = Column(Integer, ForeignKey('productos.idProducto'), nullable=False)

    venta = relationship("Venta", back_populates="detalles")
    producto = relationship("Producto")

# Patrón Strategy persistido mediante herencia
class MedioPago(Base):
    __tablename__ = 'medios_pago'

    idMedioPago = Column(Integer, primary_key=True, autoincrement=True)
    monto = Column(Float, nullable=False)

    idVenta = Column(Integer, ForeignKey('ventas.idVenta'), nullable=False)
    venta = relationship("Venta", back_populates="medios_pago")

    tipo = Column(String(50))
    __mapper_args__ = {
        'polymorphic_identity': 'medio_pago',
        'polymorphic_on': tipo
    }

class Efectivo(MedioPago):
    montoEntregado = Column(Float, nullable=True)
    vuelto = Column(Float, nullable=True)

    __mapper_args__ = {'polymorphic_identity': 'efectivo'}

class TarjetaCredito(MedioPago):
    numeroTarjeta = Column(String(20), nullable=True)
    cuotas = Column(Integer, nullable=True)
    codigoAutorizacion = Column(String(50), nullable=True)

    __mapper_args__ = {'polymorphic_identity': 'tarjeta_credito'}

class Transferencia(MedioPago):
    cbuOrigen = Column(String(30), nullable=True)
    comprobanteTransferencia = Column(String(50), nullable=True)

    __mapper_args__ = {'polymorphic_identity': 'transferencia'}

class Devolucion(Base):
    __tablename__ = 'devoluciones'

    idDevolucion = Column(Integer, primary_key=True, autoincrement=True)
    fechaHora = Column(DateTime, default=datetime.utcnow)
    motivo = Column(String(255), nullable=False)
    montoDevuelto = Column(Float, nullable=False)

    idVenta = Column(Integer, ForeignKey('ventas.idVenta'), nullable=False)
    venta = relationship("Venta", back_populates="devoluciones")