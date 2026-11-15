import React, { useState, useEffect } from 'react';
import { apiService } from '../api/apiService';

export default function ProductosABM() {
  const [establecimientos, setEstablecimientos] = useState([]);
  const [ambito, setAmbito] = useState('cd'); // 'cd' | 'sucursal'
  const [idSucursalSeleccionada, setIdSucursalSeleccionada] = useState('');

  const [productosGlobales, setProductosGlobales] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [stockEstablecimiento, setStockEstablecimiento] = useState([]);

  // Buscador escribible + desplegable para asignar stock
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [idProductoSeleccionado, setIdProductoSeleccionado] = useState('');
  const [cantidadStock, setCantidadStock] = useState('10');
  const [errorAsignacion, setErrorAsignacion] = useState('');

  // Filtro por categoría en el Catálogo de Productos
  const [filtroCategoriaId, setFiltroCategoriaId] = useState('TODAS');

  // Formulario para añadir nuevo producto al catálogo
  const [formNuevoProd, setFormNuevoProd] = useState({
    codigoBarras: '',
    nombre: '',
    precioVenta: '',
    costoUnitario: '',
    stockMinimo: '5',
    idCategoria: ''
  });
  const [erroresNuevoProd, setErroresNuevoProd] = useState({});

  // Modales de confirmación
  const [modalConfirmarStock, setModalConfirmarStock] = useState(null);
  const [modalConfirmarNuevoProd, setModalConfirmarNuevoProd] = useState(null);
  const [modalEstadoProducto, setModalEstadoProducto] = useState(null);
  const [modalQuitarLocal, setModalQuitarLocal] = useState(null);

  useEffect(() => {
    cargarInicial();
  }, []);

  const cargarInicial = async () => {
    const [resEst, resProd, resCat] = await Promise.all([
      apiService.getEstablecimientos(),
      apiService.getProductos(),
      apiService.getCategorias ? apiService.getCategorias() : Promise.resolve({ datos: [] })
    ]);

    if (resEst && resEst.datos) {
      setEstablecimientos(resEst.datos);
      const sucursales = resEst.datos.filter(e => e.tipo === 'sucursal');
      if (sucursales.length > 0 && !idSucursalSeleccionada) {
        setIdSucursalSeleccionada(String(sucursales[0].idEstablecimiento));
      }
    }

    if (resProd && resProd.datos) {
      setProductosGlobales(resProd.datos);
    }

    if (resCat && resCat.datos) {
      setCategorias(resCat.datos);
      if (resCat.datos.length > 0 && !formNuevoProd.idCategoria) {
        setFormNuevoProd(prev => ({
          ...prev,
          idCategoria: String(resCat.datos[0].idCategoria)
        }));
      }
    }
  };

  // Establecimiento activo según el modo texto ('cd' o 'sucursal')
  const centroDistribucion = establecimientos.find(e => e.tipo !== 'sucursal') || null;
  const listaSucursales = establecimientos.filter(e => e.tipo === 'sucursal');
  const sucursalActual =
    listaSucursales.find(s => String(s.idEstablecimiento) === String(idSucursalSeleccionada)) || null;

  const establecimientoActivo = ambito === 'cd' ? centroDistribucion : sucursalActual;
  const idEstablecimientoActivo = establecimientoActivo?.idEstablecimiento || '';

  useEffect(() => {
    if (idEstablecimientoActivo) {
      cargarStockLocal(idEstablecimientoActivo);
    } else {
      setStockEstablecimiento([]);
    }
  }, [idEstablecimientoActivo]);

  const cargarStockLocal = async (idEst) => {
    const resStock = await apiService.getStockPorEstablecimiento(idEst);
    if (resStock && resStock.datos) {
      setStockEstablecimiento(resStock.datos);
    } else {
      setStockEstablecimiento([]);
    }
  };

  // --- BUSCADOR ESCRIBIBLE + DESPLEGABLE DE PRODUCTOS HABILITADOS ---
  const productosHabilitados = productosGlobales.filter(p => p.esActivo !== false);

  const formatearOpcionProducto = (p) => `${p.nombre} — Cód: ${p.codigoBarras}`;

  const handleBusquedaProductoChange = (e) => {
    const valor = e.target.value;
    setBusquedaProducto(valor);
    setErrorAsignacion('');

    const valorNorm = valor.trim().toLowerCase();
    const coincidencia = productosHabilitados.find(
      p =>
        formatearOpcionProducto(p).toLowerCase() === valorNorm ||
        p.nombre.toLowerCase() === valorNorm ||
        String(p.codigoBarras).toLowerCase() === valorNorm
    );

    if (coincidencia) {
      setIdProductoSeleccionado(String(coincidencia.idProducto));
    } else {
      setIdProductoSeleccionado('');
    }
  };

  // --- VALIDACIÓN DE CANTIDAD A ASIGNAR ---
  const handleCantidadStockKeyDown = (e) => {
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
    if (!/^[0-9]$/.test(e.key)) {
      e.preventDefault();
      return;
    }
    const sinSeleccion = e.target.selectionStart === e.target.selectionEnd;
    if (sinSeleccion && String(cantidadStock).length >= 4) {
      e.preventDefault();
    }
  };

  const handleCantidadStockChange = (e) => {
    const soloDigitos = e.target.value.replace(/[^0-9]/g, '').slice(0, 4);
    setCantidadStock(soloDigitos);
    setErrorAsignacion('');
  };

  // --- SOLICITAR ASIGNACIÓN DE STOCK (ABRE MODAL) ---
  const handleSolicitarGuardarStockLocal = (e) => {
    e.preventDefault();
    if (!idEstablecimientoActivo) {
      return setErrorAsignacion('Seleccione un establecimiento válido.');
    }

    // Buscar coincidencia si escribió nombre o código exacto sin elegir del datalist
    let prodSeleccionado = productosGlobales.find(
      p => String(p.idProducto) === String(idProductoSeleccionado)
    );

    if (!prodSeleccionado && busquedaProducto.trim()) {
      const q = busquedaProducto.trim().toLowerCase();
      prodSeleccionado = productosGlobales.find(
        p =>
          formatearOpcionProducto(p).toLowerCase() === q ||
          p.nombre.toLowerCase() === q ||
          String(p.codigoBarras).toLowerCase() === q
      );
    }

    if (!prodSeleccionado) {
      return setErrorAsignacion('Seleccione o escriba un producto válido del catálogo.');
    }

    if (prodSeleccionado.esActivo === false) {
      return setErrorAsignacion(
        `El producto "${prodSeleccionado.nombre}" está deshabilitado y no puede recibir stock.`
      );
    }

    const cantNum = parseInt(cantidadStock, 10);
    if (!cantidadStock || isNaN(cantNum) || cantNum <= 0) {
      return setErrorAsignacion('Ingrese una cantidad válida mayor a 0 (1 a 9999).');
    }

    setModalConfirmarStock({
      idEstablecimiento: idEstablecimientoActivo,
      establecimientoNombre: establecimientoActivo.nombre,
      idProducto: prodSeleccionado.idProducto,
      productoNombre: prodSeleccionado.nombre,
      codigoBarras: prodSeleccionado.codigoBarras,
      cantidadDisponible: cantNum
    });
  };

  const ejecutarGuardarStockLocal = async () => {
    if (!modalConfirmarStock) return;
    const datos = modalConfirmarStock;
    setModalConfirmarStock(null);

    const res = await apiService.guardarStockEstablecimiento(
      datos.idEstablecimiento,
      datos.idProducto,
      datos.cantidadDisponible
    );

    if (res && res.status === 'success') {
      alert(res.mensaje || 'Stock actualizado correctamente.');
      cargarStockLocal(datos.idEstablecimiento);
      setBusquedaProducto('');
      setIdProductoSeleccionado('');
      setCantidadStock('10');
      setErrorAsignacion('');
    } else {
      alert(res?.mensaje || 'Error al actualizar stock.');
    }
  };

  // --- QUITAR PRODUCTO DEL ESTABLECIMIENTO PUNTUAL ---
  const ejecutarQuitarStockLocal = async () => {
    if (!modalQuitarLocal) return;
    const item = modalQuitarLocal;
    setModalQuitarLocal(null);

    await apiService.quitarStockEstablecimiento(item.idStockItem);
    cargarStockLocal(idEstablecimientoActivo);
  };

  // --- VALIDACIÓN Y ALTA DE NUEVO PRODUCTO AL CATÁLOGO ---
  const validarNuevoProducto = () => {
    const errs = {};
    const cod = formNuevoProd.codigoBarras.trim();
    const nom = formNuevoProd.nombre.trim();
    const pVenta = parseFloat(formNuevoProd.precioVenta);
    const pCosto = parseFloat(formNuevoProd.costoUnitario);
    const stMin = parseInt(formNuevoProd.stockMinimo, 10);

    if (!cod || cod.length < 4) {
      errs.codigoBarras = 'El código de barras debe tener al menos 4 caracteres.';
    } else if (productosGlobales.some(p => String(p.codigoBarras) === cod)) {
      errs.codigoBarras = `El código de barras "${cod}" ya existe.`;
    }

    if (!nom || nom.length < 3) {
      errs.nombre = 'El nombre debe tener al menos 3 caracteres.';
    }

    if (isNaN(pVenta) || pVenta <= 0) {
      errs.precioVenta = 'El precio de venta debe ser mayor a 0.';
    }

    if (isNaN(pCosto) || pCosto <= 0) {
      errs.costoUnitario = 'El costo unitario debe ser mayor a 0.';
    }

    if (isNaN(stMin) || stMin < 0) {
      errs.stockMinimo = 'El stock mínimo debe ser 0 o mayor.';
    }

    if (!formNuevoProd.idCategoria) {
      errs.idCategoria = 'Seleccione una categoría.';
    }

    setErroresNuevoProd(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSolicitarCrearProducto = (e) => {
    e.preventDefault();
    if (!validarNuevoProducto()) return;

    const catObj = categorias.find(
      c => String(c.idCategoria) === String(formNuevoProd.idCategoria)
    );

    setModalConfirmarNuevoProd({
      codigoBarras: formNuevoProd.codigoBarras.trim(),
      nombre: formNuevoProd.nombre.trim(),
      precioVenta: parseFloat(formNuevoProd.precioVenta),
      costoUnitario: parseFloat(formNuevoProd.costoUnitario),
      stockMinimo: parseInt(formNuevoProd.stockMinimo || '5', 10),
      idCategoria: parseInt(formNuevoProd.idCategoria, 10),
      categoriaNombre: catObj ? catObj.nombre : `ID ${formNuevoProd.idCategoria}`
    });
  };

  const ejecutarCrearProducto = async () => {
    if (!modalConfirmarNuevoProd) return;
    const datosProd = modalConfirmarNuevoProd;
    setModalConfirmarNuevoProd(null);

    const res = await apiService.crearProducto(datosProd);
    if (res && res.status === 'success') {
      alert(res.mensaje || 'Producto añadido al catálogo.');
      setFormNuevoProd(prev => ({
        codigoBarras: '',
        nombre: '',
        precioVenta: '',
        costoUnitario: '',
        stockMinimo: '5',
        idCategoria: prev.idCategoria
      }));
      setErroresNuevoProd({});
      const resProd = await apiService.getProductos();
      if (resProd && resProd.datos) setProductosGlobales(resProd.datos);
    } else {
      alert(res?.mensaje || 'Error al crear el producto.');
    }
  };

  // --- HABILITAR / DESHABILITAR PRODUCTO EN EL CATÁLOGO ---
  const ejecutarCambioEstadoProducto = async () => {
    if (!modalEstadoProducto) return;
    const { producto, nuevoEstado } = modalEstadoProducto;
    setModalEstadoProducto(null);

    const res = await apiService.cambiarEstadoProducto(producto.idProducto, nuevoEstado);
    if (res && res.status === 'success') {
      alert(res.mensaje);
      // Si el producto deshabilitado estaba seleccionado en el buscador, limpiarlo
      if (!nuevoEstado && String(idProductoSeleccionado) === String(producto.idProducto)) {
        setIdProductoSeleccionado('');
        setBusquedaProducto('');
      }
      const resProd = await apiService.getProductos();
      if (resProd && resProd.datos) setProductosGlobales(resProd.datos);
    } else {
      alert(res?.mensaje || 'No se pudo cambiar el estado del producto.');
    }
  };

  // Productos filtrados por categoría para la grilla del Catálogo
  const productosFiltradosCatalogo = productosGlobales.filter(p => {
    if (filtroCategoriaId === 'TODAS') return true;
    return String(p.idCategoria) === String(filtroCategoriaId);
  });

  return (
    <div className="page" style={{ position: 'relative' }}>
      <h2 className="page-title">ABM - Gestión de Productos y Stock por Establecimiento</h2>

      {/* SECCIÓN 1: Selector estilo texto igual a Logística (CD / Sucursales) */}
      <section className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '14px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px' }}>
            <span className="muted" style={{ fontWeight: 'bold' }}>Ámbito de Stock:</span>
            <button
              type="button"
              onClick={() => setAmbito('cd')}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: ambito === 'cd' ? '2px solid currentColor' : '2px solid transparent',
                fontWeight: ambito === 'cd' ? 'bold' : 'normal',
                opacity: ambito === 'cd' ? 1 : 0.65,
                cursor: 'pointer',
                padding: '4px 2px',
                fontSize: '15px',
                color: 'inherit'
              }}
            >
              Centro de Distribución
            </button>

            <span className="muted">|</span>

            <button
              type="button"
              onClick={() => setAmbito('sucursal')}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: ambito === 'sucursal' ? '2px solid currentColor' : '2px solid transparent',
                fontWeight: ambito === 'sucursal' ? 'bold' : 'normal',
                opacity: ambito === 'sucursal' ? 1 : 0.65,
                cursor: 'pointer',
                padding: '4px 2px',
                fontSize: '15px',
                color: 'inherit'
              }}
            >
              Sucursales
            </button>
          </div>

          {ambito === 'cd' ? (
            <div className="muted">
              Establecimiento activo:{' '}
              <strong className="strong">
                {centroDistribucion ? `${centroDistribucion.nombre} (${centroDistribucion.codigo})` : 'Sin CD'}
              </strong>
            </div>
          ) : (
            <div className="field-inline">
              <label htmlFor="sel-sucursal-productos">Sucursal:</label>
              <select
                id="sel-sucursal-productos"
                className="select"
                value={idSucursalSeleccionada}
                onChange={e => setIdSucursalSeleccionada(e.target.value)}
              >
                {listaSucursales.map(suc => (
                  <option key={suc.idEstablecimiento} value={suc.idEstablecimiento}>
                    {suc.codigo} — {suc.nombre}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
      </section>

      {/* SECCIÓN 2: Asignar / Actualizar Stock y Productos actualmente en este establecimiento */}
      {establecimientoActivo && (
        <section className="card">
          <h3 className="card-title">
            Asignar / Actualizar Stock — {establecimientoActivo.nombre}
          </h3>

          <form onSubmit={handleSolicitarGuardarStockLocal} className="form-row" noValidate>
            <div className="grow" style={{ position: 'relative' }}>
              <input
                className="input"
                list="lista-productos-habilitados"
                placeholder="Escriba nombre/código o despliegue para elegir producto..."
                value={busquedaProducto}
                onChange={handleBusquedaProductoChange}
                style={{ width: '100%', boxSizing: 'border-box' }}
              />
              <datalist id="lista-productos-habilitados">
                {productosHabilitados.map(p => (
                  <option key={p.idProducto} value={formatearOpcionProducto(p)} />
                ))}
              </datalist>
            </div>

            <input
              className="input narrow"
              type="text"
              inputMode="numeric"
              maxLength={4}
              placeholder="Cantidad"
              value={cantidadStock}
              onKeyDown={handleCantidadStockKeyDown}
              onChange={handleCantidadStockChange}
            />

            <button type="submit" className="btn btn-primary">
              Guardar Stock en Establecimiento
            </button>
          </form>

          {errorAsignacion && (
            <div style={{ color: '#cf1322', fontSize: '13px', fontWeight: 'bold', marginTop: '8px' }}>
              {errorAsignacion}
            </div>
          )}

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
                    <td colSpan="5" className="empty">
                      No hay productos asignados a este establecimiento.
                    </td>
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
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => setModalQuitarLocal(item)}
                        >
                          Quitar de Establecimiento
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

      {/* SECCIÓN 3: Apartado para Añadir un Nuevo Producto (Arriba de Catálogo y debajo de Productos actuales) */}
      <section className="card">
        <h3 className="card-title">Añadir Nuevo Producto</h3>

        <form onSubmit={handleSolicitarCrearProducto} noValidate>
          <div className="form-grid">
            <div>
              <input
                className="input"
                placeholder="Código de Barras"
                value={formNuevoProd.codigoBarras}
                maxLength={20}
                onChange={e => {
                  const limpio = e.target.value.replace(/[^0-9A-Za-z-]/g, '');
                  setFormNuevoProd({ ...formNuevoProd, codigoBarras: limpio });
                  if (erroresNuevoProd.codigoBarras) setErroresNuevoProd({ ...erroresNuevoProd, codigoBarras: null });
                }}
                required
              />
              {erroresNuevoProd.codigoBarras && (
                <div style={{ color: '#cf1322', fontSize: '12px', marginTop: '4px' }}>
                  {erroresNuevoProd.codigoBarras}
                </div>
              )}
            </div>

            <div>
              <input
                className="input"
                placeholder="Nombre del Producto"
                value={formNuevoProd.nombre}
                maxLength={80}
                onChange={e => {
                  setFormNuevoProd({ ...formNuevoProd, nombre: e.target.value });
                  if (erroresNuevoProd.nombre) setErroresNuevoProd({ ...erroresNuevoProd, nombre: null });
                }}
                required
              />
              {erroresNuevoProd.nombre && (
                <div style={{ color: '#cf1322', fontSize: '12px', marginTop: '4px' }}>
                  {erroresNuevoProd.nombre}
                </div>
              )}
            </div>

            <div>
              <select
                className="select"
                value={formNuevoProd.idCategoria}
                onChange={e => {
                  setFormNuevoProd({ ...formNuevoProd, idCategoria: e.target.value });
                  if (erroresNuevoProd.idCategoria) setErroresNuevoProd({ ...erroresNuevoProd, idCategoria: null });
                }}
                style={{ width: '100%' }}
                required
              >
                <option value="">-- Seleccionar Categoría --</option>
                {categorias.map(cat => (
                  <option key={cat.idCategoria} value={cat.idCategoria}>
                    {cat.nombre}
                  </option>
                ))}
              </select>
              {erroresNuevoProd.idCategoria && (
                <div style={{ color: '#cf1322', fontSize: '12px', marginTop: '4px' }}>
                  {erroresNuevoProd.idCategoria}
                </div>
              )}
            </div>

            <div>
              <input
                className="input"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Precio Venta ($)"
                value={formNuevoProd.precioVenta}
                onChange={e => {
                  setFormNuevoProd({ ...formNuevoProd, precioVenta: e.target.value });
                  if (erroresNuevoProd.precioVenta) setErroresNuevoProd({ ...erroresNuevoProd, precioVenta: null });
                }}
                required
              />
              {erroresNuevoProd.precioVenta && (
                <div style={{ color: '#cf1322', fontSize: '12px', marginTop: '4px' }}>
                  {erroresNuevoProd.precioVenta}
                </div>
              )}
            </div>

            <div>
              <input
                className="input"
                type="number"
                step="0.01"
                min="0.01"
                placeholder="Costo Unitario ($)"
                value={formNuevoProd.costoUnitario}
                onChange={e => {
                  setFormNuevoProd({ ...formNuevoProd, costoUnitario: e.target.value });
                  if (erroresNuevoProd.costoUnitario) setErroresNuevoProd({ ...erroresNuevoProd, costoUnitario: null });
                }}
                required
              />
              {erroresNuevoProd.costoUnitario && (
                <div style={{ color: '#cf1322', fontSize: '12px', marginTop: '4px' }}>
                  {erroresNuevoProd.costoUnitario}
                </div>
              )}
            </div>

            <div>
              <input
                className="input"
                type="number"
                min="0"
                placeholder="Stock Mínimo"
                value={formNuevoProd.stockMinimo}
                onChange={e => {
                  setFormNuevoProd({ ...formNuevoProd, stockMinimo: e.target.value });
                  if (erroresNuevoProd.stockMinimo) setErroresNuevoProd({ ...erroresNuevoProd, stockMinimo: null });
                }}
              />
              {erroresNuevoProd.stockMinimo && (
                <div style={{ color: '#cf1322', fontSize: '12px', marginTop: '4px' }}>
                  {erroresNuevoProd.stockMinimo}
                </div>
              )}
            </div>
          </div>

          <div className="form-actions">
            <button type="submit" className="btn btn-primary">
              Añadir Producto
            </button>
          </div>
        </form>
      </section>

      {/* SECCIÓN 4: Catálogo de Productos con Filtro por Categoría y Deshabilitar/Habilitar */}
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
          <h3 className="card-title" style={{ margin: 0 }}>Catálogo de Productos</h3>

          <div className="field-inline">
            <label htmlFor="filtro-categoria-catalogo">Filtrar por Categoría:</label>
            <select
              id="filtro-categoria-catalogo"
              className="select"
              value={filtroCategoriaId}
              onChange={e => setFiltroCategoriaId(e.target.value)}
            >
              <option value="TODAS">Todas las categorías ({productosGlobales.length})</option>
              {categorias.map(cat => (
                <option key={cat.idCategoria} value={cat.idCategoria}>
                  {cat.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID</th>
                <th>Código</th>
                <th>Nombre</th>
                <th>Categoría</th>
                <th className="right">Precio Venta</th>
                <th className="right">Costo</th>
                <th>Estado</th>
                <th className="right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {productosFiltradosCatalogo.length === 0 ? (
                <tr>
                  <td colSpan="8" className="empty">
                    No hay productos en la categoría seleccionada.
                  </td>
                </tr>
              ) : (
                productosFiltradosCatalogo.map(p => {
                  const estaHabilitado = p.esActivo !== false;
                  const catNombre =
                    p.categoriaNombre ||
                    categorias.find(c => Number(c.idCategoria) === Number(p.idCategoria))?.nombre ||
                    '-';

                  return (
                    <tr
                      key={p.idProducto}
                      style={{ opacity: estaHabilitado ? 1 : 0.6 }}
                    >
                      <td className="muted">{p.idProducto}</td>
                      <td>{p.codigoBarras}</td>
                      <td className="strong">{p.nombre}</td>
                      <td>{catNombre}</td>
                      <td className="right">${p.precioVenta}</td>
                      <td className="right">${p.costoUnitario}</td>
                      <td>
                        {estaHabilitado ? (
                          <span className="tag tag-success">Habilitado</span>
                        ) : (
                          <span className="tag tag-danger">Deshabilitado</span>
                        )}
                      </td>
                      <td className="right">
                        {estaHabilitado ? (
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() =>
                              setModalEstadoProducto({ producto: p, nuevoEstado: false })
                            }
                          >
                            Deshabilitar
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="btn btn-primary btn-sm"
                            style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                            onClick={() =>
                              setModalEstadoProducto({ producto: p, nuevoEstado: true })
                            }
                          >
                            Habilitar
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {/* MODAL 1: CONFIRMAR GUARDAR STOCK EN ESTABLECIMIENTO */}
      {modalConfirmarStock && (
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
          <div className="card" style={{ maxWidth: '450px', width: '90%', textAlign: 'center', margin: 0, borderTop: '5px solid #1890ff' }}>
            <h3 className="card-title">Confirmar Asignación de Stock</h3>
            <p className="muted">
              ¿Desea asignar/actualizar el stock del siguiente producto en{' '}
              <strong className="strong">{modalConfirmarStock.establecimientoNombre}</strong>?
            </p>
            <div
              style={{
                margin: '14px 0',
                padding: '12px',
                backgroundColor: 'rgba(24, 144, 255, 0.08)',
                border: '1px solid rgba(24, 144, 255, 0.3)',
                borderRadius: '6px'
              }}
            >
              <div className="strong">{modalConfirmarStock.productoNombre}</div>
              <div className="muted" style={{ fontSize: '12px' }}>Cód: {modalConfirmarStock.codigoBarras}</div>
              <div style={{ fontSize: '20px', fontWeight: 'bold', marginTop: '6px', color: '#1890ff' }}>
                {modalConfirmarStock.cantidadDisponible} unidades
              </div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '20px' }}>
              <button type="button" className="btn" onClick={() => setModalConfirmarStock(null)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary" onClick={ejecutarGuardarStockLocal}>
                Confirmar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 2: CONFIRMAR AÑADIR NUEVO PRODUCTO AL CATÁLOGO */}
      {modalConfirmarNuevoProd && (
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
          <div className="card" style={{ maxWidth: '450px', width: '90%', textAlign: 'center', margin: 0, borderTop: '5px solid #52c41a' }}>
            <h3 className="card-title">¿Confirmar Nuevo Producto?</h3>
            <p className="muted">Se añadirá el siguiente producto al Catálogo:</p>
            <div
              style={{
                margin: '14px 0',
                padding: '12px 16px',
                backgroundColor: 'rgba(82, 196, 26, 0.08)',
                border: '1px solid rgba(82, 196, 26, 0.3)',
                borderRadius: '6px',
                textAlign: 'left',
                lineHeight: '1.6'
              }}
            >
              <div><span className="muted">Código:</span> <strong>{modalConfirmarNuevoProd.codigoBarras}</strong></div>
              <div><span className="muted">Nombre:</span> <strong className="strong">{modalConfirmarNuevoProd.nombre}</strong></div>
              <div><span className="muted">Categoría:</span> <strong>{modalConfirmarNuevoProd.categoriaNombre}</strong></div>
              <div><span className="muted">Precio Venta:</span> <strong>${modalConfirmarNuevoProd.precioVenta}</strong></div>
              <div><span className="muted">Costo Unitario:</span> <strong>${modalConfirmarNuevoProd.costoUnitario}</strong></div>
              <div><span className="muted">Stock Mínimo:</span> <strong>{modalConfirmarNuevoProd.stockMinimo} u.</strong></div>
            </div>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '20px' }}>
              <button type="button" className="btn" onClick={() => setModalConfirmarNuevoProd(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className="btn btn-primary"
                style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                onClick={ejecutarCrearProducto}
              >
                Confirmar y Añadir
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 3: CONFIRMAR DESHABILITAR / HABILITAR PRODUCTO */}
      {modalEstadoProducto && (
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
              borderTop: modalEstadoProducto.nuevoEstado ? '5px solid #52c41a' : '5px solid #ff4d4f'
            }}
          >
            <h3
              className="card-title"
              style={{ color: modalEstadoProducto.nuevoEstado ? '#237804' : '#cf1322' }}
            >
              {modalEstadoProducto.nuevoEstado ? '¿Habilitar Producto?' : '¿Deshabilitar Producto?'}
            </h3>
            <p>
              Producto: <span className="strong">{modalEstadoProducto.producto.nombre}</span>{' '}
              <span className="muted">({modalEstadoProducto.producto.codigoBarras})</span>
            </p>
            <p className="muted" style={{ lineHeight: '1.4' }}>
              {modalEstadoProducto.nuevoEstado
                ? 'Al habilitar este producto, volverá a estar disponible para asignar unidades en Centros de Distribución y Sucursales.'
                : 'El producto NO se eliminará de la base de datos, pero quedará deshabilitado y no se le podrán asignar nuevas unidades hasta que vuelva a habilitarse.'}
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '20px' }}>
              <button type="button" className="btn" onClick={() => setModalEstadoProducto(null)}>
                Cancelar
              </button>
              <button
                type="button"
                className={modalEstadoProducto.nuevoEstado ? 'btn btn-primary' : 'btn btn-danger'}
                style={
                  modalEstadoProducto.nuevoEstado
                    ? { backgroundColor: '#52c41a', borderColor: '#52c41a' }
                    : undefined
                }
                onClick={ejecutarCambioEstadoProducto}
              >
                {modalEstadoProducto.nuevoEstado ? 'Confirmar Habilitación' : 'Confirmar Deshabilitación'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 4: QUITAR PRODUCTO DE ESTABLECIMIENTO PUNTUAL */}
      {modalQuitarLocal && (
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
          <div className="card" style={{ maxWidth: '430px', width: '90%', textAlign: 'center', margin: 0, borderTop: '5px solid #ff4d4f' }}>
            <h3 className="card-title" style={{ color: '#cf1322' }}>Quitar Producto del Establecimiento</h3>
            <p className="muted">
              ¿Desea desvincular <strong className="strong">{modalQuitarLocal.nombre}</strong> de{' '}
              <strong className="strong">{establecimientoActivo?.nombre}</strong>?
            </p>
            <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '20px' }}>
              <button type="button" className="btn" onClick={() => setModalQuitarLocal(null)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-danger" onClick={ejecutarQuitarStockLocal}>
                Quitar
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}