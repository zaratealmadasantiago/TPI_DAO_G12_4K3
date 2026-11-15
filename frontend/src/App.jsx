import React, { useState } from 'react';
import ProductosABM from './components/ProductosABM';
import LogisticaModulo from './components/LogisticaModulo';
import EstablecimientosABM from './components/EstablecimientosABM';
import VentasPOS from './components/VentasPOS';
import ReportesView from './components/ReportesView';

export default function App() {
  const [tab, setTab] = useState('establecimientos');

  return (
    <div>
      <nav className="navbar">
        <div className="navbar-inner">
          <div className="navbar-brand">Ventas <span>&</span> Inventario</div>
          <div className="navbar-links">
            <button
              className={`nav-link ${tab === 'establecimientos' ? 'active' : ''}`}
              onClick={() => setTab('establecimientos')}
            >
              Establecimientos
            </button>
            <button
              className={`nav-link ${tab === 'productos' ? 'active' : ''}`}
              onClick={() => setTab('productos')}
            >
              Productos
            </button>
            <button
              className={`nav-link ${tab === 'logistica' ? 'active' : ''}`}
              onClick={() => setTab('logistica')}
            >
              Logística
            </button>
            <button
              className={`nav-link ${tab === 'ventas' ? 'active' : ''}`}
              onClick={() => setTab('ventas')}
            >
              Ventas
            </button>
            <button
              className={`nav-link ${tab === 'reportes' ? 'active' : ''}`}
              onClick={() => setTab('reportes')}
            >
              Reportes
            </button>
          </div>
        </div>
      </nav>

      <main className="main">
        {tab === 'establecimientos' && <EstablecimientosABM />}
        {tab === 'productos' && <ProductosABM />}
        {tab === 'logistica' && <LogisticaModulo />}
        {tab === 'ventas' && <VentasPOS />}
        {tab === 'reportes' && <ReportesView />}
      </main>
    </div>
  );
}