import React, { useState, useEffect, useRef } from 'react';
import { apiService } from '../api/apiService';

export default function EstablecimientosABM() {
  const [establecimientos, setEstablecimientos] = useState([]);

  // Estados para selección y visualización de productos
  const [establecimientoSeleccionado, setEstablecimientoSeleccionado] = useState(null);
  const [productosStock, setProductosStock] = useState([]);
  const [cargandoStock, setCargandoStock] = useState(false);

  // Referencia para hacer scroll suave hacia el inicio de la grilla de productos
  const seccionProductosRef = useRef(null);

  const [form, setForm] = useState({
    nombre: '',
    direccion: '',
    telefono: '',
    numeroSucursal: ''
  });

  const [errores, setErrores] = useState({});
  const [enviando, setEnviando] = useState(false);

  // Estado del modal de confirmación de alta de sucursal
  const [modalConfirmarAlta, setModalConfirmarAlta] = useState(null);

  useEffect(() => {
    cargarEstablecimientos();
  }, []);

  const cargarEstablecimientos = async () => {
    const res = await apiService.getEstablecimientos();
    if (res && res.datos) {
      setEstablecimientos(res.datos);
    }
  };

  // Cálculo incremental automático del próximo Código de Sucursal (Ej: SUC01 -> SUC08)
  const siguienteCodigoSucursal = (() => {
    const sucursales = establecimientos.filter(e => e.tipo === 'sucursal');
    if (sucursales.length === 0) return 'SUC01';

    let maxNum = 0;
    sucursales.forEach(s => {
      const match = String(s.codigo || '').toUpperCase().match(/^SUC-?0*(\d+)$/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (num > maxNum) maxNum = num;
      }
    });

    const siguiente = maxNum > 0 ? maxNum + 1 : sucursales.length + 1;
    return `SUC${String(siguiente).padStart(2, '0')}`;
  })();

  const handleSeleccionarEstablecimiento = async (est) => {
    setEstablecimientoSeleccionado(est);
    setCargandoStock(true);

    // Desplazar suavemente hasta el inicio de la grilla de productos
    setTimeout(() => {
      if (seccionProductosRef.current) {
        seccionProductosRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }
    }, 60);

    const res = await apiService.getStockPorEstablecimiento(est.idEstablecimiento);
    if (res && res.datos) {
      setProductosStock(res.datos);
    } else {
      setProductosStock([]);
    }
    setCargandoStock(false);
  };

  // --- MANEJO Y VALIDACIÓN DE CAMPOS ---
  const handleNombreChange = (e) => {
    const limpio = e.target.value.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s.,-]/g, '').slice(0, 60);
    setForm(prev => ({ ...prev, nombre: limpio }));
    if (errores.nombre) setErrores(prev => ({ ...prev, nombre: null }));
  };

  const handleDireccionChange = (e) => {
    const limpio = e.target.value.replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s.,°/-]/g, '').slice(0, 100);
    setForm(prev => ({ ...prev, direccion: limpio }));
    if (errores.direccion) setErrores(prev => ({ ...prev, direccion: null }));
  };

  const handleTelefonoChange = (e) => {
    const limpio = e.target.value.replace(/[^0-9+\s()-]/g, '').slice(0, 20);
    setForm(prev => ({ ...prev, telefono: limpio }));
    if (errores.telefono) setErrores(prev => ({ ...prev, telefono: null }));
  };

  const handleNumeroSucursalChange = (e) => {
    const soloDigitos = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
    setForm(prev => ({ ...prev, numeroSucursal: soloDigitos }));
    if (errores.numeroSucursal) setErrores(prev => ({ ...prev, numeroSucursal: null }));
  };

  const validarFormulario = () => {
    const nuevosErrores = {};
    const nom = form.nombre.trim();
    const dir = form.direccion.trim();
    const tel = form.telefono.trim();
    const numSuc = Number(form.numeroSucursal);

    if (!nom) {
      nuevosErrores.nombre = 'El nombre de la sucursal es obligatorio.';
    } else if (nom.length < 3) {
      nuevosErrores.nombre = 'El nombre debe tener al menos 3 caracteres.';
    }

    if (!dir) {
      nuevosErrores.direccion = 'La dirección es obligatoria.';
    } else if (dir.length < 5) {
      nuevosErrores.direccion = 'Ingrese una dirección válida (mínimo 5 caracteres).';
    }

    if (tel && tel.replace(/[^0-9]/g, '').length < 6) {
      nuevosErrores.telefono = 'Si ingresa teléfono, debe contener al menos 6 dígitos.';
    }

    if (!form.numeroSucursal) {
      nuevosErrores.numeroSucursal = 'El N° de sucursal es obligatorio.';
    } else if (numSuc <= 0) {
      nuevosErrores.numeroSucursal = 'Debe ser un número mayor a 0.';
    } else if (
      establecimientos.some(
        e => e.tipo === 'sucursal' && Number(e.numeroSucursal) === numSuc
      )
    ) {
      nuevosErrores.numeroSucursal = `El N° de sucursal ${numSuc} ya está registrado.`;
    }

    setErrores(nuevosErrores);
    return Object.keys(nuevosErrores).length === 0;
  };

  // Paso 1: Validar y abrir el modal de confirmación
  const handleSolicitarAlta = (e) => {
    e.preventDefault();
    if (!validarFormulario()) return;

    setModalConfirmarAlta({
      codigo: siguienteCodigoSucursal,
      nombre: form.nombre.trim(),
      direccion: form.direccion.trim(),
      telefono: form.telefono.trim(),
      numeroSucursal: parseInt(form.numeroSucursal, 10)
    });
  };

  // Paso 2: Confirmar en el modal y enviar al backend
  const ejecutarAltaSucursal = async () => {
    if (!modalConfirmarAlta) return;

    const datosNuevaSucursal = modalConfirmarAlta;
    setModalConfirmarAlta(null);
    setEnviando(true);

    try {
      const res = await apiService.crearSucursal(datosNuevaSucursal);

      if (res && res.status === 'error') {
        alert(res.mensaje || 'Error al crear la sucursal.');
      } else {
        alert(res?.mensaje || `Sucursal ${datosNuevaSucursal.codigo} creada exitosamente.`);
        setForm({ nombre: '', direccion: '', telefono: '', numeroSucursal: '' });
        setErrores({});
        await cargarEstablecimientos();
      }
    } finally {
      setEnviando(false);
    }
  };

  return (
    <div className="page" style={{ position: 'relative' }}>
      <h2 className="page-title">Administrar Establecimientos</h2>

      {/* 1. Tabla de Establecimientos */}
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
              {establecimientos.length === 0 ? (
                <tr>
                  <td colSpan="6" className="empty">
                    No hay establecimientos registrados.
                  </td>
                </tr>
              ) : (
                establecimientos.map(e => (
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
                        type="button"
                        className="btn btn-outline btn-sm"
                        onClick={() => handleSeleccionarEstablecimiento(e)}
                      >
                        Ver Productos
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* 2. Panel Detalle de Productos del Establecimiento Seleccionado */}
      {establecimientoSeleccionado && (
        <section
          ref={seccionProductosRef}
          className="card highlight"
          style={{ scrollMarginTop: '20px' }}
        >
          <h3 className="card-title">
            Productos en stock para: <span className="accent">{establecimientoSeleccionado.nombre}</span>{' '}
            <span className="muted">({establecimientoSeleccionado.tipo})</span>
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

      {/* 3. Formulario de Alta de Sucursal (Debajo de todo) */}
      <section className="card">
        <h3 className="card-title">Nueva Sucursal</h3>

        <form onSubmit={handleSolicitarAlta} noValidate>
          <div className="form-grid">
            <div>
              <input
                className="input"
                type="text"
                value={`Código: ${siguienteCodigoSucursal} (Automático)`}
                readOnly
                disabled
                title="Código de sucursal asignado de forma incremental"
                style={{ opacity: 0.75, cursor: 'not-allowed', fontWeight: 'bold' }}
              />
            </div>

            <div>
              <input
                className="input"
                placeholder="Nombre de la Sucursal"
                value={form.nombre}
                onChange={handleNombreChange}
                maxLength={60}
                required
              />
              {errores.nombre && (
                <div style={{ color: '#cf1322', fontSize: '12px', marginTop: '4px' }}>
                  {errores.nombre}
                </div>
              )}
            </div>

            <div>
              <input
                className="input"
                placeholder="Dirección"
                value={form.direccion}
                onChange={handleDireccionChange}
                maxLength={100}
                required
              />
              {errores.direccion && (
                <div style={{ color: '#cf1322', fontSize: '12px', marginTop: '4px' }}>
                  {errores.direccion}
                </div>
              )}
            </div>

            <div>
              <input
                className="input"
                placeholder="Teléfono (Opcional)"
                value={form.telefono}
                onChange={handleTelefonoChange}
                maxLength={20}
              />
              {errores.telefono && (
                <div style={{ color: '#cf1322', fontSize: '12px', marginTop: '4px' }}>
                  {errores.telefono}
                </div>
              )}
            </div>

            <div>
              <input
                className="input"
                type="text"
                inputMode="numeric"
                placeholder="N° Sucursal (Ej: 401)"
                value={form.numeroSucursal}
                onChange={handleNumeroSucursalChange}
                maxLength={4}
                required
              />
              {errores.numeroSucursal && (
                <div style={{ color: '#cf1322', fontSize: '12px', marginTop: '4px' }}>
                  {errores.numeroSucursal}
                </div>
              )}
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary" disabled={enviando}>
              {enviando ? 'Guardando...' : 'Agregar Sucursal'}
            </button>
          </div>
        </form>
      </section>

      {/* MODAL DE CONFIRMACIÓN DE ALTA DE SUCURSAL */}
      {modalConfirmarAlta && (
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
              maxWidth: '450px',
              width: '90%',
              textAlign: 'center',
              margin: 0,
              borderTop: '5px solid #1890ff'
            }}
          >
            <h3 className="card-title">¿Confirmar Alta de Sucursal?</h3>
            <p className="muted" style={{ lineHeight: '1.4' }}>
              ¿Desea registrar la siguiente nueva sucursal en el sistema?
            </p>

            <div
              style={{
                margin: '14px 0',
                padding: '12px 16px',
                backgroundColor: 'rgba(24, 144, 255, 0.08)',
                border: '1px solid rgba(24, 144, 255, 0.3)',
                borderRadius: '6px',
                textAlign: 'left',
                lineHeight: '1.7'
              }}
            >
              <div>
                <span className="muted">Código:</span>{' '}
                <strong style={{ fontSize: '16px', color: '#1890ff' }}>{modalConfirmarAlta.codigo}</strong>
              </div>
              <div>
                <span className="muted">Nombre:</span>{' '}
                <strong className="strong">{modalConfirmarAlta.nombre}</strong>
              </div>
              <div>
                <span className="muted">Dirección:</span>{' '}
                <strong>{modalConfirmarAlta.direccion}</strong>
              </div>
              <div>
                <span className="muted">Teléfono:</span>{' '}
                <strong>{modalConfirmarAlta.telefono || 'Sin especificar'}</strong>
              </div>
              <div>
                <span className="muted">N° Sucursal:</span>{' '}
                <strong>{modalConfirmarAlta.numeroSucursal}</strong>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '20px' }}>
              <button
                type="button"
                onClick={() => setModalConfirmarAlta(null)}
                className="btn"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={ejecutarAltaSucursal}
                className="btn btn-primary"
              >
                Confirmar y Añadir
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}