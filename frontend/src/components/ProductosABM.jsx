import React, { useState, useEffect } from 'react';
import { apiService } from '../api/apiService';

export default function ProductosABM() {
  const [establecimientos, setEstablecimientos] = useState([]);
  const [ambito, setAmbito] = useState('cd'); // 'cd' | 'sucursal'
  const [idSucursalSeleccionada, setIdSucursalSeleccionada] = useState('');

  const [productosGlobales, setProductosGlobales] = useState([]);
  const [categorias, setCategorias] = useState([]);
  const [proveedores, setProveedores] = useState([]);
  const [stockEstablecimiento, setStockEstablecimiento] = useState([]);

  // Filtro de Proveedor y buscador para el Pedido a Proveedores en CD
  const [idProveedorPedido, setIdProveedorPedido] = useState('TODOS');
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [idProductoSeleccionado, setIdProductoSeleccionado] = useState('');
  const [cantidadStock, setCantidadStock] = useState('10');
  const [errorAsignacion, setErrorAsignacion] = useState('');

  // Lista acumulada de renglones del Pedido Grande al Proveedor
  const [itemsPedido, setItemsPedido] = useState([]);

  // Filtros en el Catálogo de Productos
  const [filtroCategoriaId, setFiltroCategoriaId] = useState('TODAS');
  const [filtroProveedorId, setFiltroProveedorId] = useState('TODOS');

  // Formulario para añadir nuevo producto al catálogo (con Proveedor y Categoría)
  const [formNuevoProd, setFormNuevoProd] = useState({
    codigoBarras: '',
    nombre: '',
    precioVenta: '',
    costoUnitario: '',
    stockMinimo: '5',
    idCategoria: '',
    idProveedor: ''
  });
  const [erroresNuevoProd, setErroresNuevoProd] = useState({});

  // Modales de confirmación
  const [modalConfirmarPedidoGrande, setModalConfirmarPedidoGrande] = useState(null);
  const [modalConfirmarNuevoProd, setModalConfirmarNuevoProd] = useState(null);
  const [modalEstadoProducto, setModalEstadoProducto] = useState(null);
  const [modalQuitarLocal, setModalQuitarLocal] = useState(null);

  useEffect(() => {
    cargarInicial();
  }, []);

  const cargarInicial = async () => {
    const [resEst, resProd, resCat, resProv] = await Promise.all([
      apiService.getEstablecimientos(),
      apiService.getProductos(),
      apiService.getCategorias ? apiService.getCategorias() : Promise.resolve({ datos: [] }),
      apiService.getProveedores ? apiService.getProveedores() : Promise.resolve({ datos: [] })
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

    if (resProv && resProv.datos) {
      setProveedores(resProv.datos);
      if (resProv.datos.length > 0 && !formNuevoProd.idProveedor) {
        setFormNuevoProd(prev => ({
          ...prev,
          idProveedor: String(resProv.datos[0].idProveedor)
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
    setBusquedaProducto('');
    setIdProductoSeleccionado('');
    setErrorAsignacion('');
  }, [idEstablecimientoActivo]);

  const cargarStockLocal = async (idEst) => {
    const resStock = await apiService.getStockPorEstablecimiento(idEst);
    if (resStock && resStock.datos) {
      setStockEstablecimiento(resStock.datos);
    } else {
      setStockEstablecimiento([]);
    }
  };

  // --- PRODUCTOS HABILITADOS DISPONIBLES SEGÚN EL PROVEEDOR SELECCIONADO ---
  const productosHabilitados = productosGlobales.filter(p => {
    if (p.esActivo === false) return false;
    if (idProveedorPedido !== 'TODOS') {
      return String(p.idProveedor) === String(idProveedorPedido);
    }
    return true;
  });

  const formatearOpcionProducto = (p) => {
    const prov =
      p.proveedorNombre ||
      proveedores.find(pr => Number(pr.idProveedor) === Number(p.idProveedor))?.razonSocial ||
      '';
    return prov ? `${p.nombre} — Cód: ${p.codigoBarras} [${prov}]` : `${p.nombre} — Cód: ${p.codigoBarras}`;
  };

  const handleCambioProveedorPedido = (nuevoIdProv) => {
    setIdProveedorPedido(nuevoIdProv);
    setBusquedaProducto('');
    setIdProductoSeleccionado('');
    setErrorAsignacion('');
  };

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

  // --- VALIDACIÓN DE CANTIDAD ---
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

  // --- AGREGAR UN RENGLÓN A LA LISTA DEL PEDIDO GRANDE ---
  const handleAgregarItemAPedido = (e) => {
    e.preventDefault();
    if (ambito !== 'cd' || !idEstablecimientoActivo) return;

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
      return setErrorAsignacion('Seleccione o escriba un producto válido del proveedor.');
    }

    if (prodSeleccionado.esActivo === false) {
      return setErrorAsignacion(
        `El producto "${prodSeleccionado.nombre}" está deshabilitado y no puede agregarse al pedido.`
      );
    }

    if (
      idProveedorPedido !== 'TODOS' &&
      String(prodSeleccionado.idProveedor) !== String(idProveedorPedido)
    ) {
      return setErrorAsignacion(
        `El producto "${prodSeleccionado.nombre}" no pertenece al proveedor seleccionado.`
      );
    }

    const cantNum = parseInt(cantidadStock, 10);
    if (!cantidadStock || isNaN(cantNum) || cantNum <= 0) {
      return setErrorAsignacion('Ingrese una cantidad válida mayor a 0 (1 a 9999).');
    }

    const provObj = proveedores.find(
      pr => Number(pr.idProveedor) === Number(prodSeleccionado.idProveedor)
    );
    const proveedorNombre =
      prodSeleccionado.proveedorNombre || provObj?.razonSocial || 'Sin proveedor';

    setItemsPedido(prev => {
      const existente = prev.find(i => i.idProducto === prodSeleccionado.idProducto);
      if (existente) {
        return prev.map(i =>
          i.idProducto === prodSeleccionado.idProducto
            ? { ...i, cantidad: i.cantidad + cantNum }
            : i
        );
      }
      return [
        ...prev,
        {
          idProducto: prodSeleccionado.idProducto,
          codigoBarras: prodSeleccionado.codigoBarras,
          nombre: prodSeleccionado.nombre,
          idProveedor: prodSeleccionado.idProveedor,
          proveedorNombre,
          costoUnitario: prodSeleccionado.costoUnitario,
          cantidad: cantNum
        }
      ];
    });

    setBusquedaProducto('');
    setIdProductoSeleccionado('');
    setCantidadStock('10');
    setErrorAsignacion('');
  };

  const handleActualizarCantidadItemPedido = (idProducto, nuevaCantStr) => {
    const limpio = nuevaCantStr.replace(/[^0-9]/g, '').slice(0, 4);
    const cantNum = parseInt(limpio, 10);
    setItemsPedido(prev =>
      prev.map(i =>
        i.idProducto === idProducto
          ? { ...i, cantidad: isNaN(cantNum) ? 0 : cantNum }
          : i
      )
    );
  };

  const handleQuitarItemPedido = (idProducto) => {
    setItemsPedido(prev => prev.filter(i => i.idProducto !== idProducto));
  };

  const handleVaciarPedido = () => {
    setItemsPedido([]);
    setErrorAsignacion('');
  };

  // --- SOLICITAR CONFIRMACIÓN DEL PEDIDO GRANDE ---
  const handleSolicitarConfirmarPedidoGrande = () => {
    if (itemsPedido.length === 0) {
      return setErrorAsignacion('Agregue al menos un producto a la lista del pedido.');
    }

    const itemInvalido = itemsPedido.find(i => !i.cantidad || i.cantidad <= 0);
    if (itemInvalido) {
      return setErrorAsignacion(
        `La cantidad pedida de "${itemInvalido.nombre}" debe ser mayor a 0.`
      );
    }

    const totalUnidades = itemsPedido.reduce((acc, i) => acc + i.cantidad, 0);
    const costoTotal = itemsPedido.reduce((acc, i) => acc + i.cantidad * i.costoUnitario, 0);
    const proveedoresUnicos = [...new Set(itemsPedido.map(i => i.proveedorNombre))];

    setModalConfirmarPedidoGrande({
      idEstablecimiento: idEstablecimientoActivo,
      establecimientoNombre: establecimientoActivo.nombre,
      items: itemsPedido,
      totalUnidades,
      costoTotal,
      proveedoresResumen: proveedoresUnicos.join(', ')
    });
  };

  const ejecutarConfirmarPedidoGrande = async () => {
    if (!modalConfirmarPedidoGrande) return;
    const datos = modalConfirmarPedidoGrande;
    setModalConfirmarPedidoGrande(null);

    const payloadItems = datos.items.map(i => ({
      idProducto: i.idProducto,
      cantidad: i.cantidad
    }));

    const res = await apiService.registrarPedidoMasivoProveedor(
      datos.idEstablecimiento,
      payloadItems
    );

    if (res && res.status === 'success') {
      alert(res.mensaje || 'Pedido registrado correctamente.');
      setItemsPedido([]);
      setBusquedaProducto('');
      setIdProductoSeleccionado('');
      setCantidadStock('10');
      setErrorAsignacion('');
      cargarStockLocal(datos.idEstablecimiento);
    } else {
      alert(res?.mensaje || 'Error al registrar el pedido.');
    }
  };

  // --- QUITAR PRODUCTO DEL CD ---
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

    if (!formNuevoProd.idProveedor) {
      errs.idProveedor = 'Seleccione un proveedor.';
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
    const provObj = proveedores.find(
      pr => String(pr.idProveedor) === String(formNuevoProd.idProveedor)
    );

    setModalConfirmarNuevoProd({
      codigoBarras: formNuevoProd.codigoBarras.trim(),
      nombre: formNuevoProd.nombre.trim(),
      precioVenta: parseFloat(formNuevoProd.precioVenta),
      costoUnitario: parseFloat(formNuevoProd.costoUnitario),
      stockMinimo: parseInt(formNuevoProd.stockMinimo || '5', 10),
      idCategoria: parseInt(formNuevoProd.idCategoria, 10),
      categoriaNombre: catObj ? catObj.nombre : `ID ${formNuevoProd.idCategoria}`,
      idProveedor: parseInt(formNuevoProd.idProveedor, 10),
      proveedorNombre: provObj
        ? `${provObj.razonSocial} (CUIT: ${provObj.cuit})`
        : `ID ${formNuevoProd.idProveedor}`
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
        idCategoria: prev.idCategoria,
        idProveedor: prev.idProveedor
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
      if (!nuevoEstado) {
        if (String(idProductoSeleccionado) === String(producto.idProducto)) {
          setIdProductoSeleccionado('');
          setBusquedaProducto('');
        }
        setItemsPedido(prev => prev.filter(i => i.idProducto !== producto.idProducto));
      }
      const resProd = await apiService.getProductos();
      if (resProd && resProd.datos) setProductosGlobales(resProd.datos);
    } else {
      alert(res?.mensaje || 'No se pudo cambiar el estado del producto.');
    }
  };

  // Productos filtrados por Categoría y Proveedor para la grilla del Catálogo
  const productosFiltradosCatalogo = productosGlobales.filter(p => {
    const cumpleCat =
      filtroCategoriaId === 'TODAS' || String(p.idCategoria) === String(filtroCategoriaId);
    const cumpleProv =
      filtroProveedorId === 'TODOS' || String(p.idProveedor) === String(filtroProveedorId);
    return cumpleCat && cumpleProv;
  });

  // Producto actualmente identificado en el input (en CD)
  const productoIdentificadoActual = productosGlobales.find(
    p => String(p.idProducto) === String(idProductoSeleccionado)
  );

  // Totales del carrito de Pedido Grande
  const totalUnidadesPedido = itemsPedido.reduce((acc, i) => acc + (i.cantidad || 0), 0);
  const costoTotalPedido = itemsPedido.reduce(
    (acc, i) => acc + (i.cantidad || 0) * i.costoUnitario,
    0
  );

  return (
    <div className="page" style={{ position: 'relative' }}>
      <h2 className="page-title">ABM - Gestión de Productos, Proveedores y Stock</h2>

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

      {/* SECCIÓN 2: Pedido a Proveedores (solo CD) y Existencias del Establecimiento */}
      {establecimientoActivo && (
        <section className="card">
          {ambito === 'cd' ? (
            <>
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
                  Pedido a Proveedores — Ingreso de Stock en {establecimientoActivo.nombre}
                </h3>

                <div className="field-inline">
                  <label htmlFor="sel-proveedor-pedido">Filtrar por Proveedor:</label>
                  <select
                    id="sel-proveedor-pedido"
                    className="select"
                    value={idProveedorPedido}
                    onChange={e => handleCambioProveedorPedido(e.target.value)}
                  >
                    <option value="TODOS">Todos los proveedores</option>
                    {proveedores.map(prov => (
                      <option key={prov.idProveedor} value={prov.idProveedor}>
                        {prov.razonSocial} ({prov.cuit})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Formulario para ir agregando productos al Pedido Grande */}
              <form onSubmit={handleAgregarItemAPedido} className="form-row" noValidate>
                <div className="grow" style={{ position: 'relative' }}>
                  <input
                    className="input"
                    list="lista-productos-habilitados"
                    placeholder={
                      productosHabilitados.length === 0
                        ? 'Este proveedor no tiene productos habilitados disponibles...'
                        : 'Escriba nombre/código o despliegue para elegir producto del proveedor...'
                    }
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
                  placeholder="Cant. Pedida"
                  value={cantidadStock}
                  onKeyDown={handleCantidadStockKeyDown}
                  onChange={handleCantidadStockChange}
                />

                <button type="submit" className="btn btn-outline">
                  + Agregar al Pedido
                </button>
              </form>

              {productoIdentificadoActual && (
                <div className="muted" style={{ fontSize: '13px', marginTop: '8px' }}>
                  Proveedor:{' '}
                  <strong className="strong">
                    {productoIdentificadoActual.proveedorNombre ||
                      proveedores.find(
                        pr => Number(pr.idProveedor) === Number(productoIdentificadoActual.idProveedor)
                      )?.razonSocial ||
                      'Sin proveedor'}
                  </strong>{' '}
                  — Costo unitario: <strong>${productoIdentificadoActual.costoUnitario}</strong>
                </div>
              )}

              {errorAsignacion && (
                <div style={{ color: '#cf1322', fontSize: '13px', fontWeight: 'bold', marginTop: '8px' }}>
                  {errorAsignacion}
                </div>
              )}

              {/* Lista / Detalle del Pedido Grande en preparación */}
              {itemsPedido.length > 0 && (
                <div
                  style={{
                    marginTop: '16px',
                    padding: '14px',
                    border: '1px solid rgba(24, 144, 255, 0.35)',
                    backgroundColor: 'rgba(24, 144, 255, 0.04)',
                    borderRadius: '6px'
                  }}
                >
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      flexWrap: 'wrap',
                      gap: '10px',
                      marginBottom: '10px'
                    }}
                  >
                    <h4 className="card-subtitle" style={{ margin: 0 }}>
                      Detalle del Pedido a Confirmar ({itemsPedido.length}{' '}
                      {itemsPedido.length === 1 ? 'producto' : 'productos'})
                    </h4>

                    <div className="muted" style={{ fontSize: '13px' }}>
                      Total unidades: <strong className="strong">{totalUnidadesPedido} u.</strong> | Costo estimado:{' '}
                      <strong className="strong">
                        ${costoTotalPedido.toLocaleString('es-AR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </strong>
                    </div>
                  </div>

                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Código</th>
                          <th>Producto</th>
                          <th>Proveedor</th>
                          <th className="right">Stock Actual CD</th>
                          <th className="right">Cant. Pedida</th>
                          <th className="right">Stock Resultante</th>
                          <th className="right">Subtotal Costo</th>
                          <th className="right">Quitar</th>
                        </tr>
                      </thead>
                      <tbody>
                        {itemsPedido.map(item => {
                          const stockAct =
                            stockEstablecimiento.find(s => Number(s.idProducto) === Number(item.idProducto))
                              ?.cantidadDisponible || 0;
                          const stockRes = stockAct + (item.cantidad || 0);
                          const subtotal = (item.cantidad || 0) * item.costoUnitario;

                          return (
                            <tr key={item.idProducto}>
                              <td>{item.codigoBarras}</td>
                              <td className="strong">{item.nombre}</td>
                              <td>{item.proveedorNombre}</td>
                              <td className="right">{stockAct} u.</td>
                              <td className="right">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  className="input narrow"
                                  style={{ width: '75px', textAlign: 'right', padding: '4px 6px' }}
                                  value={item.cantidad || ''}
                                  onChange={e =>
                                    handleActualizarCantidadItemPedido(item.idProducto, e.target.value)
                                  }
                                />
                              </td>
                              <td className="right">
                                <span className="tag tag-success">{stockRes} u.</span>
                              </td>
                              <td className="right">
                                ${subtotal.toLocaleString('es-AR', {
                                  minimumFractionDigits: 2,
                                  maximumFractionDigits: 2
                                })}
                              </td>
                              <td className="right">
                                <button
                                  type="button"
                                  className="btn btn-danger btn-sm"
                                  onClick={() => handleQuitarItemPedido(item.idProducto)}
                                >
                                  Quitar
                                </button>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'flex-end',
                      gap: '10px',
                      marginTop: '12px'
                    }}
                  >
                    <button type="button" className="btn" onClick={handleVaciarPedido}>
                      Limpiar Lista
                    </button>
                    <button
                      type="button"
                      className="btn btn-primary"
                      onClick={handleSolicitarConfirmarPedidoGrande}
                    >
                      Confirmar Pedido ({totalUnidadesPedido} u.)
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <div style={{ marginBottom: '12px' }}>
              <h3 className="card-title" style={{ marginBottom: '4px' }}>
                Stock Actual en {establecimientoActivo.nombre}
              </h3>
              <p className="muted" style={{ margin: 0, fontSize: '13px' }}>
                El ingreso de mercadería a sucursales se realiza exclusivamente mediante la verificación de bultos en el módulo <strong>Logística</strong>.
              </p>
            </div>
          )}

          <h4 className="card-subtitle">Productos actualmente en este establecimiento</h4>
          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Código</th>
                  <th>Producto</th>
                  <th>Proveedor</th>
                  <th className="right">Precio Venta</th>
                  <th className="right">Stock Disponible</th>
                  {ambito === 'cd' && <th className="right">Acciones</th>}
                </tr>
              </thead>
              <tbody>
                {stockEstablecimiento.length === 0 ? (
                  <tr>
                    <td colSpan={ambito === 'cd' ? 6 : 5} className="empty">
                      No hay productos registrados en este establecimiento.
                    </td>
                  </tr>
                ) : (
                  stockEstablecimiento.map(item => (
                    <tr key={item.idStockItem}>
                      <td>{item.codigoBarras}</td>
                      <td className="strong">{item.nombre}</td>
                      <td>{item.proveedorNombre || '-'}</td>
                      <td className="right">${item.precioVenta}</td>
                      <td className="right">{item.cantidadDisponible} u.</td>
                      {ambito === 'cd' && (
                        <td className="right">
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => setModalQuitarLocal(item)}
                          >
                            Quitar de Establecimiento
                          </button>
                        </td>
                      )}
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* SECCIÓN 3: Apartado para Añadir un Nuevo Producto (con Proveedor y Categoría) */}
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
              <select
                className="select"
                value={formNuevoProd.idProveedor}
                onChange={e => {
                  setFormNuevoProd({ ...formNuevoProd, idProveedor: e.target.value });
                  if (erroresNuevoProd.idProveedor) setErroresNuevoProd({ ...erroresNuevoProd, idProveedor: null });
                }}
                style={{ width: '100%' }}
                required
              >
                <option value="">-- Seleccionar Proveedor --</option>
                {proveedores.map(prov => (
                  <option key={prov.idProveedor} value={prov.idProveedor}>
                    {prov.razonSocial} (CUIT: {prov.cuit})
                  </option>
                ))}
              </select>
              {erroresNuevoProd.idProveedor && (
                <div style={{ color: '#cf1322', fontSize: '12px', marginTop: '4px' }}>
                  {erroresNuevoProd.idProveedor}
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

      {/* SECCIÓN 4: Catálogo de Productos con Filtros por Categoría y Proveedor */}
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

          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center' }}>
            <div className="field-inline">
              <label htmlFor="filtro-categoria-catalogo">Categoría:</label>
              <select
                id="filtro-categoria-catalogo"
                className="select"
                value={filtroCategoriaId}
                onChange={e => setFiltroCategoriaId(e.target.value)}
              >
                <option value="TODAS">Todas ({productosGlobales.length})</option>
                {categorias.map(cat => (
                  <option key={cat.idCategoria} value={cat.idCategoria}>
                    {cat.nombre}
                  </option>
                ))}
              </select>
            </div>

            <div className="field-inline">
              <label htmlFor="filtro-proveedor-catalogo">Proveedor:</label>
              <select
                id="filtro-proveedor-catalogo"
                className="select"
                value={filtroProveedorId}
                onChange={e => setFiltroProveedorId(e.target.value)}
              >
                <option value="TODOS">Todos</option>
                {proveedores.map(prov => (
                  <option key={prov.idProveedor} value={prov.idProveedor}>
                    {prov.razonSocial}
                  </option>
                ))}
              </select>
            </div>
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
                <th>Proveedor</th>
                <th className="right">Precio Venta</th>
                <th className="right">Costo</th>
                <th>Estado</th>
                <th className="right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {productosFiltradosCatalogo.length === 0 ? (
                <tr>
                  <td colSpan="9" className="empty">
                    No hay productos que coincidan con los filtros seleccionados.
                  </td>
                </tr>
              ) : (
                productosFiltradosCatalogo.map(p => {
                  const estaHabilitado = p.esActivo !== false;
                  const catNombre =
                    p.categoriaNombre ||
                    categorias.find(c => Number(c.idCategoria) === Number(p.idCategoria))?.nombre ||
                    '-';
                  const provNombre =
                    p.proveedorNombre ||
                    proveedores.find(pr => Number(pr.idProveedor) === Number(p.idProveedor))?.razonSocial ||
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
                      <td>{provNombre}</td>
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

      {/* MODAL 1: CONFIRMAR PEDIDO GRANDE A PROVEEDORES (CD) */}
      {modalConfirmarPedidoGrande && (
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
          <div className="card" style={{ maxWidth: '560px', width: '92%', margin: 0, borderTop: '5px solid #1890ff' }}>
            <h3 className="card-title" style={{ textAlign: 'center' }}>
              Confirmar Pedido a Proveedores
            </h3>
            <p className="muted" style={{ textAlign: 'center' }}>
              Destino: <strong className="strong">{modalConfirmarPedidoGrande.establecimientoNombre}</strong>
              <br />
              Proveedor(es): <strong className="strong">{modalConfirmarPedidoGrande.proveedoresResumen}</strong>
            </p>

            <div
              style={{
                margin: '12px 0',
                padding: '10px',
                backgroundColor: 'rgba(24, 144, 255, 0.06)',
                border: '1px solid rgba(24, 144, 255, 0.25)',
                borderRadius: '6px',
                maxHeight: '240px',
                overflowY: 'auto'
              }}
            >
              <table className="table" style={{ fontSize: '13px' }}>
                <thead>
                  <tr>
                    <th>Producto</th>
                    <th>Proveedor</th>
                    <th className="right">Cant.</th>
                    <th className="right">Subtotal</th>
                  </tr>
                </thead>
                <tbody>
                  {modalConfirmarPedidoGrande.items.map(it => (
                    <tr key={it.idProducto}>
                      <td className="strong">{it.nombre}</td>
                      <td>{it.proveedorNombre}</td>
                      <td className="right">+{it.cantidad} u.</td>
                      <td className="right">
                        ${(it.cantidad * it.costoUnitario).toLocaleString('es-AR', {
                          minimumFractionDigits: 2,
                          maximumFractionDigits: 2
                        })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ textAlign: 'center', fontSize: '14px', lineHeight: '1.6' }}>
              <div>
                Total de productos distintos: <strong>{modalConfirmarPedidoGrande.items.length}</strong> | Total unidades:{' '}
                <strong style={{ color: '#1890ff' }}>+{modalConfirmarPedidoGrande.totalUnidades} u.</strong>
              </div>
              <div>
                Costo total estimado:{' '}
                <strong>
                  ${modalConfirmarPedidoGrande.costoTotal.toLocaleString('es-AR', {
                    minimumFractionDigits: 2,
                    maximumFractionDigits: 2
                  })}
                </strong>
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '20px' }}>
              <button type="button" className="btn" onClick={() => setModalConfirmarPedidoGrande(null)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary" onClick={ejecutarConfirmarPedidoGrande}>
                Confirmar e Ingresar Stock
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
          <div className="card" style={{ maxWidth: '460px', width: '90%', textAlign: 'center', margin: 0, borderTop: '5px solid #52c41a' }}>
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
              <div><span className="muted">Proveedor:</span> <strong>{modalConfirmarNuevoProd.proveedorNombre}</strong></div>
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
                ? 'Al habilitar este producto, volverá a estar disponible para pedir unidades a proveedores en el Centro de Distribución.'
                : 'El producto NO se eliminará de la base de datos, pero quedará deshabilitado y no se le podrán pedir unidades hasta que vuelva a habilitarse.'}
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

      {/* MODAL 4: QUITAR PRODUCTO DEL CD */}
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
            <h3 className="card-title" style={{ color: '#cf1322' }}>Quitar Producto del Centro de Distribución</h3>
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