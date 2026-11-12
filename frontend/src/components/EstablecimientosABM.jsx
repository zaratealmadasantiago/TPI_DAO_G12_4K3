import React, { useState, useEffect } from 'react';
import { apiService } from '../api/apiService';

export default function EstablecimientosABM() {
  const [establecimientos, setEstablecimientos] = useState([]);
  const [tipoForm, setTipoForm] = useState('sucursal');
  
  // Estados para selección y visualización de productos
  const [establecimientoSeleccionado, setEstablecimientoSeleccionado] = useState(null);
  const [productosStock, setProductosStock] = useState([]);
  const [cargandoStock, setCargandoStock] = useState(false);

  const [form, setForm] = useState({
    codigo: '',
    nombre: '',
    direccion: '',
    telefono: '',
    numeroSucursal: '',
    codigoOperativo: ''
  });

  useEffect(() => {
    cargarEstablecimientos();
  }, []);

  const cargarEstablecimientos = async () => {
    const res = await apiService.getEstablecimientos();
    if (res && res.datos) {
      setEstablecimientos(res.datos);
    }
  };

  const handleSeleccionarEstablecimiento = async (est) => {
    setEstablecimientoSeleccionado(est);
    setCargandoStock(true);
    const res = await apiService.getStockPorEstablecimiento(est.idEstablecimiento);
    if (res && res.datos) {
      setProductosStock(res.datos);
    } else {
      setProductosStock([]);
    }
    setCargandoStock(false);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (tipoForm === 'sucursal') {
      await apiService.crearSucursal({
        codigo: form.codigo,
        nombre: form.nombre,
        direccion: form.direccion,
        telefono: form.telefono,
        numeroSucursal: parseInt(form.numeroSucursal)
      });
    } else {
      await apiService.crearCentroDistribucion({
        codigo: form.codigo,
        nombre: form.nombre,
        direccion: form.direccion,
        telefono: form.telefono,
        codigoOperativo: form.codigoOperativo
      });
    }
    setForm({ codigo: '', nombre: '', direccion: '', telefono: '', numeroSucursal: '', codigoOperativo: '' });
    cargarEstablecimientos();
  };

  return (
    <div className="page">
      <h2 className="page-title">Administrar Sucursales y Centros de Distribución</h2>

      {/* Formulario de Alta */}
      <section className="card">
        <h3 className="card-title">Nuevo establecimiento</h3>

        <div className="toggle">
          <label className={`toggle-option ${tipoForm === 'sucursal' ? 'active' : ''}`}>
            <input
              type="radio"
              name="tipo"
              checked={tipoForm === 'sucursal'}
              onChange={() => setTipoForm('sucursal')}
            /> Sucursal / Local
          </label>
          <label className={`toggle-option ${tipoForm === 'cd' ? 'active' : ''}`}>
            <input
              type="radio"
              name="tipo"
              checked={tipoForm === 'cd'}
              onChange={() => setTipoForm('cd')}
            /> Centro de Distribución
          </label>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="form-grid">
            <input
              className="input"
              placeholder="Código"
              value={form.codigo}
              onChange={e => setForm({...form, codigo: e.target.value})}
              required
            />
            <input
              className="input"
              placeholder="Nombre"
              value={form.nombre}
              onChange={e => setForm({...form, nombre: e.target.value})}
              required
            />
            <input
              className="input"
              placeholder="Dirección"
              value={form.direccion}
              onChange={e => setForm({...form, direccion: e.target.value})}
              required
            />
            <input
              className="input"
              placeholder="Teléfono"
              value={form.telefono}
              onChange={e => setForm({...form, telefono: e.target.value})}
            />

            {tipoForm === 'sucursal' ? (
              <input
                className="input"
                type="number"
                placeholder="N° Sucursal"
                value={form.numeroSucursal}
                onChange={e => setForm({...form, numeroSucursal: e.target.value})}
                required
              />
            ) : (
              <input
                className="input"
                placeholder="Código Operativo CD"
                value={form.codigoOperativo}
                onChange={e => setForm({...form, codigoOperativo: e.target.value})}
                required
              />
            )}
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              Agregar {tipoForm === 'sucursal' ? 'Sucursal' : 'Centro Distribución'}
            </button>
          </div>
        </form>
      </section>

      {/* Tabla de Establecimientos */}
      <section className="card">
        <h3 className="card-title">Seleccione un Establecimiento para ver su Stock puntualmente:</h3>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Tipo</th>
                <th>Código</th>
                <th>Nombre</th>
                <th>Dirección</th>
                <th className="right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {establecimientos.map(e => (
                <tr
                  key={e.idEstablecimiento}
                  className={establecimientoSeleccionado?.idEstablecimiento === e.idEstablecimiento ? 'selected' : ''}
                >
                  <td className="muted">{e.idEstablecimiento}</td>
                  <td>
                    <span className={`tag ${e.tipo === 'sucursal' ? '' : 'tag-primary'}`}>
                      {e.tipo === 'sucursal' ? 'Sucursal' : 'Centro Distribución'}
                    </span>
                  </td>
                  <td>{e.codigo}</td>
                  <td className="strong">{e.nombre}</td>
                  <td>{e.direccion}</td>
                  <td className="right">
                    <button
                      className="btn btn-outline btn-sm"
                      onClick={() => handleSeleccionarEstablecimiento(e)}
                    >
                      Ver Productos
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Panel Detalle de Productos del Establecimiento Seleccionado */}
      {establecimientoSeleccionado && (
        <section className="card highlight">
          <h3 className="card-title">
            Productos en stock para: <span className="accent">{establecimientoSeleccionado.nombre}</span> <span className="muted">({establecimientoSeleccionado.tipo})</span>
          </h3>

          {cargandoStock ? (
            <p className="empty-text">Cargando productos...</p>
          ) : productosStock.length === 0 ? (
            <p className="empty-text">Este establecimiento no tiene registrado stock de ningún producto actualmente.</p>
          ) : (
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Código de Barras</th>
                    <th>Producto</th>
                    <th className="right">Precio Venta</th>
                    <th className="right">Stock Disponible</th>
                    <th className="right">Stock Reservado</th>
                    <th>Alerta Stock Mínimo</th>
                  </tr>
                </thead>
                <tbody>
                  {productosStock.map(item => (
                    <tr key={item.idStockItem}>
                      <td>{item.codigoBarras}</td>
                      <td className="strong">{item.nombre}</td>
                      <td className="right">${item.precioVenta}</td>
                      <td className="right">{item.cantidadDisponible} u.</td>
                      <td className="right">{item.cantidadReservada} u.</td>
                      <td>
                        {item.cantidadDisponible <= item.stockMinimo ? (
                          <span className="tag tag-danger">Bajo Stock (Mín: {item.stockMinimo})</span>
                        ) : (
                          <span className="tag tag-success">OK</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </div>
  );
}