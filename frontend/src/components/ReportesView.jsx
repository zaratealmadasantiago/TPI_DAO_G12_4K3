import React, { useState, useEffect } from 'react';
import { apiService } from '../api/apiService';

const REPORTES = [
  { id: 'ventas', label: 'Ventas por Período', titulo: 'Ventas e Ingresos por Período, Local y Medio de Pago' },
  { id: 'mas-vendidos', label: 'Productos Más Vendidos', titulo: 'Productos Más Vendidos y Margen Estimado' },
  { id: 'stock', label: 'Existencias y Stock Mínimo', titulo: 'Existencias Actuales, Valorización y Stock Mínimo' },
  { id: 'bultos-rechazados', label: 'Bultos Rechazados', titulo: 'Bultos Rechazados y Mermas por Rotura de Precinto' },
  { id: 'tiempo-transito', label: 'Tiempo de Tránsito', titulo: 'Tiempo Promedio de Tránsito CD → Locales' },
];

const dinero = (n) => `$ ${Number(n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

function Tabla({ columnas, filas, vacio = 'No hay datos para mostrar.' }) {
  return (
    <div className="table-wrap">
      <table className="table">
        <thead>
          <tr>{columnas.map(c => <th key={c.titulo} className={c.right ? 'right' : ''}>{c.titulo}</th>)}</tr>
        </thead>
        <tbody>
          {filas.length === 0 ? (
            <tr><td colSpan={columnas.length} className="empty">{vacio}</td></tr>
          ) : (
            filas.map((f, i) => (
              <tr key={i}>
                {columnas.map(c => <td key={c.titulo} className={c.right ? 'right' : ''}>{c.valor(f)}</td>)}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );
}

function Resumen({ items }) {
  return (
    <div style={{ display: 'flex', gap: '24px', flexWrap: 'wrap', marginBottom: '16px' }}>
      {items.map(([titulo, valor]) => (
        <div key={titulo}>
          <div className="muted">{titulo}</div>
          <div style={{ fontSize: '18px', fontWeight: 600 }}>{valor}</div>
        </div>
      ))}
    </div>
  );
}

export default function ReportesView() {
  const [reporteActivo, setReporteActivo] = useState('ventas');
  const [establecimientos, setEstablecimientos] = useState([]);
  const [filtros, setFiltros] = useState({ fechaDesde: '', fechaHasta: '', idSucursal: '', idEstablecimiento: '', soloMinimo: false });
  // Se guarda de qué reporte son los datos para no dibujar un reporte con datos de otro
  const [resultado, setResultado] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    apiService.getEstablecimientos().then(res => setEstablecimientos(res?.datos || []));
  }, []);

  useEffect(() => {
    cargarReporte();
  }, [reporteActivo]);

  const cargarReporte = async () => {
    const reporte = reporteActivo;
    setResultado(null);
    setError('');
    const { fechaDesde, fechaHasta, idSucursal, idEstablecimiento, soloMinimo } = filtros;
    let res;
    try {
      if (reporteActivo === 'ventas') res = await apiService.getReporteVentas(fechaDesde, fechaHasta, idSucursal);
      if (reporteActivo === 'mas-vendidos') res = await apiService.getReporteMasVendidos(fechaDesde, fechaHasta, idSucursal);
      if (reporteActivo === 'stock') res = await apiService.getReporteStock(idEstablecimiento, soloMinimo);
      if (reporteActivo === 'bultos-rechazados') res = await apiService.getBultosRechazados();
      if (reporteActivo === 'tiempo-transito') res = await apiService.getReporteTiempoTransito();
    } catch {
      setError('No se pudo conectar con el servidor.');
      return;
    }
    if (res?.status === 'success') setResultado({ reporte, datos: res.datos });
    else setError(res?.mensaje || 'Error al obtener el reporte.');
  };

  const datos = resultado?.reporte === reporteActivo ? resultado.datos : null;
  const cambiarFiltro = (campo, valor) => setFiltros(prev => ({ ...prev, [campo]: valor }));
  const sucursales = establecimientos.filter(e => e.tipo === 'sucursal');
  const reporte = REPORTES.find(r => r.id === reporteActivo);
  const usaFiltroVentas = reporteActivo === 'ventas' || reporteActivo === 'mas-vendidos';

  return (
    <div className="page">
      <h2 className="page-title">Reportes</h2>

      <section className="card">
        <div style={{ display: 'flex', alignItems: 'center', gap: '16px', flexWrap: 'wrap' }}>
          {REPORTES.map(r => (
            <button
              key={r.id}
              type="button"
              onClick={() => setReporteActivo(r.id)}
              className={reporteActivo === r.id ? 'btn btn-primary btn-sm' : 'btn btn-sm'}
            >
              {r.label}
            </button>
          ))}
        </div>
      </section>

      <section className="card">
        <h3 className="card-title">{reporte.titulo}</h3>

        {/* FILTROS */}
        {(usaFiltroVentas || reporteActivo === 'stock') && (
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap', alignItems: 'center', marginBottom: '16px' }}>
            {usaFiltroVentas && (
              <>
                <div className="field-inline">
                  <label>Desde:</label>
                  <input type="date" className="input" value={filtros.fechaDesde} onChange={e => cambiarFiltro('fechaDesde', e.target.value)} />
                </div>
                <div className="field-inline">
                  <label>Hasta:</label>
                  <input type="date" className="input" value={filtros.fechaHasta} onChange={e => cambiarFiltro('fechaHasta', e.target.value)} />
                </div>
                <div className="field-inline">
                  <label>Sucursal:</label>
                  <select className="select" value={filtros.idSucursal} onChange={e => cambiarFiltro('idSucursal', e.target.value)}>
                    <option value="">Todas</option>
                    {sucursales.map(s => <option key={s.idEstablecimiento} value={s.idEstablecimiento}>{s.codigo} — {s.nombre}</option>)}
                  </select>
                </div>
              </>
            )}
            {reporteActivo === 'stock' && (
              <>
                <div className="field-inline">
                  <label>Establecimiento:</label>
                  <select className="select" value={filtros.idEstablecimiento} onChange={e => cambiarFiltro('idEstablecimiento', e.target.value)}>
                    <option value="">Todos</option>
                    {establecimientos.map(s => <option key={s.idEstablecimiento} value={s.idEstablecimiento}>{s.codigo} — {s.nombre}</option>)}
                  </select>
                </div>
                <label className="field-inline">
                  <input type="checkbox" checked={filtros.soloMinimo} onChange={e => cambiarFiltro('soloMinimo', e.target.checked)} />
                  Solo en stock mínimo
                </label>
              </>
            )}
            <button type="button" className="btn btn-primary btn-sm" onClick={cargarReporte}>Consultar</button>
          </div>
        )}

        {error && <p className="empty-text">{error}</p>}
        {!error && !datos && <p className="muted">Cargando...</p>}

        {/* 1. VENTAS POR PERÍODO */}
        {datos && reporteActivo === 'ventas' && (
          <>
            <Resumen items={[
              ['Cantidad de ventas', datos.resumen.cantidadVentas],
              ['Total vendido', dinero(datos.resumen.totalVendido)],
              ['Total devuelto', dinero(datos.resumen.totalDevuelto)],
              ['Ingreso neto', dinero(datos.resumen.ingresoNeto)],
            ]} />
            <h4>Por local</h4>
            <Tabla filas={datos.porSucursal} columnas={[
              { titulo: 'Sucursal', valor: f => f.sucursal },
              { titulo: 'Ventas', valor: f => f.cantidadVentas, right: true },
              { titulo: 'Total vendido', valor: f => dinero(f.totalVendido), right: true },
              { titulo: 'Devoluciones', valor: f => dinero(f.totalDevuelto), right: true },
              { titulo: 'Ingreso neto', valor: f => dinero(f.ingresoNeto), right: true },
            ]} />
            <h4>Por medio de pago</h4>
            <Tabla filas={datos.porMedioPago} columnas={[
              { titulo: 'Medio de pago', valor: f => f.medioPago },
              { titulo: 'Cantidad de pagos', valor: f => f.cantidadPagos, right: true },
              { titulo: 'Total cobrado', valor: f => dinero(f.totalCobrado), right: true },
            ]} />
          </>
        )}

        {/* 2. PRODUCTOS MÁS VENDIDOS */}
        {datos && reporteActivo === 'mas-vendidos' && (
          <Tabla filas={datos} columnas={[
            { titulo: '#', valor: f => datos.indexOf(f) + 1 },
            { titulo: 'Producto', valor: f => f.producto },
            { titulo: 'Cód. barras', valor: f => f.codigoBarras },
            { titulo: 'Unidades', valor: f => f.cantidadVendida, right: true },
            { titulo: 'Ingresos', valor: f => dinero(f.ingresos), right: true },
            { titulo: 'Costo', valor: f => dinero(f.costo), right: true },
            {
              titulo: 'Margen',
              right: true,
              valor: f => <span className={f.margen >= 0 ? 'tag tag-success' : 'tag tag-danger'}>{dinero(f.margen)} ({f.margenPorcentaje}%)</span>
            },
          ]} />
        )}

        {/* 3. EXISTENCIAS Y STOCK MÍNIMO */}
        {datos && reporteActivo === 'stock' && (
          <>
            <Resumen items={[
              ['Unidades en stock', datos.resumen.totalUnidades],
              ['Valorización (a costo)', dinero(datos.resumen.valorizacionTotal)],
              ['Productos en stock mínimo', datos.resumen.cantidadBajoMinimo],
            ]} />
            <Tabla filas={datos.items} columnas={[
              { titulo: 'Establecimiento', valor: f => f.establecimiento },
              { titulo: 'Producto', valor: f => f.producto },
              { titulo: 'Disponible', valor: f => f.cantidadDisponible, right: true },
              { titulo: 'Stock mínimo', valor: f => f.stockMinimo, right: true },
              { titulo: 'Valorización', valor: f => dinero(f.valorizacion), right: true },
              {
                titulo: 'Estado',
                valor: f => f.bajoMinimo ? <span className="tag tag-danger">Bajo mínimo</span> : <span className="tag tag-success">OK</span>
              },
            ]} />
          </>
        )}

        {/* 4. BULTOS RECHAZADOS */}
        {datos && reporteActivo === 'bultos-rechazados' && (
          <>
            <Resumen items={[
              ['Bultos rechazados', datos.resumen.cantidadBultos],
              ['Unidades afectadas', datos.resumen.totalUnidades],
              ['Valor de mermas (a costo)', dinero(datos.resumen.valorTotal)],
            ]} />
            <Tabla filas={datos.bultos} vacio="No hay bultos rechazados." columnas={[
              { titulo: 'Bulto', valor: f => f.codigoBulto },
              { titulo: 'Remito', valor: f => f.numeroRemito },
              { titulo: 'Destino', valor: f => f.destino },
              { titulo: 'Fecha rechazo', valor: f => f.fechaRechazo || '-' },
              { titulo: 'Precinto', valor: f => f.precintoIntacto ? 'Intacto' : <span className="tag tag-danger">Violado</span> },
              { titulo: 'Unidades', valor: f => f.unidades, right: true },
              { titulo: 'Valor merma', valor: f => dinero(f.valorMerma), right: true },
            ]} />
          </>
        )}

        {/* 5. TIEMPO DE TRÁNSITO */}
        {datos && reporteActivo === 'tiempo-transito' && (
          <>
            <Resumen items={[
              ['Envíos recibidos', datos.cantidadEnvios],
              ['Promedio general', `${datos.promedioGeneralHoras} hs`],
            ]} />
            <Tabla filas={datos.porSucursal} vacio="No hay envíos recibidos todavía." columnas={[
              { titulo: 'Sucursal destino', valor: f => f.sucursal },
              { titulo: 'Envíos', valor: f => f.cantidadEnvios, right: true },
              { titulo: 'Promedio de tránsito', valor: f => `${f.promedioHoras} hs`, right: true },
            ]} />
          </>
        )}
      </section>
    </div>
  );
}
