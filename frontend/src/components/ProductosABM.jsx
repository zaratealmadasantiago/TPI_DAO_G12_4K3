import React, { useState, useEffect } from 'react';
import { apiService } from '../api/apiService';

export default function ProductosABM() {
  const [establecimientos, setEstablecimientos] = useState([]);
  const [establecimientoSeleccionado, setEstablecimientoSeleccionado] = useState('');
  
  const [productosGlobales, setProductosGlobales] = useState([]);
  const [stockEstablecimiento, setStockEstablecimiento] = useState([]);

  // Formulario de asignación de stock local
  const [idProductoSeleccionado, setIdProductoSeleccionado] = useState('');
  const [cantidadStock, setCantidadStock] = useState(10);

  // Formulario para crear nuevo producto global
  const [formNuevoProd, setFormNuevoProd] = useState({
    codigoBarras: '',
    nombre: '',
    precioVenta: '',
    costoUnitario: '',
    stockMinimo: 5
  });

  useEffect(() => {
    cargarInicial();
  }, []);

  useEffect(() => {
    if (establecimientoSeleccionado) {
      cargarStockLocal(establecimientoSeleccionado);
    } else {
      setStockEstablecimiento([]);
    }
  }, [establecimientoSeleccionado]);

  const cargarInicial = async () => {
    const resEst = await apiService.getEstablecimientos();
    if (resEst && resEst.datos) {
      setEstablecimientos(resEst.datos);
      if (resEst.datos.length > 0) {
        setEstablecimientoSeleccionado(resEst.datos[0].idEstablecimiento);
      }
    }

    const resProd = await apiService.getProductos();
    if (resProd && resProd.datos) {
      setProductosGlobales(resProd.datos);
    }
  };

  const cargarStockLocal = async (idEst) => {
    const resStock = await apiService.getStockPorEstablecimiento(idEst);
    if (resStock && resStock.datos) {
      setStockEstablecimiento(resStock.datos);
    } else {
      setStockEstablecimiento([]);
    }
  };

  // Asignar o modificar stock de un producto en la sucursal/CD seleccionada
  const handleGuardarStockLocal = async (e) => {
    e.preventDefault();
    if (!establecimientoSeleccionado || !idProductoSeleccionado) {
      return alert("Seleccione un establecimiento y un producto");
    }

    const res = await apiService.guardarStockEstablecimiento(
      establecimientoSeleccionado,
      parseInt(idProductoSeleccionado),
      parseInt(cantidadStock)
    );

    if (res.status === 'success') {
      cargarStockLocal(establecimientoSeleccionado);
      setIdProductoSeleccionado('');
      setCantidadStock(10);
    } else {
      alert(res.mensaje || "Error al actualizar stock");
    }
  };

  // Quitar/Desvincular producto de la sucursal puntual
  const handleQuitarStockLocal = async (idStockItem) => {
    if (window.confirm("¿Desea quitar este producto de este establecimiento?")) {
      await apiService.quitarStockEstablecimiento(idStockItem);
      cargarStockLocal(establecimientoSeleccionado);
    }
  };

  // Crear producto en el catálogo general
  const handleCrearProductoGlobal = async (e) => {
    e.preventDefault();
    await apiService.crearProducto({
      ...formNuevoProd,
      precioVenta: parseFloat(formNuevoProd.precioVenta),
      costoUnitario: parseFloat(formNuevoProd.costoUnitario),
      stockMinimo: parseInt(formNuevoProd.stockMinimo)
    });
    setFormNuevoProd({ codigoBarras: '', nombre: '', precioVenta: '', costoUnitario: '', stockMinimo: 5 });
    cargarInicial();
  };

  // Eliminar producto globalmente
  const handleEliminarProductoGlobal = async (idProducto) => {
    if (window.confirm("¿Eliminar producto del catálogo global? Se eliminará de todas las sucursales.")) {
      await apiService.eliminarProducto(idProducto);
      cargarInicial();
    }
  };

  return (
    <div className="page">
      <h2 className="page-title">ABM - Gestión de Productos y Stock por Establecimiento</h2>

      {/* SECCIÓN 1: Selección de Sucursal / CD */}
      <section className="card">
        <div className="field-inline">
          <label htmlFor="sel-establecimiento">Seleccionar Sucursal o Centro de Distribución:</label>
          <select
            id="sel-establecimiento"
            className="select"
            value={establecimientoSeleccionado}
            onChange={e => setEstablecimientoSeleccionado(e.target.value)}
          >
            {establecimientos.map(est => (
              <option key={est.idEstablecimiento} value={est.idEstablecimiento}>
                [{est.tipo.toUpperCase()}] {est.nombre} ({est.codigo})
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* SECCIÓN 2: Agregar/Modificar Productos en la Sucursal/CD Elegida */}
      {establecimientoSeleccionado && (
        <section className="card">
          <h3 className="card-title">Asignar / Actualizar Stock en este Establecimiento</h3>
          <form onSubmit={handleGuardarStockLocal} className="form-row">
            <select
              className="select grow"
              value={idProductoSeleccionado}
              onChange={e => setIdProductoSeleccionado(e.target.value)}
              required
            >
              <option value="">-- Seleccionar Producto del Catálogo --</option>
              {productosGlobales.map(p => (
                <option key={p.idProducto} value={p.idProducto}>
                  {p.nombre} (Cód: {p.codigoBarras})
                </option>
              ))}
            </select>

            <input
              className="input narrow"
              type="number"
              placeholder="Cantidad Stock"
              value={cantidadStock}
              onChange={e => setCantidadStock(e.target.value)}
              required
            />

            <button type="submit" className="btn btn-primary">Guardar Stock en Establecimiento</button>
          </form>

          <h4 className="card-subtitle">Productos actualmente en este establecimiento</h4>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Producto</th>
                  <th className="right">Precio Venta</th>
                  <th className="right">Stock Disponible</th>
                  <th className="right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {stockEstablecimiento.length === 0 ? (
                  <tr>
                    <td colSpan="5" className="empty">No hay productos asignados a esta sucursal/CD.</td>
                  </tr>
                ) : (
                  stockEstablecimiento.map(item => (
                    <tr key={item.idStockItem}>
                      <td>{item.codigoBarras}</td>
                      <td className="strong">{item.nombre}</td>
                      <td className="right">${item.precioVenta}</td>
                      <td className="right">{item.cantidadDisponible} u.</td>
                      <td className="right">
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={() => handleQuitarStockLocal(item.idStockItem)}
                        >
                          Quitar de Sucursal
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* SECCIÓN 3: Catálogo General de Productos */}
      <section className="card">
        <h3 className="card-title">Catálogo Global de Productos (Base de Datos General)</h3>

        <form onSubmit={handleCrearProductoGlobal}>
          <div className="form-grid">
            <input
              className="input"
              placeholder="Código de Barras"
              value={formNuevoProd.codigoBarras}
              onChange={e => setFormNuevoProd({...formNuevoProd, codigoBarras: e.target.value})}
              required
            />
            <input
              className="input"
              placeholder="Nombre"
              value={formNuevoProd.nombre}
              onChange={e => setFormNuevoProd({...formNuevoProd, nombre: e.target.value})}
              required
            />
            <input
              className="input"
              type="number"
              placeholder="Precio Venta"
              value={formNuevoProd.precioVenta}
              onChange={e => setFormNuevoProd({...formNuevoProd, precioVenta: e.target.value})}
              required
            />
            <input
              className="input"
              type="number"
              placeholder="Costo Unitario"
              value={formNuevoProd.costoUnitario}
              onChange={e => setFormNuevoProd({...formNuevoProd, costoUnitario: e.target.value})}
              required
            />
            <button type="submit" className="btn btn-primary">Crear Producto Global</button>
          </div>
        </form>

        <h4 className="card-subtitle">Productos del catálogo</h4>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Código</th>
                <th>Nombre</th>
                <th className="right">Precio Venta</th>
                <th className="right">Costo</th>
                <th className="right">Acción Global</th>
              </tr>
            </thead>
            <tbody>
              {productosGlobales.map(p => (
                <tr key={p.idProducto}>
                  <td className="muted">{p.idProducto}</td>
                  <td>{p.codigoBarras}</td>
                  <td className="strong">{p.nombre}</td>
                  <td className="right">${p.precioVenta}</td>
                  <td className="right">${p.costoUnitario}</td>
                  <td className="right">
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => handleEliminarProductoGlobal(p.idProducto)}
                    >
                      Eliminar Globalmente
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}