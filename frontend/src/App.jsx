import React, { useState } from 'react';
import ProductosABM from './components/ProductosABM';
import LogisticaBultos from './components/LogisticaBultos';
import EstablecimientosABM from './components/EstablecimientosABM';

export default function App() {
  const [tab, setTab] = useState('establecimientos');

  return (
    <div>
      <nav style={{ padding: '15px', backgroundColor: '#333', color: '#fff', display: 'flex', gap: '20px' }}>
        <button onClick={() => setTab('establecimientos')}>Establecimientos</button>
        <button onClick={() => setTab('productos')}>ABM Productos</button>
        <button onClick={() => setTab('logistica')}>Logística (State)</button>
      </nav>

      <main>
        {tab === 'establecimientos' && <EstablecimientosABM />}
        {tab === 'productos' && <ProductosABM />}
        {tab === 'logistica' && <LogisticaBultos />}
      </main>
    </div>
  );
}
