import React, { useState, useEffect } from 'react';
import { apiService } from '../api/apiService';

export default function OrdenesReposicion({ idSucursal, sucursalActual }) {
  const [ordenes, setOrdenes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [ordenExpandidaId, setOrdenExpandidaId] = useState(null);

  // Estado para generar nueva Orden de Reposición con múltiples DetalleOrden
  const [productoSeleccionadoId, setProductoSeleccionadoId] = useState('');
  const [cantidadInput, setCantidadInput] = useState(1);
  const [detallesNuevaOrden, setDetallesNuevaOrden] = useState([]);

  useEffect(() => {
    cargarProductos();
  }, []);

  useEffect(() => {
    setOrdenExpandidaId(null);
    setDetallesNuevaOrden([]);
    if (idSucursal) {
      cargarOrdenes();
    } else {
      setOrdenes([]);
    }
  }, [idSucursal]);

  const cargarOrdenes = async () => {
    const res = await apiService.getOrdenesReposicion(idSucursal);
    if (res && res.datos) setOrdenes(res.datos);
  };

  const cargarProductos = async () => {
    const res = await apiService.getProductos();
    if (res && res.datos) {
      setProductos(res.datos);
      if (res.datos.length > 0) {
        setProductoSeleccionadoId(String(res.datos[0].idProducto));
      }
    }
  };

  const toggleDetalleOrden = (idOrden) => {
    setOrdenExpandidaId(prev => (prev === idOrden ? null : idOrden));
  };

  const agregarDetalle = () => {
    const idProd = Number(productoSeleccionadoId);
    const cant = Number(cantidadInput);
    if (!idProd || cant <= 0) {
      return alert('Seleccione un producto y una cantidad mayor a 0.');
    }

    const prodObj = productos.find(p => p.idProducto === idProd);
    if (!prodObj) return;

    setDetallesNuevaOrden(prev => {
      const existente = prev.find(d => d.idProducto === idProd);
      if (existente) {
        return prev.map(d =>
          d.idProducto === idProd
            ? { ...d, cantidadSolicitada: d.cantidadSolicitada + cant }
            : d
        );
      }
      return [
        ...prev,
        {
          idProducto: prodObj.idProducto,
          codigoBarras: prodObj.codigoBarras,
          nombre: prodObj.nombre,
          cantidadSolicitada: cant
        }
      ];
    });
    setCantidadInput(1);
  };

  const quitarDetalle = (idProducto) => {
    setDetallesNuevaOrden(prev => prev.filter(d => d.idProducto !== idProducto));
  };

  const handleGenerarOrden = async (e) => {
    e.preventDefault();
    if (!idSucursal) {
      return alert('Debe seleccionar una sucursal en el desplegable superior.');
    }
    if (detallesNuevaOrden.length === 0) {
      return alert('Agregue al menos un producto al detalle de la orden.');
    }

    const res = await apiService.crearOrdenReposicion(idSucursal, detallesNuevaOrden);
    alert(res.mensaje || res.error);
    if (res.status === 'success') {
      setDetallesNuevaOrden([]);
      cargarOrdenes();
    }
  };

  return (
    <div>
      <h3>
        Órdenes de Reposición — {sucursalActual ? sucursalActual.nombre : 'Seleccione una sucursal'}
      </h3>

      {/* GRILLA DE ÓRDENES DE REPOSICIÓN */}
      <table
        border="1"
        cellPadding="8"
        style={{
          width: '100%',
          borderCollapse: 'collapse',
          tableLayout: 'fixed',
          marginBottom: '28px'
        }}
      >
        <thead>
          <tr style={{ backgroundColor: '#f2f2f2' }}>
            <th style={{ width: '12%' }}>ID Orden</th>
            <th style={{ width: '20%' }}>Número Orden</th>
            <th style={{ width: '22%' }}>Fecha Solicitud (GMT-3)</th>
            <th style={{ width: '23%' }}>Origen</th>
            <th style={{ width: '23%' }}>Destino</th>
          </tr>
        </thead>
        <tbody>
          {ordenes.length === 0 ? (
            <tr>
              <td colSpan="5" style={{ textAlign: 'center', color: '#777', padding: '16px' }}>
                No hay órdenes de reposición registradas para esta sucursal.
              </td>
            </tr>
          ) : (
            ordenes.map(ord => {
              const estaExpandida = ordenExpandidaId === ord.idOrden;
              const detalles = ord.detalles || [];

              return (
                <React.Fragment key={ord.idOrden}>
                  <tr style={{ backgroundColor: estaExpandida ? '#fafafa' : '#fff' }}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                        <span>{ord.idOrden}</span>
                        <button
                          type="button"
                          onClick={() => toggleDetalleOrden(ord.idOrden)}
                          title={estaExpandida ? 'Ocultar detalle de orden' : 'Ver productos solicitados'}
                          style={{
                            padding: '2px 7px',
                            fontSize: '11px',
                            backgroundColor: estaExpandida ? '#1890ff' : '#f0f0f0',
                            color: estaExpandida ? '#fff' : '#333',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                          }}
                        >
                          {estaExpandida ? '▲' : '▼'}
                        </button>
                      </div>
                    </td>
                    <td><strong>{ord.numeroOrden}</strong></td>
                    <td>{ord.fechaSolicitud}</td>
                    <td>{ord.origen}</td>
                    <td><strong>{ord.destino}</strong></td>
                  </tr>

                  {/* SUB-GRILLA DESPLEGABLE: DETALLE ORDEN (PRODUCTOS SOLICITADOS) */}
                  {estaExpandida && (
                    <tr>
                      <td colSpan="5" style={{ backgroundColor: '#f6f8fa', padding: '14px 20px' }}>
                        <div style={{ borderLeft: '4px solid #1890ff', paddingLeft: '14px' }}>
                          <div style={{ marginBottom: '8px' }}>
                            <strong style={{ fontSize: '14px' }}>
                              Detalle de Orden — {ord.numeroOrden} ({detalles.length} ítem/s)
                            </strong>
                          </div>

                          {detalles.length === 0 ? (
                            <p style={{ margin: 0, color: '#777', fontSize: '13px' }}>
                              Esta orden no posee productos detallados.
                            </p>
                          ) : (
                            <table
                              border="1"
                              cellPadding="6"
                              style={{
                                width: '100%',
                                borderCollapse: 'collapse',
                                backgroundColor: '#fff',
                                fontSize: '13px'
                              }}
                            >
                              <thead>
                                <tr style={{ backgroundColor: '#e6f7ff' }}>
                                  <th>ID Detalle</th>
                                  <th>Código Barras</th>
                                  <th>Producto Solicitado</th>
                                  <th>Cantidad Solicitada</th>
                                </tr>
                              </thead>
                              <tbody>
                                {detalles.map(d => (
                                  <tr key={d.idDetalleOrden}>
                                    <td>{d.idDetalleOrden}</td>
                                    <td>{d.codigoBarras}</td>
                                    <td><strong>{d.productoNombre}</strong></td>
                                    <td>{d.cantidadSolicitada} u.</td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              );
            })
          )}
        </tbody>
      </table>

      {/* FORMULARIO INFERIOR: GENERAR ORDEN DE REPOSICIÓN PARA LA SUCURSAL SELECCIONADA */}
      <div
        style={{
          border: '1px solid #d9d9d9',
          borderRadius: '6px',
          padding: '18px',
          backgroundColor: '#fafafa'
        }}
      >
        <h4 style={{ marginTop: 0 }}>
          Generar Orden de Reposición — Destino:{' '}
          <span style={{ color: '#1890ff' }}>
            {sucursalActual ? `${sucursalActual.codigo} (${sucursalActual.nombre})` : 'Sin sucursal'}
          </span>
        </h4>

        <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '14px' }}>
          <select
            value={productoSeleccionadoId}
            onChange={e => setProductoSeleccionadoId(e.target.value)}
            style={{ padding: '7px', borderRadius: '4px', border: '1px solid #bbb', minWidth: '250px' }}
          >
            {productos.map(p => (
              <option key={p.idProducto} value={p.idProducto}>
                {p.codigoBarras} — {p.nombre}
              </option>
            ))}
          </select>

          <input
            type="number"
            min="1"
            value={cantidadInput}
            onChange={e => setCantidadInput(e.target.value)}
            style={{ padding: '7px', width: '95px', borderRadius: '4px', border: '1px solid #bbb' }}
          />

          <button
            type="button"
            onClick={agregarDetalle}
            style={{
              padding: '7px 14px',
              backgroundColor: '#1890ff',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer',
              fontWeight: 'bold'
            }}
          >
            + Agregar Producto
          </button>
        </div>

        {/* ÍTEMS AGREGADOS A LA NUEVA ORDEN */}
        {detallesNuevaOrden.length > 0 && (
          <table
            border="1"
            cellPadding="6"
            style={{
              width: '100%',
              borderCollapse: 'collapse',
              backgroundColor: '#fff',
              marginBottom: '14px',
              fontSize: '13px'
            }}
          >
            <thead>
              <tr style={{ backgroundColor: '#f0f0f0' }}>
                <th>Código Barras</th>
                <th>Producto</th>
                <th>Cantidad Solicitada</th>
                <th style={{ width: '110px' }}>Quitar</th>
              </tr>
            </thead>
            <tbody>
              {detallesNuevaOrden.map(item => (
                <tr key={item.idProducto}>
                  <td>{item.codigoBarras}</td>
                  <td><strong>{item.nombre}</strong></td>
                  <td>{item.cantidadSolicitada} u.</td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      type="button"
                      onClick={() => quitarDetalle(item.idProducto)}
                      style={{
                        padding: '4px 10px',
                        backgroundColor: '#ff4d4f',
                        color: '#fff',
                        border: 'none',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        fontSize: '12px'
                      }}
                    >
                      Quitar
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <button
          type="button"
          onClick={handleGenerarOrden}
          disabled={!idSucursal || detallesNuevaOrden.length === 0}
          style={{
            padding: '9px 18px',
            backgroundColor: !idSucursal || detallesNuevaOrden.length === 0 ? '#ccc' : '#52c41a',
            color: '#fff',
            border: 'none',
            borderRadius: '4px',
            cursor: !idSucursal || detallesNuevaOrden.length === 0 ? 'not-allowed' : 'pointer',
            fontWeight: 'bold'
          }}
        >
          Generar Orden Reposición
        </button>
      </div>
    </div>
  );
}