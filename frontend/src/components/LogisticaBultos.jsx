import React, { useState, useEffect } from 'react';
import { apiService } from '../api/apiService';

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
    <div style={{ padding: '20px' }}>
      <h2>Módulo Logística - Trazabilidad y Patrón State (Bultos)</h2>
      <table border="1" cellPadding="8" style={{ width: '100%', borderCollapse: 'collapse' }}>
        <thead>
          <tr>
            <th>ID Bulto</th>
            <th>Código Bulto</th>
            <th>Estado Actual</th>
            <th>Precinto Ingresado</th>
            <th>Acción</th>
          </tr>
        </thead>
        <tbody>
          {bultos.map(b => (
            <tr key={b.idBulto}>
              <td>{b.idBulto}</td>
              <td>{b.codigoBulto}</td>
              <td><strong>{b.estadoActual}</strong></td>
              <td>
                <input 
                  type="text" 
                  placeholder="Código de Precinto" 
                  onChange={e => setCodigoInput({...codigoInput, [b.idBulto]: e.target.value})}
                />
              </td>
              <td>
                <button onClick={() => handleVerificar(b.idBulto)}>
                  Verificar Precinto
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}