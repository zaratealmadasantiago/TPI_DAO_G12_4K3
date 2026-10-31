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
    <div style={{ padding: '20px' }}>
      <h2>Administrar Sucursales y Centros de Distribución</h2>

      {/* Formulario de Alta */}
      <div style={{ marginBottom: '15px' }}>
        <label style={{ marginRight: '15px', cursor: 'pointer' }}>
          <input 
            type="radio" 
            name="tipo" 
            checked={tipoForm === 'sucursal'} 
            onChange={() => setTipoForm('sucursal')} 
          /> <strong>Sucursal / Local</strong>
        </label>
        <label style={{ cursor: 'pointer' }}>
          <input 
            type="radio" 
            name="tipo" 
            checked={tipoForm === 'cd'} 
            onChange={() => setTipoForm('cd')} 
          /> <strong>Centro de Distribución</strong>
        </label>
      </div>

      <form onSubmit={handleSubmit} style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
        <input 
          placeholder="Código" 
          value={form.codigo} 
          onChange={e => setForm({...form, codigo: e.target.value})} 
          required 
        />
        <input 
          placeholder="Nombre" 
          value={form.nombre} 
          onChange={e => setForm({...form, nombre: e.target.value})} 
          required 
        />
        <input 
          placeholder="Dirección" 
          value={form.direccion} 
          onChange={e => setForm({...form, direccion: e.target.value})} 
          required 
        />
        <input 
          placeholder="Teléfono" 
          value={form.telefono} 
          onChange={e => setForm({...form, telefono: e.target.value})} 
        />

        {tipoForm === 'sucursal' ? (
          <input 
            type="number"
            placeholder="N° Sucursal" 
            value={form.numeroSucursal} 
            onChange={e => setForm({...form, numeroSucursal: e.target.value})} 
            required 
          />
        ) : (
          <input 
            placeholder="Código Operativo CD" 
            value={form.codigoOperativo} 
            onChange={e => setForm({...form, codigoOperativo: e.target.value})} 
            required 
          />
        )}

        <button type="submit">Agregar {tipoForm === 'sucursal' ? 'Sucursal' : 'Centro Distribución'}</button>
      </form>

      {/* Tabla de Establecimientos */}
      <h3>Seleccione un Establecimiento para ver su Stock puntualmente:</h3>
      <table border="1" cellPadding="8" style={{ width: '100%', borderCollapse: 'collapse', marginBottom: '30px' }}>
        <thead>
          <tr style={{ backgroundColor: '#f2f2f2' }}>
            <th>ID</th>
            <th>Tipo</th>
            <th>Código</th>
            <th>Nombre</th>
            <th>Dirección</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {establecimientos.map(e => (
            <tr 
              key={e.idEstablecimiento}
              style={{ 
                backgroundColor: establecimientoSeleccionado?.idEstablecimiento === e.idEstablecimiento ? '#e6f7ff' : 'transparent',
                cursor: 'pointer'
              }}
              onClick={() => handleSeleccionarEstablecimiento(e)}
            >
              <td>{e.idEstablecimiento}</td>
              <td><strong>{e.tipo === 'sucursal' ? 'Sucursal' : 'Centro Distribución'}</strong></td>
              <td>{e.codigo}</td>
              <td>{e.nombre}</td>
              <td>{e.direccion}</td>
              <td>
                <button onClick={(event) => {
                  event.stopPropagation();
                  handleSeleccionarEstablecimiento(e);
                }}>
                  Ver Productos
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>

      {/* Panel Detalle de Productos del Establecimiento Seleccionado */}
      {establecimientoSeleccionado && (
        <div style={{ padding: '15px', border: '2px solid #1890ff', borderRadius: '5px', backgroundColor: '#fafafa' }}>
          <h3>
            Productos en stock para: <span style={{ color: '#1890ff' }}>{establecimientoSeleccionado.nombre}</span> ({establecimientoSeleccionado.tipo})
          </h3>
          
          {cargandoStock ? (
            <p>Cargando productos...</p>
          ) : productosStock.length === 0 ? (
            <p>Este establecimiento no tiene registrado stock de ningún producto actualmente.</p>
          ) : (
            <table border="1" cellPadding="8" style={{ width: '100%', borderCollapse: 'collapse', backgroundColor: '#fff' }}>
              <thead>
                <tr style={{ backgroundColor: '#e6f7ff' }}>
                  <th>Código de Barras</th>
                  <th>Producto</th>
                  <th>Precio Venta</th>
                  <th>Stock Disponible</th>
                  <th>Stock Reservado</th>
                  <th>Alerta Stock Mínimo</th>
                </tr>
              </thead>
              <tbody>
                {productosStock.map(item => (
                  <tr key={item.idStockItem}>
                    <td>{item.codigoBarras}</td>
                    <td><strong>{item.nombre}</strong></td>
                    <td>${item.precioVenta}</td>
                    <td>{item.cantidadDisponible} u.</td>
                    <td>{item.cantidadReservada} u.</td>
                    <td>
                      {item.cantidadDisponible <= item.stockMinimo ? (
                        <span style={{ color: 'red', fontWeight: 'bold' }}>⚠️ Bajo Stock (Mín: {item.stockMinimo})</span>
                      ) : (
                        <span style={{ color: 'green' }}>OK</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </div>
  );
}