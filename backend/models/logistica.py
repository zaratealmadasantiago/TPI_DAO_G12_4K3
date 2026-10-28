from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from datetime import datetime
from models.base import Base

class OrdenReposicion(Base):
    __tablename__ = 'ordenes_reposicion'

    idOrden = Column(Integer, primary_key=True, autoincrement=True)
    numeroOrden = Column(String(50), nullable=False, unique=True)
    fechaSolicitud = Column(DateTime, default=datetime.utcnow)
    estado = Column(String(50), default="CREADA")

    idOrigen = Column(Integer, ForeignKey('centros_distribucion.idEstablecimiento'), nullable=False)
    idDestino = Column(Integer, ForeignKey('sucursales.idEstablecimiento'), nullable=False)

    origen = relationship("CentroDistribucion", foreign_keys=[idOrigen])
    destino = relationship("Sucursal", foreign_keys=[idDestino])
    detalles = relationship("DetalleOrden", back_populates="orden", cascade="all, delete-orphan")

class DetalleOrden(Base):
    __tablename__ = 'detalles_orden'

    idDetalleOrden = Column(Integer, primary_key=True, autoincrement=True)
    cantidadSolicitada = Column(Integer, nullable=False)

    idOrden = Column(Integer, ForeignKey('ordenes_reposicion.idOrden'), nullable=False)
    idProducto = Column(Integer, ForeignKey('productos.idProducto'), nullable=False)

    orden = relationship("OrdenReposicion", back_populates="detalles")
    producto = relationship("Producto")

class Remito(Base):
    __tablename__ = 'remitos'

    idRemito = Column(Integer, primary_key=True, autoincrement=True)
    numeroRemito = Column(String(50), nullable=False, unique=True)
    fechaEmision = Column(DateTime, default=datetime.utcnow)
    fechaDespacho = Column(DateTime, nullable=True)
    fechaRecepcion = Column(DateTime, nullable=True)

    idOrigen = Column(Integer, ForeignKey('centros_distribucion.idEstablecimiento'), nullable=False)
    idDestino = Column(Integer, ForeignKey('sucursales.idEstablecimiento'), nullable=False)

    origen = relationship("CentroDistribucion", foreign_keys=[idOrigen])
    destino = relationship("Sucursal", foreign_keys=[idDestino])
    bultos = relationship("Bulto", back_populates="remito", cascade="all, delete-orphan")

class Bulto(Base):
    __tablename__ = 'bultos'

    idBulto = Column(Integer, primary_key=True, autoincrement=True)
    codigoBulto = Column(String(50), nullable=False, unique=True)
    codigoPrecinto = Column(String(50), nullable=False)
    precintoIntacto = Column(Boolean, default=True)

    idRemito = Column(Integer, ForeignKey('remitos.idRemito'), nullable=False)
    idEstadoActual = Column(Integer, ForeignKey('estados_bulto.idEstado'), nullable=True)

    remito = relationship("Remito", back_populates="bultos")
    estadoActual = relationship("EstadoBulto", foreign_keys=[idEstadoActual])
    
    # Relación de trazabilidad con CambioEstado
    historialEstados = relationship("CambioEstado", back_populates="bulto", cascade="all, delete-orphan")

class EstadoBulto(Base):
    __tablename__ = 'estados_bulto'

    idEstado = Column(Integer, primary_key=True, autoincrement=True)
    nombreEstado = Column(String(50), nullable=False)

    tipo = Column(String(50))
    __mapper_args__ = {
        'polymorphic_identity': 'estado_bulto',
        'polymorphic_on': tipo
    }

class PreparadoState(EstadoBulto):
    __mapper_args__ = {'polymorphic_identity': 'preparado'}

class PrecintadoState(EstadoBulto):
    __mapper_args__ = {'polymorphic_identity': 'precintado'}

class EnTransitoState(EstadoBulto):
    __mapper_args__ = {'polymorphic_identity': 'en_transito'}

class RecibidoState(EstadoBulto):
    __mapper_args__ = {'polymorphic_identity': 'recibido'}

class VerificadoState(EstadoBulto):
    __mapper_args__ = {'polymorphic_identity': 'verificado'}

class RechazadoState(EstadoBulto):
    __mapper_args__ = {'polymorphic_identity': 'rechazado'}

# NUEVA ENTIDAD: Trazabilidad inmutable de transiciones de estado
class CambioEstado(Base):
    __tablename__ = 'cambios_estado'

    idCambioEstado = Column(Integer, primary_key=True, autoincrement=True)
    fechaHoraInicio = Column(DateTime, default=datetime.utcnow)
    esActual = Column(Boolean, default=True)
    esInicial = Column(Boolean, default=False)

    idBulto = Column(Integer, ForeignKey('bultos.idBulto'), nullable=False)
    idEstado = Column(Integer, ForeignKey('estados_bulto.idEstado'), nullable=False)

    bulto = relationship("Bulto", back_populates="historialEstados")
    estado = relationship("EstadoBulto")