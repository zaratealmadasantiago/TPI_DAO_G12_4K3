import React, { useState } from 'react';

export default function ReportesView() {
  const [reporteActivo, setReporteActivo] = useState('ventas');

  return (
    <div className="page">
      <h2 className="page-title">Reportes</h2>

      <section className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          <button
            type="button"
            onClick={() => setReporteActivo('ventas')}
            className={reporteActivo === 'ventas' ? 'btn btn-primary btn-sm' : 'btn btn-sm'}
          >
            Ventas por Período
          </button>

          <button
            type="button"
            onClick={() => setReporteActivo('mas-vendidos')}
            className={reporteActivo === 'mas-vendidos' ? 'btn btn-primary btn-sm' : 'btn btn-sm'}
          >
            Productos Más Vendidos
          </button>

          <button
            type="button"
            onClick={() => setReporteActivo('stock-minimo')}
            className={reporteActivo === 'stock-minimo' ? 'btn btn-primary btn-sm' : 'btn btn-sm'}
          >
            Alertas Stock Mínimo
          </button>

          <button
            type="button"
            onClick={() => setReporteActivo('bultos-rechazados')}
            className={reporteActivo === 'bultos-rechazados' ? 'btn btn-primary btn-sm' : 'btn btn-sm'}
          >
            Bultos Rechazados
          </button>

          <button
            type="button"
            onClick={() => setReporteActivo('tiempo-promedio-bultos')}
            className={reporteActivo === 'tiempo-promedio-bultos' ? 'btn btn-primary btn-sm' : 'btn btn-sm'}
          >
            Tiempo Promedio Bultos Recibidos
          </button>
        </div>
      </section>

      <section className="card">
        <h3 className="card-title">
          {reporteActivo === 'ventas' && 'Reporte de Ventas por Período'}
          {reporteActivo === 'mas-vendidos' && 'Reporte de Productos Más Vendidos'}
          {reporteActivo === 'stock-minimo' && 'Reporte de Alertas de Stock Mínimo'}
          {reporteActivo === 'bultos-rechazados' && 'Reporte de Bultos Rechazados'}
          {reporteActivo === 'tiempo-promedio-bultos' && 'Reporte de Tiempo Promedio de Bultos Recibidos'}
        </h3>
        <p className="muted">
          Vista base del módulo de Reportes lista para consultar indicadores económicos y logísticos.
        </p>
      </section>
    </div>
  );
}