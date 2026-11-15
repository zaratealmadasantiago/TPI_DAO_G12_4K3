import React, { useState, useEffect } from 'react';
import { apiService } from '../api/apiService';
import OrdenesReposicion from './OrdenesReposicion';
import LogisticaBultos from './LogisticaBultos';

export default function LogisticaModulo() {
  const [ambito, setAmbito] = useState('cd'); // 'cd' | 'sucursal'
  const [subIndice, setSubIndice] = useState('ordenes'); // 'ordenes' | 'remitos'

  const [centroDistribucion, setCentroDistribucion] = useState(null);
  const [sucursales, setSucursales] = useState([]);
  const [sucursalSeleccionadaId, setSucursalSeleccionadaId] = useState('');

  useEffect(() => {
    cargarEstablecimientos();
  }, []);

  const cargarEstablecimientos = async () => {
    const res = await apiService.getEstablecimientos();
    if (res && res.datos) {
      const cd = res.datos.find(e => e.tipo === 'centro_distribucion');
      const soloSucursales = res.datos.filter(e => e.tipo === 'sucursal');
      setCentroDistribucion(cd || null);
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

      {/* BARRA SUPERIOR PERSISTENTE: DIVISIÓN CD / SUCURSALES + SUBÍNDICES */}
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
          {/* BLOQUE IZQUIERDO: DIVISIÓN CENTRO DE DISTRIBUCIÓN vs SUCURSALES */}
          <div style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
            <div style={{ display: 'flex', gap: '6px' }}>
              <button
                type="button"
                onClick={() => setAmbito('cd')}
                className={ambito === 'cd' ? 'btn btn-primary' : 'btn'}
              >
                Centro de Distribución
              </button>
              <button
                type="button"
                onClick={() => setAmbito('sucursal')}
                className={ambito === 'sucursal' ? 'btn btn-primary' : 'btn'}
              >
                Sucursales
              </button>
            </div>

            {ambito === 'cd' ? (
              <span className="strong" style={{ paddingLeft: '8px', borderLeft: '2px solid #d9d9d9' }}>
                {centroDistribucion
                  ? `${centroDistribucion.codigo} — ${centroDistribucion.nombre}`
                  : 'CD Central'}
              </span>
            ) : (
              <div className="field-inline" style={{ paddingLeft: '8px', borderLeft: '2px solid #d9d9d9' }}>
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
            )}
          </div>

          {/* BLOQUE DERECHO: SUBÍNDICES OR / REMITOS */}
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              type="button"
              onClick={() => setSubIndice('ordenes')}
              className={subIndice === 'ordenes' ? 'btn btn-primary' : 'btn'}
            >
              {ambito === 'cd' ? 'OR Esperando Aprobación' : 'Órdenes de Reposición'}
            </button>
            <button
              type="button"
              onClick={() => setSubIndice('remitos')}
              className={subIndice === 'remitos' ? 'btn btn-primary' : 'btn'}
            >
              Remitos y Bultos
            </button>
          </div>
        </div>
      </section>

      {/* CONTENIDO DEL SUBÍNDICE ACTIVO */}
      {subIndice === 'ordenes' ? (
        <OrdenesReposicion
          ambito={ambito}
          centroDistribucion={centroDistribucion}
          idSucursal={sucursalSeleccionadaId ? Number(sucursalSeleccionadaId) : null}
          sucursalActual={sucursalActual}
        />
      ) : (
        <LogisticaBultos
          ambito={ambito}
          centroDistribucion={centroDistribucion}
          idSucursal={sucursalSeleccionadaId ? Number(sucursalSeleccionadaId) : null}
          sucursalActual={sucursalActual}
        />
      )}
    </div>
  );
}