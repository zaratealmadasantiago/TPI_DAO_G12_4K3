import React, { useState, useEffect } from 'react';
import { apiService } from '../api/apiService';
import OrdenesReposicion from './OrdenesReposicion';
import LogisticaBultos from './LogisticaBultos';

export default function LogisticaModulo() {
  const [subIndice, setSubIndice] = useState('ordenes'); // 'ordenes' | 'remitos'
  const [sucursales, setSucursales] = useState([]);
  const [sucursalSeleccionadaId, setSucursalSeleccionadaId] = useState('');

  useEffect(() => {
    cargarSucursales();
  }, []);

  const cargarSucursales = async () => {
    const res = await apiService.getEstablecimientos();
    if (res && res.datos) {
      const soloSucursales = res.datos.filter(e => e.tipo === 'sucursal');
      setSucursales(soloSucursales);
      if (soloSucursales.length > 0 && !sucursalSeleccionadaId) {
        setSucursalSeleccionadaId(String(soloSucursales[0].idEstablecimiento));
      }
    }
  };

  const sucursalActual = sucursales.find(
    s => String(s.idEstablecimiento) === String(sucursalSeleccionadaId)
  );

  return (
    <div style={{ padding: '20px' }}>
      <h2>Módulo Logística</h2>

      {/* BARRA SUPERIOR PERSISTENTE: SELECTOR DE SUCURSAL + SUBÍNDICES */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          padding: '14px 18px',
          backgroundColor: '#f5f7fa',
          border: '1px solid #d9d9d9',
          borderRadius: '6px',
          marginBottom: '20px'
        }}
      >
        {/* Desplegable de Sucursales (se mantiene al cambiar entre los 2 subíndices) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <label htmlFor="select-sucursal-logistica" style={{ fontWeight: 'bold', color: '#222' }}>
            Sucursal:
          </label>
          <select
            id="select-sucursal-logistica"
            value={sucursalSeleccionadaId}
            onChange={e => setSucursalSeleccionadaId(e.target.value)}
            style={{
              padding: '7px 12px',
              fontSize: '14px',
              fontWeight: 'bold',
              borderRadius: '4px',
              border: '1.5px solid #1890ff',
              backgroundColor: '#fff',
              minWidth: '240px'
            }}
          >
            {sucursales.length === 0 && <option value="">Cargando sucursales...</option>}
            {sucursales.map(s => (
              <option key={s.idEstablecimiento} value={s.idEstablecimiento}>
                {s.codigo} — {s.nombre}
              </option>
            ))}
          </select>
        </div>

        {/* Pestañas de Subíndices de Logística */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setSubIndice('ordenes')}
            style={{
              padding: '8px 16px',
              fontWeight: 'bold',
              borderRadius: '4px',
              border: subIndice === 'ordenes' ? '1.5px solid #1890ff' : '1px solid #ccc',
              backgroundColor: subIndice === 'ordenes' ? '#1890ff' : '#fff',
              color: subIndice === 'ordenes' ? '#fff' : '#333',
              cursor: 'pointer'
            }}
          >
            Órdenes de Reposición
          </button>
          <button
            type="button"
            onClick={() => setSubIndice('remitos')}
            style={{
              padding: '8px 16px',
              fontWeight: 'bold',
              borderRadius: '4px',
              border: subIndice === 'remitos' ? '1.5px solid #1890ff' : '1px solid #ccc',
              backgroundColor: subIndice === 'remitos' ? '#1890ff' : '#fff',
              color: subIndice === 'remitos' ? '#fff' : '#333',
              cursor: 'pointer'
            }}
          >
            Remitos
          </button>
        </div>
      </div>

      {/* CONTENIDO DEL SUBÍNDICE ACTIVO */}
      {subIndice === 'ordenes' ? (
        <OrdenesReposicion
          idSucursal={sucursalSeleccionadaId ? Number(sucursalSeleccionadaId) : null}
          sucursalActual={sucursalActual}
        />
      ) : (
        <LogisticaBultos
          idSucursal={sucursalSeleccionadaId ? Number(sucursalSeleccionadaId) : null}
          sucursalActual={sucursalActual}
        />
      )}
    </div>
  );
}