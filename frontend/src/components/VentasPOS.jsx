import React, { useState, useEffect } from 'react';
import { apiService } from '../api/apiService';

export default function VentasPOS() {
  const [sucursales, setSucursales] = useState([]);
  const [idSucursal, setIdSucursal] = useState('');

  useEffect(() => {
    cargarSucursales();
  }, []);

  const cargarSucursales = async () => {
    const res = await apiService.getEstablecimientos();
    if (res && res.datos) {
      const listaSuc = res.datos.filter(e => e.tipo === 'sucursal');
      setSucursales(listaSuc);
      if (listaSuc.length > 0) {
        setIdSucursal(String(listaSuc[0].idEstablecimiento));
      }
    }
  };

  return (
    <div className="page">
      <h2 className="page-title">Ventas</h2>

      <section className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '12px'
          }}
        >
          <h3 className="card-title" style={{ margin: 0 }}>
            Punto de Venta (Patrón Strategy)
          </h3>

          <div className="field-inline">
            <label htmlFor="sel-sucursal-ventas">Sucursal:</label>
            <select
              id="sel-sucursal-ventas"
              className="select"
              value={idSucursal}
              onChange={e => setIdSucursal(e.target.value)}
            >
              {sucursales.map(s => (
                <option key={s.idEstablecimiento} value={s.idEstablecimiento}>
                  {s.codigo} — {s.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      <section className="card">
        <h3 className="card-title">Registro de Ventas y Devoluciones</h3>
        <p className="muted">
          Módulo de Ventas listo para operar con medios de pago (Efectivo, Tarjeta de Crédito y Transferencia).
        </p>
      </section>
    </div>
  );
}