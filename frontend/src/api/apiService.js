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

  // --- Logística & Bultos (Patrón State) ---
  getBultos: async () => {
    const res = await fetch(`${API_BASE_URL}/logistica/bultos`);
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

  // --- Ventas (Patrón Strategy) ---
  registrarVenta: async (datosVenta) => {
    const res = await fetch(`${API_BASE_URL}/ventas`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(datosVenta),
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
  getBultosRechazados: async () => {
    const res = await fetch(`${API_BASE_URL}/reportes/bultos-rechazados`);
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

  // --- Asignar / Quitar productos de un Establecimiento puntual ---
  guardarStockEstablecimiento: async (idEstablecimiento, idProducto, cantidadDisponible) => {
    const res = await fetch(`${API_BASE_URL}/catalogo/establecimientos/${idEstablecimiento}/stock`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ idProducto, cantidadDisponible }),
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