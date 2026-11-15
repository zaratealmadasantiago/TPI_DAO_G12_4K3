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
    <>
      {/* SECCIÓN 1: Grilla de Órdenes de Reposición de la Sucursal */}
      <section className="card">
        <h3 className="card-title">
          Órdenes de Reposición — {sucursalActual ? sucursalActual.nombre : 'Seleccione una sucursal'}
        </h3>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID Orden</th>
                <th>Número Orden</th>
                <th>Fecha Solicitud (GMT-3)</th>
                <th>Origen</th>
                <th>Destino</th>
              </tr>
            </thead>
            <tbody>
              {ordenes.length === 0 ? (
                <tr>
                  <td colSpan="5" className="empty">
                    No hay órdenes de reposición registradas para esta sucursal.
                  </td>
                </tr>
              ) : (
                ordenes.map(ord => {
                  const estaExpandida = ordenExpandidaId === ord.idOrden;
                  const detalles = ord.detalles || [];

                  return (
                    <React.Fragment key={ord.idOrden}>
                      <tr style={{ backgroundColor: estaExpandida ? 'rgba(0,0,0,0.02)' : undefined }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                            <span className="muted">{ord.idOrden}</span>
                            <button
                              type="button"
                              onClick={() => toggleDetalleOrden(ord.idOrden)}
                              title={estaExpandida ? 'Ocultar detalle de orden' : 'Ver productos solicitados'}
                              className={estaExpandida ? 'btn btn-primary btn-sm' : 'btn btn-sm'}
                            >
                              {estaExpandida ? '▲' : '▼'}
                            </button>
                          </div>
                        </td>
                        <td className="strong">{ord.numeroOrden}</td>
                        <td>{ord.fechaSolicitud}</td>
                        <td>{ord.origen}</td>
                        <td className="strong">{ord.destino}</td>
                      </tr>

                      {/* SUB-GRILLA DESPLEGABLE: DETALLE ORDEN */}
                      {estaExpandida && (
                        <tr>
                          <td colSpan="5" style={{ padding: '14px 20px', backgroundColor: 'rgba(0,0,0,0.015)' }}>
                            <div style={{ borderLeft: '3px solid currentColor', paddingLeft: '14px' }}>
                              <h4 className="card-subtitle" style={{ marginTop: 0 }}>
                                Detalle de Orden — {ord.numeroOrden} ({detalles.length} ítem/s)
                              </h4>

                              {detalles.length === 0 ? (
                                <p className="muted" style={{ margin: 0 }}>
                                  Esta orden no posee productos detallados.
                                </p>
                              ) : (
                                <div className="table-wrap">
                                  <table className="table">
                                    <thead>
                                      <tr>
                                        <th>ID Detalle</th>
                                        <th>Código Barras</th>
                                        <th>Producto Solicitado</th>
                                        <th className="right">Cantidad Solicitada</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {detalles.map(d => (
                                        <tr key={d.idDetalleOrden}>
                                          <td className="muted">{d.idDetalleOrden}</td>
                                          <td>{d.codigoBarras}</td>
                                          <td className="strong">{d.productoNombre}</td>
                                          <td className="right">{d.cantidadSolicitada} u.</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
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
        </div>
      </section>

      {/* SECCIÓN 2: Generar Orden de Reposición para la Sucursal Seleccionada */}
      <section className="card">
        <h3 className="card-title">
          Generar Orden de Reposición — Destino:{' '}
          <span>
            {sucursalActual ? `${sucursalActual.codigo} (${sucursalActual.nombre})` : 'Sin sucursal'}
          </span>
        </h3>

        <div className="form-row">
          <select
            className="select grow"
            value={productoSeleccionadoId}
            onChange={e => setProductoSeleccionadoId(e.target.value)}
          >
            {productos.map(p => (
              <option key={p.idProducto} value={p.idProducto}>
                {p.codigoBarras} — {p.nombre}
              </option>
            ))}
          </select>

          <input
            className="input narrow"
            type="number"
            min="1"
            value={cantidadInput}
            onChange={e => setCantidadInput(e.target.value)}
          />

          <button
            type="button"
            onClick={agregarDetalle}
            className="btn btn-primary"
          >
            + Agregar Producto
          </button>
        </div>

        {/* ÍTEMS AGREGADOS A LA NUEVA ORDEN */}
        {detallesNuevaOrden.length > 0 && (
          <>
            <h4 className="card-subtitle">Ítems agregados a la orden</h4>
            <div className="table-wrap" style={{ marginBottom: '16px' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>Código Barras</th>
                    <th>Producto</th>
                    <th className="right">Cantidad Solicitada</th>
                    <th className="right">Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {detallesNuevaOrden.map(item => (
                    <tr key={item.idProducto}>
                      <td>{item.codigoBarras}</td>
                      <td className="strong">{item.nombre}</td>
                      <td className="right">{item.cantidadSolicitada} u.</td>
                      <td className="right">
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => quitarDetalle(item.idProducto)}
                        >
                          Quitar
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}

        <div style={{ marginTop: '12px' }}>
          <button
            type="button"
            onClick={handleGenerarOrden}
            disabled={!idSucursal || detallesNuevaOrden.length === 0}
            className="btn btn-primary"
            style={{
              opacity: !idSucursal || detallesNuevaOrden.length === 0 ? 0.5 : 1,
              cursor: !idSucursal || detallesNuevaOrden.length === 0 ? 'not-allowed' : 'pointer'
            }}
          >
            Generar Orden Reposición
          </button>
        </div>
      </section>
    </>
  );
}