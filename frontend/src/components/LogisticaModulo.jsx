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
    <div className="page">
      <h2 className="page-title">Módulo Logística</h2>

      {/* BARRA SUPERIOR PERSISTENTE: SELECTOR DE SUCURSAL + SUBÍNDICES */}
      <section className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '16px'
          }}
        >
          <div className="field-inline">
            <label htmlFor="select-sucursal-logistica">Sucursal:</label>
            <select
              id="select-sucursal-logistica"
              className="select"
              value={sucursalSeleccionadaId}
              onChange={e => setSucursalSeleccionadaId(e.target.value)}
            >
              {sucursales.length === 0 && <option value="">Cargando sucursales...</option>}
              {sucursales.map(s => (
                <option key={s.idEstablecimiento} value={s.idEstablecimiento}>
                  {s.codigo} — {s.nombre}
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setSubIndice('ordenes')}
              className={subIndice === 'ordenes' ? 'btn btn-primary' : 'btn'}
            >
              Órdenes de Reposición
            </button>
            <button
              type="button"
              onClick={() => setSubIndice('remitos')}
              className={subIndice === 'remitos' ? 'btn btn-primary' : 'btn'}
            >
              Remitos
            </button>
          </div>
        </div>
      </section>

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