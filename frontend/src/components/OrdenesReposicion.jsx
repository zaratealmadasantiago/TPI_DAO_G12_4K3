import React, { useState, useEffect } from 'react';
import { apiService } from '../api/apiService';

export default function OrdenesReposicion({ ambito, centroDistribucion, idSucursal, sucursalActual }) {
  const [ordenes, setOrdenes] = useState([]);
  const [productos, setProductos] = useState([]);
  const [ordenExpandidaId, setOrdenExpandidaId] = useState(null);
  const [modalConfirmarOR, setModalConfirmarOR] = useState(null);
  const [modalRechazarOR, setModalRechazarOR] = useState(null);
  const [filtroEstadoOR, setFiltroEstadoOR] = useState('TODOS');

  // Estado para nueva OR (solo Sucursal)
  const [productoSeleccionadoId, setProductoSeleccionadoId] = useState('');
  const [cantidadInput, setCantidadInput] = useState(1);
  const [detallesNuevaOrden, setDetallesNuevaOrden] = useState([]);

  useEffect(() => {
    cargarProductos();
  }, []);

  useEffect(() => {
    setOrdenExpandidaId(null);
    setDetallesNuevaOrden([]);
    setFiltroEstadoOR(ambito === 'cd' ? 'Esperando Aprobación' : 'TODOS');
    cargarOrdenes();
  }, [ambito, idSucursal, centroDistribucion]);

  const cargarOrdenes = async () => {
    if (ambito === 'cd') {
      const res = await apiService.getOrdenesReposicion({
        idCentroDistribucion: centroDistribucion?.idEstablecimiento
      });
      if (res && res.datos) {
        setOrdenes(res.datos);
      }
    } else if (idSucursal) {
      const res = await apiService.getOrdenesReposicion({ idSucursal });
      if (res && res.datos) setOrdenes(res.datos);
    } else {
      setOrdenes([]);
    }
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

  // --- CONFIRMAR OR EN CENTRO DE DISTRIBUCIÓN ---
  const ejecutarConfirmacionOR = async () => {
    if (!modalConfirmarOR) return;
    const res = await apiService.confirmarOrdenReposicion(modalConfirmarOR.idOrden);
    setModalConfirmarOR(null);
    alert(res.mensaje || res.error);
    if (res.status === 'success') {
      cargarOrdenes();
    }
  };

  // --- RECHAZAR OR EN CENTRO DE DISTRIBUCIÓN (SIN MODIFICAR STOCK) ---
  const ejecutarRechazoOR = async () => {
    if (!modalRechazarOR) return;
    const res = await apiService.rechazarOrdenReposicion(modalRechazarOR.idOrden);
    setModalRechazarOR(null);
    alert(res.mensaje || res.error);
    if (res.status === 'success') {
      cargarOrdenes();
    }
  };

  // --- CREAR OR EN SUCURSAL ---
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
    setCantidadInput('1');
  };

  const quitarDetalle = (idProducto) => {
    setDetallesNuevaOrden(prev => prev.filter(d => d.idProducto !== idProducto));
  };

  const handleGenerarOrden = async (e) => {
    e.preventDefault();
    if (!idSucursal || detallesNuevaOrden.length === 0) return;

    const res = await apiService.crearOrdenReposicion(idSucursal, detallesNuevaOrden);
    alert(res.mensaje || res.error);
    if (res.status === 'success') {
      setDetallesNuevaOrden([]);
      cargarOrdenes();
    }
  };

  const handleCantidadKeyDown = (e) => {
    // Permitir teclas de navegación y edición
    if (
      e.key === 'Backspace' ||
      e.key === 'Delete' ||
      e.key === 'Tab' ||
      e.key === 'Enter' ||
      e.key.startsWith('Arrow') ||
      e.ctrlKey ||
      e.metaKey
    ) {
      return;
    }

    // Bloquear cualquier tecla que no sea un dígito (0-9)
    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      return;
    }

    // Bloquear si ya hay 4 dígitos escritos (y no hay texto seleccionado para reemplazar)
    const inputEl = e.target;
    const sinSeleccion = inputEl.selectionStart === inputEl.selectionEnd;
    if (sinSeleccion && String(cantidadInput).length >= 4) {
      e.preventDefault();
    }
  };

  const handleCantidadChange = (e) => {
    // Eliminar cualquier carácter no numérico (incluso si se pega con Ctrl+V) y limitar a 4 dígitos
    const soloDigitos = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
    setCantidadInput(soloDigitos);
  };

  // Aplicar filtro por estado de Orden de Reposición
  const ordenesFiltradas = ordenes.filter(ord => {
    if (filtroEstadoOR === 'TODOS') return true;
    return (ord.estado || '').toLowerCase() === filtroEstadoOR.toLowerCase();
  });

  return (
    <>
      <section className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px',
            marginBottom: '12px'
          }}
        >
          <h3 className="card-title" style={{ margin: 0 }}>
            {ambito === 'cd'
              ? `Órdenes de Reposición — ${centroDistribucion ? centroDistribucion.nombre : 'Centro de Distribución'}`
              : `Órdenes de Reposición — ${sucursalActual ? sucursalActual.nombre : 'Seleccione una sucursal'}`}
          </h3>

          <div className="field-inline">
            <label htmlFor="filtro-estado-or">Filtrar por Estado:</label>
            <select
              id="filtro-estado-or"
              className="select"
              value={filtroEstadoOR}
              onChange={e => setFiltroEstadoOR(e.target.value)}
            >
              <option value="TODOS">Todos los estados ({ordenes.length})</option>
              <option value="Esperando Aprobación">Esperando Aprobación</option>
              <option value="Confirmada">Confirmada</option>
              <option value="Entregada">Entregada</option>
              <option value="Rechazada">Rechazada</option>
            </select>
          </div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID Orden</th>
                <th>Número Orden</th>
                <th>Fecha Solicitud (GMT-3)</th>
                <th>Origen</th>
                <th>Destino</th>
                <th>Estado OR</th>
                {ambito === 'cd' && <th className="right">Acción CD</th>}
              </tr>
            </thead>
            <tbody>
              {ordenesFiltradas.length === 0 ? (
                <tr>
                  <td colSpan={ambito === 'cd' ? 7 : 6} className="empty">
                    No hay órdenes de reposición que coincidan con el filtro seleccionado.
                  </td>
                </tr>
              ) : (
                ordenesFiltradas.map(ord => {
                  const estaExpandida = ordenExpandidaId === ord.idOrden;
                  const detalles = ord.detalles || [];
                  const est = ord.estado || 'Esperando Aprobación';
                  const esPendiente = ['Esperando Aprobación', 'CREADA', 'ESPERANDO', 'PENDIENTE'].includes(est);

                  const colorEstado =
                    est === 'Entregada'
                      ? 'green'
                      : est === 'Rechazada'
                      ? 'red'
                      : est === 'Confirmada'
                      ? '#1890ff'
                      : '#d46b08';

                  return (
                    <React.Fragment key={ord.idOrden}>
                      <tr style={{ backgroundColor: estaExpandida ? 'rgba(0,0,0,0.02)' : undefined }}>
                        <td>
                          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '6px' }}>
                            <span className="muted">{ord.idOrden}</span>
                            <button
                              type="button"
                              onClick={() => toggleDetalleOrden(ord.idOrden)}
                              title={estaExpandida ? 'Ocultar detalle' : 'Ver productos y diferencia de stock'}
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
                        <td>
                          <span style={{ fontWeight: 'bold', color: colorEstado }}>
                            {est}
                          </span>
                          {ord.numeroRemito && (
                            <div className="muted" style={{ fontSize: '12px' }}>
                              Remito: {ord.numeroRemito} ({ord.estadoRemito})
                            </div>
                          )}
                        </td>
                        {ambito === 'cd' && (
                          <td className="right">
                            {esPendiente ? (
                              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                                <button
                                  type="button"
                                  disabled={!ord.stockSuficienteTotal}
                                  onClick={() => setModalConfirmarOR(ord)}
                                  className="btn btn-primary btn-sm"
                                  title={
                                    !ord.stockSuficienteTotal
                                      ? 'Stock insuficiente en Centro de Distribución'
                                      : 'Descontar stock del CD y generar Remito + Bulto Preparado'
                                  }
                                  style={{
                                    backgroundColor: !ord.stockSuficienteTotal ? undefined : '#52c41a',
                                    borderColor: !ord.stockSuficienteTotal ? undefined : '#52c41a',
                                    opacity: !ord.stockSuficienteTotal ? 0.45 : 1,
                                    cursor: !ord.stockSuficienteTotal ? 'not-allowed' : 'pointer'
                                  }}
                                >
                                  {ord.stockSuficienteTotal ? 'Confirmar y Generar Remito/Bulto' : 'Stock CD Insuficiente'}
                                </button>

                                <button
                                  type="button"
                                  onClick={() => setModalRechazarOR(ord)}
                                  className="btn btn-danger btn-sm"
                                  title="Rechazar la orden sin descontar ni reingresar stock en el CD"
                                >
                                  Rechazar Orden
                                </button>
                              </div>
                            ) : (
                              <span className="muted" style={{ fontSize: '12px' }}>
                                Procesada
                              </span>
                            )}
                          </td>
                        )}
                      </tr>

                      {/* DESPLEGABLE DE PRODUCTOS + DIFERENCIA DE STOCK EN CD */}
                      {estaExpandida && (
                        <tr>
                          <td colSpan={ambito === 'cd' ? 7 : 6} style={{ padding: '14px 20px', backgroundColor: 'rgba(0,0,0,0.015)' }}>
                            <div style={{ borderLeft: '3px solid currentColor', paddingLeft: '14px' }}>
                              <h4 className="card-subtitle" style={{ marginTop: 0 }}>
                                {ambito === 'cd'
                                  ? `Evaluación de Stock en Centro de Distribución — ${ord.numeroOrden} (Destino: ${ord.destino})`
                                  : `Detalle de Orden — ${ord.numeroOrden} (${detalles.length} ítem/s)`}
                              </h4>

                              <div className="table-wrap">
                                <table className="table">
                                  <thead>
                                    <tr>
                                      <th>Código Barras</th>
                                      <th>Producto</th>
                                      <th className="right">Cantidad Pedida</th>
                                      {ambito === 'cd' && (
                                        <>
                                          <th className="right">Stock Actual CD (StockItem)</th>
                                          <th className="right">Diferencia al Enviar</th>
                                        </>
                                      )}
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {detalles.map(d => (
                                      <tr key={d.idDetalleOrden}>
                                        <td>{d.codigoBarras}</td>
                                        <td className="strong">{d.productoNombre}</td>
                                        <td className="right">{d.cantidadSolicitada} u.</td>
                                        {ambito === 'cd' && (
                                          <>
                                            <td className="right">{d.stockDisponibleCD} u.</td>
                                            <td
                                              className="right strong"
                                              style={{ color: d.tieneStockSuficiente ? 'green' : 'red' }}
                                            >
                                              {d.stockResultanteCD} u.{' '}
                                              {d.tieneStockSuficiente ? '(OK)' : '(FALTANTE)'}
                                            </td>
                                          </>
                                        )}
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </div>
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

      {/* FORMULARIO DE ALTA DE ORDEN: SOLO DISPONIBLE EN VISTA SUCURSALES */}
      {ambito === 'sucursal' && (
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
              type="text"
              inputMode="numeric"
              maxLength={4}
              placeholder="Cant."
              value={cantidadInput}
              onKeyDown={handleCantidadKeyDown}
              onChange={handleCantidadChange}
            />

            <button type="button" onClick={agregarDetalle} className="btn btn-primary">
              + Agregar Producto
            </button>
          </div>

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
      )}

      {/* MODAL DE CONFIRMACIÓN DE ORDEN EN CD */}
      {modalConfirmarOR && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000
          }}
        >
          <div className="card" style={{ maxWidth: '460px', width: '90%', textAlign: 'center', margin: 0, borderTop: '5px solid #52c41a' }}>
            <h3 className="card-title">Confirmar Orden de Reposición</h3>
            <p>
              Orden: <span className="strong">{modalConfirmarOR.numeroOrden}</span> &rarr; Destino:{' '}
              <span className="strong">{modalConfirmarOR.destino}</span>
            </p>
            <p className="muted" style={{ lineHeight: '1.4' }}>
              Al aceptar, se restará el stock del <strong>Centro de Distribución</strong>, se generará un nuevo <strong>Remito</strong> (<em>GENERADO</em>) y se creará el <strong>Bulto</strong> correlativo en estado <em>Preparado</em>.
            </p>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '20px' }}>
              <button type="button" onClick={() => setModalConfirmarOR(null)} className="btn">
                Cancelar
              </button>
              <button
                type="button"
                onClick={ejecutarConfirmacionOR}
                className="btn btn-primary"
                style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
              >
                Confirmar y Generar Remito/Bulto
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL DE RECHAZO DE ORDEN EN CD */}
        {modalRechazarOR && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: 'rgba(0,0,0,0.5)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 1000
            }}
          >
            <div className="card" style={{ maxWidth: '460px', width: '90%', textAlign: 'center', margin: 0, borderTop: '5px solid #ff4d4f' }}>
              <h3 className="card-title" style={{ color: '#cf1322' }}>¿Rechazar Orden de Reposición?</h3>
              <p>
                Orden: <span className="strong">{modalRechazarOR.numeroOrden}</span> &rarr; Destino:{' '}
                <span className="strong">{modalRechazarOR.destino}</span>
              </p>
              <p className="muted" style={{ lineHeight: '1.4' }}>
                ¿Efectivamente desea rechazar esta orden? La orden pasará a estado <strong>Rechazada</strong> y <strong>no se reingresará ni descontará stock</strong> en el Centro de Distribución ya que la mercadería nunca salió del depósito.
              </p>

              <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '20px' }}>
                <button type="button" onClick={() => setModalRechazarOR(null)} className="btn">
                  Cancelar
                </button>
                <button
                  type="button"
                  onClick={ejecutarRechazoOR}
                  className="btn btn-danger"
                >
                  Confirmar Rechazo
                </button>
              </div>
            </div>
          </div>
        )}
    </>
  );
}