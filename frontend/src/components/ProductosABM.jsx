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
    <div style={{ padding: '20px' }}>
      <h2>ABM - Gestión de Productos y Stock por Establecimiento</h2>

      {/* SECCIÓN 1: Selección de Sucursal / CD */}
      <div style={{ padding: '15px', backgroundColor: '#e6f7ff', borderRadius: '5px', marginBottom: '20px' }}>
        <label style={{ fontSize: '16px', fontWeight: 'bold', marginRight: '10px' }}>
          Seleccionar Sucursal o Centro de Distribución:
        </label>
        <select 
          value={establecimientoSeleccionado} 
          onChange={e => setEstablecimientoSeleccionado(e.target.value)}
          style={{ padding: '8px', fontSize: '14px' }}
        >
          {establecimientos.map(est => (
            <option key={est.idEstablecimiento} value={est.idEstablecimiento}>
              [{est.tipo.toUpperCase()}] {est.nombre} ({est.codigo})
            </option>
          ))}
        </select>
      </div>

      {/* SECCIÓN 2: Agregar/Modificar Productos en la Sucursal/CD Elegida */}
      {establecimientoSeleccionado && (
        <div style={{ border: '1px solid #ccc', padding: '15px', borderRadius: '5px', marginBottom: '30px' }}>
          <h3>Asignar / Actualizar Stock en este Establecimiento</h3>
          <form onSubmit={handleGuardarStockLocal} style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
            <select 
              value={idProductoSeleccionado} 
              onChange={e => setIdProductoSeleccionado(e.target.value)}
              required
              style={{ padding: '6px' }}
            >
              <option value="">-- Seleccionar Producto del Catálogo --</option>
              {productosGlobales.map(p => (
                <option key={p.idProducto} value={p.idProducto}>
                  {p.nombre} (Cód: {p.codigoBarras})
                </option>
              ))}
            </select>

            <input 
              type="number" 
              placeholder="Cantidad Stock" 
              value={cantidadStock} 
              onChange={e => setCantidadStock(e.target.value)} 
              required 
              style={{ width: '120px', padding: '6px' }}
            />

            <button type="submit">Guardar Stock en Establecimiento</button>
          </form>

          <h4 style={{ marginTop: '20px' }}>Productos actualmente en este establecimiento (`StockItem`):</h4>
          <table border="1" cellPadding="8" style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ backgroundColor: '#fafafa' }}>
                <th>Código</th>
                <th>Producto</th>
                <th>Precio Venta</th>
                <th>Stock Disponible</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {stockEstablecimiento.length === 0 ? (
                <tr>
                  <td colSpan="5" style={{ textAlign: 'center' }}>No hay productos asignados a esta sucursal/CD.</td>
                </tr>
              ) : (
                stockEstablecimiento.map(item => (
                  <tr key={item.idStockItem}>
                    <td>{item.codigoBarras}</td>
                    <td><strong>{item.nombre}</strong></td>
                    <td>${item.precioVenta}</td>
                    <td>{item.cantidadDisponible} u.</td>
                    <td>
                      <button 
                        onClick={() => handleQuitarStockLocal(item.idStockItem)}
                        style={{ backgroundColor: '#ff4d4f', color: '#fff', border: 'none', padding: '5px 10px', cursor: 'pointer' }}
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
      )}

      {/* SECCIÓN 3: Catálogo General de Productos */}
      <div style={{ border: '1px solid #ddd', padding: '15px', borderRadius: '5px' }}>
        <h3>Catálogo Global de Productos (Base de Datos General)</h3>
        
        <form onSubmit={handleCrearProductoGlobal} style={{ marginBottom: '15px', display: 'flex', gap: '10px' }}>
          <input 
            placeholder="Código de Barras" 
            value={formNuevoProd.codigoBarras} 
            onChange={e => setFormNuevoProd({...formNuevoProd, codigoBarras: e.target.value})} 
            required 
          />
          <input 
            placeholder="Nombre" 
            value={formNuevoProd.nombre} 
            onChange={e => setFormNuevoProd({...formNuevoProd, nombre: e.target.value})} 
            required 
          />
          <input 
            type="number" 
            placeholder="Precio Venta" 
            value={formNuevoProd.precioVenta} 
            onChange={e => setFormNuevoProd({...formNuevoProd, precioVenta: e.target.value})} 
            required 
          />
          <input 
            type="number" 
            placeholder="Costo Unitario" 
            value={formNuevoProd.costoUnitario} 
            onChange={e => setFormNuevoProd({...formNuevoProd, costoUnitario: e.target.value})} 
            required 
          />
          <button type="submit">Crear Producto Global</button>
        </form>

        <table border="1" cellPadding="8" style={{ width: '100%', borderCollapse: 'collapse' }}>
          <thead>
            <tr>
              <th>ID</th>
              <th>Código</th>
              <th>Nombre</th>
              <th>Precio Venta</th>
              <th>Costo</th>
              <th>Acción Global</th>
            </tr>
          </thead>
          <tbody>
            {productosGlobales.map(p => (
              <tr key={p.idProducto}>
                <td>{p.idProducto}</td>
                <td>{p.codigoBarras}</td>
                <td>{p.nombre}</td>
                <td>${p.precioVenta}</td>
                <td>${p.costoUnitario}</td>
                <td>
                  <button onClick={() => handleEliminarProductoGlobal(p.idProducto)}>
                    Eliminar Globalmente
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}