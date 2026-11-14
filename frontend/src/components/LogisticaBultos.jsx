import React, { useState, useEffect } from 'react';
import { apiService } from '../api/apiService';

export default function LogisticaBultos({ idSucursal, sucursalActual }) {
  const [bultos, setBultos] = useState([]);
  const [codigoInput, setCodigoInput] = useState({});
  const [modalConfirm, setModalConfirm] = useState(null);
  
  const [mensajeInput, setMensajeInput] = useState({});
  const [bultoExpandidoId, setBultoExpandidoId] = useState(null);

  useEffect(() => {
    setBultoExpandidoId(null);
    if (idSucursal) {
      cargarBultos();
    } else {
      setBultos([]);
    }
  }, [idSucursal]);

  const cargarBultos = async () => {
    const res = await apiService.getBultos(idSucursal);
    if (res && res.datos) {
      const filtrados = idSucursal
        ? res.datos.filter(b => Number(b.idDestino) === Number(idSucursal))
        : res.datos;
      setBultos(filtrados);
    }
  };

  const toggleDesplegable = (idBulto) => {
    setBultoExpandidoId(prev => (prev === idBulto ? null : idBulto));
  };

  // --- MANEJO DE ENTRADA Y VALIDACIÓN DE CARACTERES ---
  const mostrarCartelTemporal = (idBulto, texto) => {
    setMensajeInput(prev => ({ ...prev, [idBulto]: texto }));
    setTimeout(() => {
      setMensajeInput(prev => {
        if (prev[idBulto] === texto) {
          return { ...prev, [idBulto]: null };
        }
        return prev;
      });
    }, 2600);
  };

  const handleKeyDown = (e, idBulto) => {
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

    const currentVal = codigoInput[idBulto] || '';
    if (currentVal.length >= 10) {
      e.preventDefault();
      mostrarCartelTemporal(idBulto, 'Máximo 10 caracteres permitidos');
      return;
    }

    const esValido = /^[a-zA-Z0-9-]$/.test(e.key);
    if (!esValido) {
      e.preventDefault();
      mostrarCartelTemporal(idBulto, 'Solo caracteres alfanuméricos (A-Z, 0-9) y -');
    }
  };

  const handleInputChange = (e, idBulto) => {
    const rawValue = e.target.value;
    const upperValue = rawValue.toUpperCase();
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

    const regex = /^[A-Z0-9-]{6,10}$/;
    if (!regex.test(precinto)) {
      const msgError = 'El Código Precinto debe estar comprendido entre 6 y 10 caracteres (A-Z, 0-9, -)';
      mostrarCartelTemporal(idBulto, msgError);
      alert(msgError);
      return false;
    }
    return true;
  };

  // --- PREPARADORES DE CONFIRMACIÓN (MODALES) ---
  const solicitarAsignarPrecinto = (bulto) => {
    const precinto = (codigoInput[bulto.idBulto] || '').trim();
    if (!validarCodigoPrecinto(bulto.idBulto, precinto, 'Por favor, ingrese el código de precinto en el cuadro de texto.')) return;

    setModalConfirm({
      tipo: 'asignar',
      idBulto: bulto.idBulto,
      codigoBulto: bulto.codigoBulto,
      precinto: precinto,
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
      mensaje: `Se confirmará la recepción física del bulto en la sucursal "${bulto.destino}" y pasará a estado RECIBIDO.`
    });
  };

  const solicitarVerificarPrecinto = (bulto) => {
    const precinto = (codigoInput[bulto.idBulto] || '').trim();
    if (!validarCodigoPrecinto(bulto.idBulto, precinto, 'Por favor, ingrese el código de precinto para verificar.')) return;

    setModalConfirm({
      tipo: 'verificar',
      idBulto: bulto.idBulto,
      codigoBulto: bulto.codigoBulto,
      precinto: precinto,
      titulo: 'Confirmar Verificación de Precinto',
      mensaje: `Se verificará el siguiente código ingresado contra el precinto del bulto (Oportunidades restantes: ${bulto.intentosRestantes ?? 3}):`
    });
  };

  const solicitarRechazoViolado = (bulto) => {
    setModalConfirm({
      tipo: 'violado',
      idBulto: bulto.idBulto,
      codigoBulto: bulto.codigoBulto,
      titulo: '⚠️ Reportar Precinto Violado',
      mensaje: 'ATENCIÓN: Se confirmará el estado del bulto como PRECINTO VIOLADO, pasando directamente a estado RECHAZADO y bloqueando el ingreso de su mercadería a la venta.'
    });
  };

  // --- EJECUTAR ACCIÓN TRAS ACEPTAR MODAL ---
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

  return (
    <div style={{ position: 'relative' }}>
      <h3>
        Remitos y Trazabilidad de Bultos (Patrón State) —{' '}
        {sucursalActual ? sucursalActual.nombre : 'Seleccione una sucursal'}
      </h3>
      
      <table 
        border="1" 
        cellPadding="8" 
        style={{ 
          width: '100%', 
          borderCollapse: 'collapse',
          tableLayout: 'fixed'
        }}
      >
        <thead>
          <tr style={{ backgroundColor: '#f2f2f2' }}>
            <th style={{ width: '7%' }}>ID Remito</th>
            <th style={{ width: '11%' }}>Nro. Remito</th>
            <th style={{ width: '8%' }}>ID Bulto</th>
            <th style={{ width: '10%' }}>Código Bulto</th>
            <th style={{ width: '19%' }}>Origen &rarr; Destino</th>
            <th style={{ width: '10%' }}>Estado Actual</th>
            <th style={{ width: '17%', minWidth: '185px' }}>Precinto Ingresado</th>
            <th style={{ width: '18%', minWidth: '195px' }}>Acción</th>
          </tr>
        </thead>
        <tbody>
          {bultos.length === 0 ? (
            <tr>
              <td colSpan="8" style={{ textAlign: 'center', color: '#777', padding: '16px' }}>
                No hay remitos/bultos con destino a esta sucursal.
              </td>
            </tr>
          ) : (
            bultos.map(b => {
              const estado = (b.estadoActual || '').toLowerCase();
              const estaExpandido = bultoExpandidoId === b.idBulto;
              
              const esPreparado = estado === 'preparado';
              const esPrecintado = estado === 'precintado';
              const esEnTransito = estado === 'en tránsito' || estado === 'en transito';
              const esRecibido = estado === 'recibido';
              const esFinal = estado === 'verificado' || estado === 'rechazado';

              const inputDeshabilitado = esPrecintado || esEnTransito || esFinal;
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

              const estiloInput = {
                padding: '6px',
                width: '100%',
                boxSizing: 'border-box',
                borderRadius: '4px',
                textTransform: 'uppercase',
                fontWeight: inputDeshabilitado ? 'normal' : 'bold',
                backgroundColor: inputDeshabilitado ? 'transparent' : '#fff',
                opacity: inputDeshabilitado ? 0.35 : 1,
                border: inputDeshabilitado ? '1px dashed #ccc' : '1px solid #888',
                cursor: inputDeshabilitado ? 'not-allowed' : 'text'
              };

              let placeholderInput = "CODIGO PRECINTO";
              if (esFinal) placeholderInput = "BULTO CERRADO";
              else if (esPrecintado) placeholderInput = "PRECINTO ASIGNADO";
              else if (esEnTransito) placeholderInput = "EN VIAJE";
              else if (esPreparado) placeholderInput = "CODIGO PRECINTO";
              else if (esRecibido) placeholderInput = `COD PREC (${b.intentosRestantes ?? 3} INTENTOS)`;

              const historial = b.historialEstados || [];
              const estadoPrecinto = b.estadoPrecinto || (b.precintoIntacto ? 'INTACTO' : 'VIOLADO');

              return (
                <React.Fragment key={b.idBulto}>
                  <tr style={{ backgroundColor: estaExpandido ? '#fafafa' : '#fff' }}>
                    <td><strong>{b.idRemito}</strong></td>
                    <td><strong>{b.numeroRemito || '-'}</strong></td>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '4px' }}>
                        <span>{b.idBulto}</span>
                        <button
                          type="button"
                          onClick={() => toggleDesplegable(b.idBulto)}
                          title={estaExpandido ? 'Ocultar historial de estados' : 'Ver historial de cambios de estado'}
                          style={{
                            padding: '2px 7px',
                            fontSize: '11px',
                            backgroundColor: estaExpandido ? '#1890ff' : '#f0f0f0',
                            color: estaExpandido ? '#fff' : '#333',
                            border: '1px solid #ccc',
                            borderRadius: '4px',
                            cursor: 'pointer',
                            fontWeight: 'bold'
                          }}
                        >
                          {estaExpandido ? '▲' : '▼'}
                        </button>
                      </div>
                    </td>
                    <td><strong>{b.codigoBulto}</strong></td>
                    <td>
                      <span style={{ color: '#555' }}>{b.origen}</span> &rarr; <strong>{b.destino}</strong>
                    </td>
                    <td>
                      <span style={{
                        fontWeight: 'bold',
                        color: estado === 'verificado' ? 'green' : 
                               estado === 'rechazado' ? 'red' : 
                               esPreparado ? '#52c41a' :
                               esPrecintado ? '#fa8c16' :
                               esEnTransito ? '#722ed1' : '#1890ff'
                      }}>
                        {b.estadoActual}
                      </span>
                    </td>
                    <td>
                      <div style={{ position: 'relative', width: '100%' }}>
                        {mensajeInput[b.idBulto] && !inputDeshabilitado && (
                          <div style={{
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
                          }}>
                            {mensajeInput[b.idBulto]}
                          </div>
                        )}

                        <input 
                          type="text" 
                          maxLength={10}
                          placeholder={placeholderInput}
                          value={valorActual}
                          disabled={inputDeshabilitado}
                          onKeyDown={e => handleKeyDown(e, b.idBulto)}
                          onChange={e => handleInputChange(e, b.idBulto)}
                          style={estiloInput}
                        />

                        {!inputDeshabilitado && faltanMinimo && (
                          <div style={{
                            fontSize: '11px',
                            color: '#d46b08',
                            fontWeight: 'bold',
                            marginTop: '3px'
                          }}>
                            Ingrese como mínimo 6 caracteres ({valorActual.length}/6)
                          </div>
                        )}
                      </div>
                    </td>
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '6px' }}>
                      <button 
                      onClick={accionBoton}
                      disabled={esFinal}
                      style={{
                        padding: '6px 10px',
                        width: '100%',
                        maxWidth: '185px',
                        boxSizing: 'border-box',
                        whiteSpace: 'nowrap',
                        backgroundColor: esFinal ? 'transparent' : colorBoton,
                        color: esFinal ? '#999' : '#fff',
                        border: esFinal ? '1px solid #ccc' : 'none',
                        borderRadius: '4px',
                        opacity: esFinal ? 0.45 : 1,
                        cursor: esFinal ? 'not-allowed' : 'pointer',
                        fontWeight: 'bold'
                      }}
                    >
                      {textoBoton}
                    </button>
                        {esRecibido && (
                          <button 
                            onClick={() => solicitarRechazoViolado(b)}
                            style={{
                              padding: '5px 10px',
                              width: '100%',
                              maxWidth: '170px',
                              whiteSpace: 'nowrap',
                              backgroundColor: '#ff4d4f',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '4px',
                              cursor: 'pointer',
                              fontWeight: 'bold',
                              fontSize: '12px'
                            }}
                          >
                            Precinto Violado
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>

                  {/* FILA DESPLEGABLE CON HISTORIAL DE CAMBIOS DE ESTADO */}
                  {estaExpandido && (
                    <tr>
                      <td colSpan="8" style={{ backgroundColor: '#f6f8fa', padding: '14px 20px' }}>
                        <div style={{
                          borderLeft: '4px solid #1890ff',
                          paddingLeft: '14px'
                        }}>
                          <div style={{
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            marginBottom: '10px',
                            flexWrap: 'wrap',
                            gap: '8px'
                          }}>
                            <strong style={{ fontSize: '14px', color: '#1f1f1f' }}>
                              Trazabilidad de Cambios de Estado — {b.codigoBulto} (Remito: {b.numeroRemito || b.idRemito})
                            </strong>
                            <span style={{ fontSize: '12px', color: '#555' }}>
                              Estado Precinto:{' '}
                              <strong style={{ color: esPreparado ? '#888' : (b.precintoIntacto ? 'green' : 'red') }}>
                                {esPreparado ? 'Sin asignar' : estadoPrecinto}
                              </strong>{' '}
                              | Intacto:{' '}
                              <strong style={{ color: b.precintoIntacto ? 'green' : 'red' }}>
                                {b.precintoIntacto ? 'Sí' : 'No'}
                              </strong>
                            </span>
                          </div>

                          {historial.length === 0 ? (
                            <p style={{ margin: 0, color: '#777', fontSize: '13px' }}>
                              No hay registros de cambios de estado para este bulto.
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
                                  <tr
                                    key={ce.idCambioEstado}
                                    style={{
                                      backgroundColor: ce.esActual ? '#f6ffed' : '#fff',
                                      fontWeight: ce.esActual ? 'bold' : 'normal'
                                    }}
                                  >
                                    <td>{ce.idCambioEstado}</td>
                                    <td>{ce.estado}</td>
                                    <td><code>{ce.tipoEstado}</code></td>
                                    <td>{ce.fechaHoraInicio}</td>
                                    <td>{ce.fechaHoraFin || 'En curso'}</td>
                                    <td>{ce.esInicial ? 'Sí' : 'No'}</td>
                                    <td>
                                      {ce.esActual ? (
                                        <span style={{ color: 'green' }}>● Actual</span>
                                      ) : (
                                        <span style={{ color: '#888' }}>Histórico</span>
                                      )}
                                    </td>
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

      {/* MODAL DE CONFIRMACIÓN */}
      {modalConfirm && (
        <div style={{
          position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
          backgroundColor: 'rgba(0,0,0,0.5)', display: 'flex',
          alignItems: 'center', justifyContent: 'center', zIndex: 1000
        }}>
          <div style={{
            backgroundColor: '#fff', padding: '25px', borderRadius: '8px',
            maxWidth: '430px', width: '90%', textAlign: 'center',
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
            borderTop: modalConfirm.tipo === 'violado' ? '5px solid #ff4d4f' : 
                       modalConfirm.tipo === 'asignar' ? '5px solid #52c41a' : '5px solid #1890ff'
          }}>
            <h3 style={{ marginTop: 0, color: modalConfirm.tipo === 'violado' ? '#cf1322' : '#000' }}>
              {modalConfirm.titulo}
            </h3>
            <p style={{ color: '#444' }}>Bulto: <strong>{modalConfirm.codigoBulto}</strong></p>
            <p style={{ color: '#555', lineHeight: '1.4' }}>{modalConfirm.mensaje}</p>
            
            {modalConfirm.precinto && (
              <div style={{
                margin: '15px 0', 
                padding: '12px', 
                backgroundColor: modalConfirm.tipo === 'asignar' ? '#f6ffed' : '#e6f7ff',
                border: modalConfirm.tipo === 'asignar' ? '1px solid #b7eb8f' : '1px solid #91d5ff', 
                borderRadius: '6px',
                fontSize: '26px', 
                fontWeight: 'bold', 
                letterSpacing: '2px', 
                color: modalConfirm.tipo === 'asignar' ? '#237804' : '#0050b3'
              }}>
                {modalConfirm.precinto}
              </div>
            )}

            <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '20px' }}>
              <button 
                onClick={() => setModalConfirm(null)}
                style={{
                  padding: '8px 18px', backgroundColor: '#f5f5f5', border: '1px solid #d9d9d9',
                  borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'
                }}
              >
                Cancelar
              </button>
              <button 
                onClick={ejecutarAccionConfirmada}
                style={{
                  padding: '8px 18px', 
                  backgroundColor: modalConfirm.tipo === 'violado' ? '#ff4d4f' : 
                                   modalConfirm.tipo === 'asignar' ? '#52c41a' : '#1890ff', 
                  color: '#fff',
                  border: 'none', borderRadius: '4px', cursor: 'pointer', fontWeight: 'bold'
                }}
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}