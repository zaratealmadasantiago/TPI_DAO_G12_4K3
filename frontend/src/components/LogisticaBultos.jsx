import React, { useState, useEffect } from 'react';
import { apiService } from '../api/apiService';

export default function LogisticaBultos({ ambito, centroDistribucion, idSucursal, sucursalActual }) {
  const [bultos, setBultos] = useState([]);
  const [codigoInput, setCodigoInput] = useState({});
  const [modalConfirm, setModalConfirm] = useState(null);
  const [mensajeInput, setMensajeInput] = useState({});
  const [bultoExpandidoId, setBultoExpandidoId] = useState(null);
  const [filtroEstadoBulto, setFiltroEstadoBulto] = useState('TODOS');

  useEffect(() => {
    setBultoExpandidoId(null);
    setFiltroEstadoBulto('TODOS');
    cargarBultos();
  }, [ambito, idSucursal, centroDistribucion]);

  const cargarBultos = async () => {
    const res = await apiService.getBultos();
    if (res && res.datos) {
      if (ambito === 'cd') {
        const idCd = centroDistribucion?.idEstablecimiento;
        const filtrados = idCd
          ? res.datos.filter(b => Number(b.idOrigen) === Number(idCd))
          : res.datos;
        setBultos(filtrados);
      } else if (idSucursal) {
        const filtrados = res.datos.filter(b => Number(b.idDestino) === Number(idSucursal));
        setBultos(filtrados);
      } else {
        setBultos([]);
      }
    }
  };

  const toggleDesplegable = (idBulto) => {
    setBultoExpandidoId(prev => (prev === idBulto ? null : idBulto));
  };

  // --- VALIDACIÓN DE CARACTERES ---
  const mostrarCartelTemporal = (idBulto, texto) => {
    setMensajeInput(prev => ({ ...prev, [idBulto]: texto }));
    setTimeout(() => {
      setMensajeInput(prev => (prev[idBulto] === texto ? { ...prev, [idBulto]: null } : prev));
    }, 2600);
  };

  const handleKeyDown = (e, idBulto) => {
    if (
      e.key === 'Backspace' || e.key === 'Delete' || e.key === 'Tab' ||
      e.key === 'Enter' || e.key.startsWith('Arrow') || e.ctrlKey || e.metaKey
    ) {
      return;
    }

    const currentVal = codigoInput[idBulto] || '';
    if (currentVal.length >= 10) {
      e.preventDefault();
      mostrarCartelTemporal(idBulto, 'Máximo 10 caracteres permitidos');
      return;
    }

    if (!/^[a-zA-Z0-9-]$/.test(e.key)) {
      e.preventDefault();
      mostrarCartelTemporal(idBulto, 'Solo caracteres alfanuméricos (A-Z, 0-9) y -');
    }
  };

  const handleInputChange = (e, idBulto) => {
    const upperValue = e.target.value.toUpperCase();
    const cleanValue = upperValue.replace(/[^A-Z0-9-]/g, '').slice(0, 10);

    if (upperValue !== upperValue.replace(/[^A-Z0-9-]/g, '')) {
      mostrarCartelTemporal(idBulto, 'Solo caracteres alfanuméricos (A-Z, 0-9) y -');
    }

    setCodigoInput(prev => ({ ...prev, [idBulto]: cleanValue }));
  };

  const validarCodigoPrecinto = (idBulto, precinto, mensajeVacio) => {
    if (!precinto) {
      alert(mensajeVacio);
      return false;
    }
    if (!/^[A-Z0-9-]{6,10}$/.test(precinto)) {
      const msgError = 'El Código Precinto debe tener entre 6 y 10 caracteres (A-Z, 0-9, -)';
      mostrarCartelTemporal(idBulto, msgError);
      alert(msgError);
      return false;
    }
    return true;
  };

  // --- MODALES DE CONFIRMACIÓN ---
  const solicitarAsignarPrecinto = (bulto) => {
    const precinto = (codigoInput[bulto.idBulto] || '').trim();
    if (!validarCodigoPrecinto(bulto.idBulto, precinto, 'Ingrese el código de precinto.')) return;
    setModalConfirm({
      tipo: 'asignar',
      idBulto: bulto.idBulto,
      codigoBulto: bulto.codigoBulto,
      precinto,
      titulo: 'Confirmar Asignación de Precinto',
      mensaje: 'Se asignará el siguiente código de precinto al bulto y pasará a estado PRECINTADO:'
    });
  };

  const solicitarConfirmarEnvio = (bulto) => {
    setModalConfirm({
      tipo: 'envio',
      idBulto: bulto.idBulto,
      codigoBulto: bulto.codigoBulto,
      titulo: 'Confirmar Despacho de Bulto',
      mensaje: 'Será confirmada la puesta EN TRÁNSITO del bulto hacia su sucursal de destino.'
    });
  };

  const solicitarConfirmarRecepcion = (bulto) => {
    setModalConfirm({
      tipo: 'recepcion',
      idBulto: bulto.idBulto,
      codigoBulto: bulto.codigoBulto,
      titulo: 'Confirmar Recepción de Bulto',
      mensaje: `Se confirmará la recepción física del bulto en "${bulto.destino}" y pasará a estado RECIBIDO.`
    });
  };

  const solicitarVerificarPrecinto = (bulto) => {
    const precinto = (codigoInput[bulto.idBulto] || '').trim();
    if (!validarCodigoPrecinto(bulto.idBulto, precinto, 'Ingrese el código de precinto para verificar.')) return;
    setModalConfirm({
      tipo: 'verificar',
      idBulto: bulto.idBulto,
      codigoBulto: bulto.codigoBulto,
      precinto,
      titulo: 'Confirmar Verificación de Precinto',
      mensaje: `Se verificará el código ingresado contra el precinto del bulto (Oportunidades restantes: ${bulto.intentosRestantes ?? 3}). Si es correcto, el stock se acreditará en la sucursal:`
    });
  };

  const solicitarRechazoViolado = (bulto) => {
    setModalConfirm({
      tipo: 'violado',
      idBulto: bulto.idBulto,
      codigoBulto: bulto.codigoBulto,
      titulo: '⚠️ Reportar Precinto Violado',
      mensaje: 'ATENCIÓN: El bulto y el Remito pasarán a estado RECHAZADO y no se acreditará mercadería en la sucursal. La mercadería vuelve al CD'
    });
  };

  const ejecutarAccionConfirmada = async () => {
    if (!modalConfirm) return;
    let respuesta;
    if (modalConfirm.tipo === 'asignar') {
      respuesta = await apiService.asignarPrecinto(modalConfirm.idBulto, modalConfirm.precinto);
      setCodigoInput(prev => ({ ...prev, [modalConfirm.idBulto]: '' }));
    } else if (modalConfirm.tipo === 'envio') {
      respuesta = await apiService.confirmarEnvio(modalConfirm.idBulto);
    } else if (modalConfirm.tipo === 'recepcion') {
      respuesta = await apiService.confirmarRecepcion(modalConfirm.idBulto);
    } else if (modalConfirm.tipo === 'verificar') {
      respuesta = await apiService.verificarPrecinto(modalConfirm.idBulto, modalConfirm.precinto);
      setCodigoInput(prev => ({ ...prev, [modalConfirm.idBulto]: '' }));
    } else if (modalConfirm.tipo === 'violado') {
      respuesta = await apiService.rechazarPrecintoViolado(modalConfirm.idBulto);
      setCodigoInput(prev => ({ ...prev, [modalConfirm.idBulto]: '' }));
    }

    setModalConfirm(null);
    if (respuesta) {
      alert(respuesta.mensaje || respuesta.error);
      cargarBultos();
    }
  };

  // Aplicar filtro por estado de Bulto
  const bultosFiltrados = bultos.filter(b => {
    if (filtroEstadoBulto === 'TODOS') return true;
    const estNorm = (b.estadoActual || '').toLowerCase();
    return estNorm === filtroEstadoBulto.toLowerCase();
  });

  return (
    <section className="card" style={{ position: 'relative' }}>
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
          Remitos y Trazabilidad de Bultos (Patrón State) —{' '}
          {ambito === 'cd'
            ? (centroDistribucion ? centroDistribucion.nombre : 'Centro de Distribución')
            : (sucursalActual ? sucursalActual.nombre : 'Seleccione una sucursal')}
        </h3>

        <div className="field-inline">
          <label htmlFor="filtro-estado-bulto">Filtrar por Estado de Bulto:</label>
          <select
            id="filtro-estado-bulto"
            className="select"
            value={filtroEstadoBulto}
            onChange={e => setFiltroEstadoBulto(e.target.value)}
          >
            <option value="TODOS">Todos los estados ({bultos.length})</option>
            <option value="Preparado">Preparado</option>
            <option value="Precintado">Precintado</option>
            <option value="En Tránsito">En Tránsito</option>
            <option value="Recibido">Recibido</option>
            <option value="Verificado">Verificado</option>
            <option value="Rechazado">Rechazado</option>
          </select>
        </div>
      </div>

      <div className="table-wrap">
        <table className="table" style={{ tableLayout: 'fixed', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ width: '11%' }}>Nro. OR</th>
              <th style={{ width: '13%' }}>Remito / Estado</th>
              <th style={{ width: '8%' }}>ID Bulto</th>
              <th style={{ width: '10%' }}>Bulto</th>
              <th style={{ width: '16%' }}>Origen &rarr; Destino</th>
              <th style={{ width: '9%' }}>Estado Bulto</th>
              <th style={{ width: '16%', minWidth: '175px' }}>Precinto Ingresado</th>
              <th style={{ width: '17%', minWidth: '195px' }} className="right">Acción</th>
            </tr>
          </thead>
          <tbody>
            {bultosFiltrados.length === 0 ? (
              <tr>
                <td colSpan="8" className="empty">
                  No hay remitos/bultos que coincidan con el filtro seleccionado.
                </td>
              </tr>
            ) : (
              bultosFiltrados.map(b => {
                const estado = (b.estadoActual || '').toLowerCase();
                const estaExpandido = bultoExpandidoId === b.idBulto;

                const esPreparado = estado === 'preparado';
                const esPrecintado = estado === 'precintado';
                const esEnTransito = estado === 'en tránsito' || estado === 'en transito';
                const esRecibido = estado === 'recibido';
                const esFinal = estado === 'verificado' || estado === 'rechazado';

                const permitidoEnCD = ambito === 'cd' && (esPreparado || esPrecintado);
                const permitidoEnSucursal = ambito === 'sucursal' && (esEnTransito || esRecibido);
                const accionHabilitada = !esFinal && (permitidoEnCD || permitidoEnSucursal);

                const inputHabilitado =
                  (ambito === 'cd' && esPreparado) ||
                  (ambito === 'sucursal' && esRecibido);
                const inputDeshabilitado = !inputHabilitado;

                const valorActual = inputDeshabilitado ? '' : (codigoInput[b.idBulto] || '');
                const faltanMinimo = valorActual.length >= 1 && valorActual.length <= 5;

                let textoBoton = 'Verificar Precinto';
                let colorBoton = '#1890ff';
                let accionBoton = () => solicitarVerificarPrecinto(b);

                if (esPreparado) {
                  textoBoton = 'Asignar Precinto';
                  colorBoton = '#52c41a';
                  accionBoton = () => solicitarAsignarPrecinto(b);
                } else if (esPrecintado) {
                  textoBoton = 'Confirmar Envío';
                  colorBoton = '#fa8c16';
                  accionBoton = () => solicitarConfirmarEnvio(b);
                } else if (esEnTransito) {
                  textoBoton = 'Confirmar Recepción';
                  colorBoton = '#722ed1';
                  accionBoton = () => solicitarConfirmarRecepcion(b);
                }

                let placeholderInput = 'CODIGO PRECINTO';
                if (esFinal) placeholderInput = 'BULTO CERRADO';
                else if (esPreparado && ambito !== 'cd') placeholderInput = 'SOLO EN CD';
                else if (esPrecintado) placeholderInput = 'PRECINTO ASIGNADO';
                else if (esEnTransito) placeholderInput = 'EN VIAJE';
                else if (esRecibido && ambito !== 'sucursal') placeholderInput = 'EN SUCURSAL';
                else if (esRecibido) placeholderInput = `COD PREC (${b.intentosRestantes ?? 3} INT.)`;

                const historial = b.historialEstados || [];
                const productosBulto = b.productos || [];
                const estadoPrecinto = b.estadoPrecinto || (b.precintoIntacto ? 'INTACTO' : 'VIOLADO');

                return (
                  <React.Fragment key={b.idBulto}>
                    <tr style={{ backgroundColor: estaExpandido ? 'rgba(0,0,0,0.02)' : undefined }}>
                      <td className="strong">{b.numeroOrden || '-'}</td>
                      <td>
                        <div className="strong">{b.numeroRemito}</div>
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 'bold',
                            color:
                              b.estadoRemito === 'DISPONIBLE'
                                ? 'green'
                                : b.estadoRemito === 'RECHAZADO'
                                ? 'red'
                                : '#1890ff'
                          }}
                        >
                          {b.estadoRemito || 'GENERADO'}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                          <span className="muted">{b.idBulto}</span>
                          <button
                            type="button"
                            onClick={() => toggleDesplegable(b.idBulto)}
                            title={estaExpandido ? 'Ocultar detalle y trazabilidad' : 'Ver productos y trazabilidad de estados'}
                            className={estaExpandido ? 'btn btn-primary btn-sm' : 'btn btn-sm'}
                          >
                            {estaExpandido ? '▲' : '▼'}
                          </button>
                        </div>
                      </td>
                      <td className="strong">{b.codigoBulto}</td>
                      <td>
                        <span className="muted">{b.origen}</span> &rarr; <span className="strong">{b.destino}</span>
                      </td>
                      <td>
                        <span
                          style={{
                            fontWeight: 'bold',
                            color:
                              estado === 'verificado'
                                ? 'green'
                                : estado === 'rechazado'
                                ? 'red'
                                : esPreparado
                                ? '#52c41a'
                                : esPrecintado
                                ? '#fa8c16'
                                : esEnTransito
                                ? '#722ed1'
                                : '#1890ff'
                          }}
                        >
                          {b.estadoActual}
                        </span>
                      </td>
                      <td>
                        <div style={{ position: 'relative', width: '100%' }}>
                          {mensajeInput[b.idBulto] && !inputDeshabilitado && (
                            <div
                              style={{
                                position: 'absolute',
                                bottom: '115%',
                                left: '0',
                                backgroundColor: '#ff4d4f',
                                color: '#fff',
                                padding: '5px 8px',
                                borderRadius: '4px',
                                fontSize: '11px',
                                fontWeight: 'bold',
                                boxShadow: '0 2px 6px rgba(0,0,0,0.25)',
                                zIndex: 10,
                                maxWidth: '240px',
                                lineHeight: '1.3'
                              }}
                            >
                              {mensajeInput[b.idBulto]}
                            </div>
                          )}

                          <input
                            className="input"
                            type="text"
                            maxLength={10}
                            placeholder={placeholderInput}
                            value={valorActual}
                            disabled={inputDeshabilitado}
                            onKeyDown={e => handleKeyDown(e, b.idBulto)}
                            onChange={e => handleInputChange(e, b.idBulto)}
                            style={{
                              width: '100%',
                              boxSizing: 'border-box',
                              textTransform: 'uppercase',
                              fontWeight: inputDeshabilitado ? 'normal' : 'bold',
                              backgroundColor: inputDeshabilitado ? 'transparent' : undefined,
                              opacity: inputDeshabilitado ? 0.35 : 1,
                              cursor: inputDeshabilitado ? 'not-allowed' : 'text'
                            }}
                          />

                          {!inputDeshabilitado && faltanMinimo && (
                            <div style={{ fontSize: '11px', color: '#d46b08', fontWeight: 'bold', marginTop: '3px' }}>
                              Mínimo 6 caracteres ({valorActual.length}/6)
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="right">
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '6px' }}>
                          <button
                            onClick={accionBoton}
                            disabled={!accionHabilitada}
                            className="btn btn-sm"
                            title={
                              !accionHabilitada && !esFinal
                                ? ambito === 'cd'
                                  ? 'Esta acción se realiza desde la Sucursal de destino'
                                  : 'Esta acción se realiza desde el Centro de Distribución'
                                : undefined
                            }
                            style={{
                              width: '100%',
                              maxWidth: '185px',
                              boxSizing: 'border-box',
                              whiteSpace: 'nowrap',
                              backgroundColor: !accionHabilitada ? 'transparent' : colorBoton,
                              color: !accionHabilitada ? '#999' : '#fff',
                              border: !accionHabilitada ? '1px solid #ccc' : 'none',
                              opacity: !accionHabilitada ? 0.45 : 1,
                              cursor: !accionHabilitada ? 'not-allowed' : 'pointer',
                              fontWeight: 'bold'
                            }}
                          >
                            {textoBoton}
                          </button>

                          {esRecibido && ambito === 'sucursal' && (
                            <button
                              onClick={() => solicitarRechazoViolado(b)}
                              className="btn btn-danger btn-sm"
                              style={{
                                width: '100%',
                                maxWidth: '185px',
                                boxSizing: 'border-box',
                                whiteSpace: 'nowrap'
                              }}
                            >
                              Precinto Violado
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* DESPLEGABLE: PRODUCTOS DEL REM/BULTO + TRAZABILIDAD DE CAMBIO_ESTADO CON NRO. OR */}
                    {estaExpandido && (
                      <tr>
                        <td colSpan="8" style={{ padding: '14px 20px', backgroundColor: 'rgba(0,0,0,0.015)' }}>
                          <div style={{ borderLeft: '3px solid currentColor', paddingLeft: '14px' }}>
                            {productosBulto.length > 0 && (
                              <div style={{ marginBottom: '14px' }}>
                                <h4 className="card-subtitle" style={{ marginTop: 0 }}>
                                  Mercadería Asignada al Remito {b.numeroRemito} / Bulto {b.codigoBulto} (OR: {b.numeroOrden})
                                </h4>
                                <div className="table-wrap">
                                  <table className="table">
                                    <thead>
                                      <tr>
                                        <th>Código Barras</th>
                                        <th>Producto</th>
                                        <th className="right">Cantidad en Bulto</th>
                                      </tr>
                                    </thead>
                                    <tbody>
                                      {productosBulto.map((prod, i) => (
                                        <tr key={i}>
                                          <td>{prod.codigoBarras}</td>
                                          <td className="strong">{prod.nombre}</td>
                                          <td className="right">{prod.cantidad} u.</td>
                                        </tr>
                                      ))}
                                    </tbody>
                                  </table>
                                </div>
                              </div>
                            )}

                            <div
                              style={{
                                display: 'flex',
                                justifyContent: 'space-between',
                                alignItems: 'center',
                                marginBottom: '10px',
                                flexWrap: 'wrap',
                                gap: '8px'
                              }}
                            >
                              <h4 className="card-subtitle" style={{ margin: 0 }}>
                                Trazabilidad de Cambios de Estado — {b.codigoBulto} (OR: {b.numeroOrden})
                              </h4>
                              <span className="muted" style={{ fontSize: '12px' }}>
                                Estado Precinto:{' '}
                                <strong style={{ color: esPreparado ? '#888' : b.precintoIntacto ? 'green' : 'red' }}>
                                  {esPreparado ? 'Sin asignar' : estadoPrecinto}
                                </strong>{' '}
                                | Intacto:{' '}
                                <strong style={{ color: b.precintoIntacto ? 'green' : 'red' }}>
                                  {b.precintoIntacto ? 'Sí' : 'No'}
                                </strong>
                              </span>
                            </div>

                            {historial.length === 0 ? (
                              <p className="muted" style={{ margin: 0 }}>
                                No hay registros de cambios de estado para este bulto.
                              </p>
                            ) : (
                              <div className="table-wrap">
                                <table className="table">
                                  <thead>
                                    <tr>
                                      <th>ID Cambio</th>
                                      <th>Estado</th>
                                      <th>Tipo (State)</th>
                                      <th>Fecha y Hora Inicio (GMT-3)</th>
                                      <th>Fecha y Hora Fin (GMT-3)</th>
                                      <th>Es Inicial</th>
                                      <th>Es Actual</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {historial.map(ce => (
                                      <tr key={ce.idCambioEstado} style={{ fontWeight: ce.esActual ? 'bold' : 'normal' }}>
                                        <td className="muted">{ce.idCambioEstado}</td>
                                        <td>{ce.estado}</td>
                                        <td><code>{ce.tipoEstado}</code></td>
                                        <td>{ce.fechaHoraInicio}</td>
                                        <td>{ce.fechaHoraFin || 'En curso'}</td>
                                        <td>{ce.esInicial ? 'Sí' : 'No'}</td>
                                        <td>
                                          {ce.esActual ? (
                                            <span style={{ color: 'green' }}>● Actual</span>
                                          ) : (
                                            <span className="muted">Histórico</span>
                                          )}
                                        </td>
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

      {/* MODAL DE CONFIRMACIÓN */}
      {modalConfirm && (
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
          <div
            className="card"
            style={{
              maxWidth: '430px',
              width: '90%',
              textAlign: 'center',
              margin: 0,
              borderTop:
                modalConfirm.tipo === 'violado'
                  ? '5px solid #ff4d4f'
                  : modalConfirm.tipo === 'asignar'
                  ? '5px solid #52c41a'
                  : '5px solid #1890ff'
            }}
          >
            <h3 className="card-title" style={{ color: modalConfirm.tipo === 'violado' ? '#cf1322' : undefined }}>
              {modalConfirm.titulo}
            </h3>
            <p>Bulto: <span className="strong">{modalConfirm.codigoBulto}</span></p>
            <p className="muted" style={{ lineHeight: '1.4' }}>{modalConfirm.mensaje}</p>

            {modalConfirm.precinto && (
              <div
                style={{
                  margin: '15px 0',
                  padding: '12px',
                  backgroundColor: modalConfirm.tipo === 'asignar' ? '#f6ffed' : '#e6f7ff',
                  border: modalConfirm.tipo === 'asignar' ? '1px solid #b7eb8f' : '1px solid #91d5ff',
                  borderRadius: '6px',
                  fontSize: '26px',
                  fontWeight: 'bold',
                  letterSpacing: '2px',
                  color: modalConfirm.tipo === 'asignar' ? '#237804' : '#0050b3'
                }}
              >
                {modalConfirm.precinto}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '20px' }}>
              <button type="button" onClick={() => setModalConfirm(null)} className="btn">
                Cancelar
              </button>
              <button
                type="button"
                onClick={ejecutarAccionConfirmada}
                className={modalConfirm.tipo === 'violado' ? 'btn btn-danger' : 'btn btn-primary'}
                style={modalConfirm.tipo === 'asignar' ? { backgroundColor: '#52c41a', borderColor: '#52c41a' } : undefined}
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}