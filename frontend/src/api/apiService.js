const API_BASE_URL = 'http://localhost:3000/api/v1';

export const apiService = {
  // --- ABM Productos ---
  getProductos: async () => {
    const res = await fetch(`${API_BASE_URL}/catalogo/productos`);
    return res.json();
  },
  crearProducto: async (producto) => {
    const res = await fetch(`${API_BASE_URL}/catalogo/productos`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(producto),
    });
    return res.json();
  },
  eliminarProducto: async (id) => {
    const res = await fetch(`${API_BASE_URL}/catalogo/productos/${id}`, {
      method: 'DELETE',
    });
    return res.json();
  },
  cambiarEstadoProducto: async (idProducto, esActivo) => {
    const res = await fetch(`${API_BASE_URL}/catalogo/productos/${idProducto}/estado`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ esActivo }),
    });
    return res.json();
  },
  getCategorias: async () => {
    const res = await fetch(`${API_BASE_URL}/catalogo/categorias`);
    return res.json();
  },

  // --- Logística: Órdenes de Reposición ---
  getOrdenesReposicion: async (params = {}) => {
    const query = new URLSearchParams();
    if (params.idSucursal) query.append('idSucursal', params.idSucursal);
    if (params.idCentroDistribucion) query.append('idCentroDistribucion', params.idCentroDistribucion);
    if (params.soloPendientes) query.append('soloPendientes', '1');
    const qs = query.toString() ? `?${query.toString()}` : '';
    const res = await fetch(`${API_BASE_URL}/logistica/ordenes-reposicion${qs}`);
    return res.json();
  },
  crearOrdenReposicion: async (idDestino, detalles) => {
    const res = await fetch(`${API_BASE_URL}/logistica/ordenes-reposicion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idDestino, detalles }),
    });
    return res.json();
  },
  confirmarOrdenReposicion: async (idOrden) => {
    const res = await fetch(`${API_BASE_URL}/logistica/ordenes-reposicion/${idOrden}/confirmar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return res.json();
  },
  rechazarOrdenReposicion: async (idOrden) => {
    const res = await fetch(`${API_BASE_URL}/logistica/ordenes-reposicion/${idOrden}/rechazar`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return res.json();
  },

  // --- Logística: Remitos & Bultos (Patrón State) ---
  getBultos: async () => {
    const res = await fetch(`${API_BASE_URL}/logistica/bultos`);
    return res.json();
  },
  asignarPrecinto: async (idBulto, codigoPrecinto) => {
    const res = await fetch(`${API_BASE_URL}/logistica/bultos/${idBulto}/asignar-precinto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigoPrecinto }),
    });
    return res.json();
  },
  confirmarEnvio: async (idBulto) => {
    const res = await fetch(`${API_BASE_URL}/logistica/bultos/${idBulto}/confirmar-envio`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return res.json();
  },
  confirmarRecepcion: async (idBulto) => {
    const res = await fetch(`${API_BASE_URL}/logistica/bultos/${idBulto}/confirmar-recepcion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return res.json();
  },
  verificarPrecinto: async (idBulto, codigoPrecinto) => {
    const res = await fetch(`${API_BASE_URL}/logistica/bultos/${idBulto}/verificar-precinto`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ codigoPrecinto }),
    });
    return res.json();
  },
  rechazarPrecintoViolado: async (idBulto) => {
    const res = await fetch(`${API_BASE_URL}/logistica/bultos/${idBulto}/rechazar-violado`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
    return res.json();
  },

// --- MÓDULO VENTAS Y DEVOLUCIONES ---
getVentas: async (idSucursal = '') => {
  const query = idSucursal ? `?idSucursal=${idSucursal}` : '';
  const res = await fetch(`${API_BASE_URL}/ventas/${query}`);
  return res.json();
},

registrarVenta: async (payloadVenta) => {
  const res = await fetch(`${API_BASE_URL}/ventas/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payloadVenta),
  });
  return res.json();
},

getDevoluciones: async (idSucursal = '') => {
  const query = idSucursal ? `?idSucursal=${idSucursal}` : '';
  const res = await fetch(`${API_BASE_URL}/ventas/devoluciones${query}`);
  return res.json();
},

registrarDevolucion: async (payloadDevolucion) => {
  const res = await fetch(`${API_BASE_URL}/ventas/devoluciones`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payloadDevolucion),
  });
  return res.json();
},

  // --- Reportes ---
  getReporteVentas: async (fDesde, fHasta, idSucursal) => {
    const url = new URL(`${API_BASE_URL}/reportes/ventas`);
    if (fDesde) url.searchParams.append('fecha_desde', fDesde);
    if (fHasta) url.searchParams.append('fecha_hasta', fHasta);
    if (idSucursal) url.searchParams.append('id_sucursal', idSucursal);
    const res = await fetch(url);
    return res.json();
  },
  getReporteMasVendidos: async (fDesde, fHasta, idSucursal, limite = 10) => {
    const url = new URL(`${API_BASE_URL}/reportes/productos-mas-vendidos`);
    if (fDesde) url.searchParams.append('fecha_desde', fDesde);
    if (fHasta) url.searchParams.append('fecha_hasta', fHasta);
    if (idSucursal) url.searchParams.append('id_sucursal', idSucursal);
    url.searchParams.append('limite', limite);
    const res = await fetch(url);
    return res.json();
  },
  getReporteStock: async (idEstablecimiento, soloMinimo) => {
    const url = new URL(`${API_BASE_URL}/reportes/stock`);
    if (idEstablecimiento) url.searchParams.append('id_establecimiento', idEstablecimiento);
    if (soloMinimo) url.searchParams.append('solo_minimo', '1');
    const res = await fetch(url);
    return res.json();
  },
  getBultosRechazados: async () => {
    const res = await fetch(`${API_BASE_URL}/reportes/bultos-rechazados`);
    return res.json();
  },
  getReporteTiempoTransito: async () => {
    const res = await fetch(`${API_BASE_URL}/reportes/tiempo-transito`);
    return res.json();
  },

  // --- Establecimientos ---
  getEstablecimientos: async () => {
    const res = await fetch(`${API_BASE_URL}/catalogo/establecimientos`);
    return res.json();
  },
  crearSucursal: async (datos) => {
    const res = await fetch(`${API_BASE_URL}/catalogo/establecimientos/sucursal`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    });
    return res.json();
  },
  crearCentroDistribucion: async (datos) => {
    const res = await fetch(`${API_BASE_URL}/catalogo/establecimientos/centro-distribucion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datos),
    });
    return res.json();
  },

  // --- Consultar productos/stock de un establecimiento puntual ---
  getStockPorEstablecimiento: async (idEstablecimiento) => {
    const res = await fetch(`${API_BASE_URL}/catalogo/establecimientos/${idEstablecimiento}/stock`);
    return res.json();
  },

  getProveedores: async () => {
    const res = await fetch(`${API_BASE_URL}/catalogo/proveedores`);
    return res.json();
  },

  registrarPedidoMasivoProveedor: async (idEstablecimiento, items) => {
    const res = await fetch(`${API_BASE_URL}/catalogo/establecimientos/${idEstablecimiento}/pedido-masivo`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items }),
    });
    return res.json();
  },
  
  // --- Asignar / Quitar productos de un Establecimiento puntual ---
  guardarStockEstablecimiento: async (idEstablecimiento, idProducto, cantidadDisponible, modo = null) => {
    const res = await fetch(`${API_BASE_URL}/catalogo/establecimientos/${idEstablecimiento}/stock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idProducto, cantidadDisponible, modo }),
    });
    return res.json();
  },

  quitarStockEstablecimiento: async (idStockItem) => {
    const res = await fetch(`${API_BASE_URL}/catalogo/stock/${idStockItem}`, {
      method: 'DELETE',
    });
    return res.json();
  }
};