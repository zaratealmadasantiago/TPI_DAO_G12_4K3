from sqlalchemy import Column, Integer, String, Float, Boolean, ForeignKey
from sqlalchemy.orm import relationship
from models.base import Base

class Establecimiento(Base):
    __tablename__ = 'establecimientos'

    idEstablecimiento = Column(Integer, primary_key=True, autoincrement=True)
    codigo = Column(String(50), nullable=False, unique=True)
    nombre = Column(String(100), nullable=False)
    direccion = Column(String(200), nullable=True)
    telefono = Column(String(50), nullable=True)
    esActivo = Column(Boolean, default=True)

    tipo = Column(String(50))  # Discriminador para herencia
    __mapper_args__ = {
        'polymorphic_identity': 'establecimiento',
        'polymorphic_on': tipo
    }

class CentroDistribucion(Establecimiento):
    __tablename__ = 'centros_distribucion'

    idEstablecimiento = Column(Integer, ForeignKey('establecimientos.idEstablecimiento'), primary_key=True)
    codigoOperativo = Column(String(50), nullable=False)

    __mapper_args__ = {
        'polymorphic_identity': 'centro_distribucion',
    }

class Sucursal(Establecimiento):
    __tablename__ = 'sucursales'

    idEstablecimiento = Column(Integer, ForeignKey('establecimientos.idEstablecimiento'), primary_key=True)
    numeroSucursal = Column(Integer, nullable=False)
    habilitadaVenta = Column(Boolean, default=True)

    __mapper_args__ = {
        'polymorphic_identity': 'sucursal',
    }

class Proveedor(Base):
    __tablename__ = 'proveedores'

    idProveedor = Column(Integer, primary_key=True, autoincrement=True)
    cuit = Column(String(20), nullable=False, unique=True)
    razonSocial = Column(String(100), nullable=False)
    telefonoContacto = Column(String(50), nullable=True)

    productos = relationship("Producto", back_populates="proveedor")

class Categoria(Base):
    __tablename__ = 'categorias'

    idCategoria = Column(Integer, primary_key=True, autoincrement=True)
    nombre = Column(String(100), nullable=False)
    descripcion = Column(String(255), nullable=True)

    productos = relationship("Producto", back_populates="categoria")

class Producto(Base):
    __tablename__ = 'productos'

    idProducto = Column(Integer, primary_key=True, autoincrement=True)
    codigoBarras = Column(String(50), nullable=False, unique=True)
    nombre = Column(String(100), nullable=False)
    precioVenta = Column(Float, nullable=False)
    costoUnitario = Column(Float, nullable=False)
    stockMinimo = Column(Integer, default=0)

    idCategoria = Column(Integer, ForeignKey('categorias.idCategoria'), nullable=True)
    idProveedor = Column(Integer, ForeignKey('proveedores.idProveedor'), nullable=True)

    categoria = relationship("Categoria", back_populates="productos")
    proveedor = relationship("Proveedor", back_populates="productos")
    stock_items = relationship("StockItem", back_populates="producto")

class StockItem(Base):
    __tablename__ = 'stock_items'

    idStockItem = Column(Integer, primary_key=True, autoincrement=True)
    cantidadDisponible = Column(Integer, default=0)
    cantidadReservada = Column(Integer, default=0)

    idProducto = Column(Integer, ForeignKey('productos.idProducto'), nullable=False)
    idEstablecimiento = Column(Integer, ForeignKey('establecimientos.idEstablecimiento'), nullable=False)

    producto = relationship("Producto", back_populates="stock_items")
    establecimiento = relationship("Establecimiento")