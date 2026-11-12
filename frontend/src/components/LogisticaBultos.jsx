import React, { useState, useEffect } from 'react';
import { apiService } from '../api/apiService';

// Solo presentación: color de la etiqueta según el estado del bulto.
const claseEstado = (estado = '') => {
  const e = estado.toLowerCase();
  if (e.includes('verificado')) return 'tag-success';
  if (e.includes('rechazado')) return 'tag-danger';
  return '';
};

export default function LogisticaBultos() {
  const [bultos, setBultos] = useState([]);
  const [codigoInput, setCodigoInput] = useState({});

  useEffect(() => {
    cargarBultos();
  }, []);

  const cargarBultos = async () => {
    const res = await apiService.getBultos();
    if (res && res.datos) setBultos(res.datos);
  };

  const handleVerificar = async (idBulto) => {
    const precinto = codigoInput[idBulto];
    if (!precinto) return alert("Ingrese el código de precinto");
    
    const respuesta = await apiService.verificarPrecinto(idBulto, precinto);
    alert(respuesta.mensaje || respuesta.error);
    cargarBultos();
  };

  return (
    <div className="page">
      <h2 className="page-title">Módulo Logística - Trazabilidad y Patrón State (Bultos)</h2>
      <section className="card">
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th>ID Bulto</th>
                <th>Código Bulto</th>
                <th>Estado Actual</th>
                <th>Precinto Ingresado</th>
                <th className="right">Acción</th>
              </tr>
            </thead>
            <tbody>
              {bultos.map(b => (
                <tr key={b.idBulto}>
                  <td className="muted">{b.idBulto}</td>
                  <td className="strong">{b.codigoBulto}</td>
                  <td><span className={`tag ${claseEstado(b.estadoActual)}`}>{b.estadoActual}</span></td>
                  <td>
                    <input
                      className="input sm"
                      style={{ maxWidth: 220 }}
                      type="text"
                      placeholder="Código de Precinto"
                      onChange={e => setCodigoInput({...codigoInput, [b.idBulto]: e.target.value})}
                    />
                  </td>
                  <td className="right">
                    <button className="btn btn-outline btn-sm" onClick={() => handleVerificar(b.idBulto)}>
                      Verificar Precinto
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}