import React, { useState, useEffect } from 'react';
import { apiService } from '../api/apiService';

const formatoMoneda = (n) =>
  `$ ${Number(n || 0).toLocaleString('es-AR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

// Tabla fija de coeficientes de financiación según plan de cuotas
const PLANES_CUOTAS = {
  1: { cuotas: 1, recargoPct: 0, cftea: '0,00%' },
  3: { cuotas: 3, recargoPct: 24.6, cftea: '284,00%' },
  6: { cuotas: 6, recargoPct: 33.8, cftea: '182,00%' },
  12: { cuotas: 12, recargoPct: 48.4, cftea: '117,00%' },
};

const calcularPlanCuotas = (montoBase, cuotasStr) => {
  const capital = parseFloat(montoBase) || 0;
  const cuotasNum = parseInt(cuotasStr, 10) || 1;
  const plan = PLANES_CUOTAS[cuotasNum] || PLANES_CUOTAS[1];
  const montoInteres = Number(((capital * plan.recargoPct) / 100).toFixed(2));
  const totalFinanciado = Number((capital + montoInteres).toFixed(2));
  const valorCuota = Number((totalFinanciado / plan.cuotas).toFixed(2));

  return {
    capital,
    cuotasNum: plan.cuotas,
    recargoPct: plan.recargoPct,
    cftea: plan.cftea,
    tieneInteres: plan.cuotas > 1,
    montoInteres,
    totalFinanciado,
    valorCuota,
  };
};

// --- HELPERS DE SANITIZACIÓN Y VALIDACIÓN DE ENTRADA ---
const sanitizarEnteroPositivo = (valor, maxDigitos = 5) =>
  String(valor ?? '')
    .replace(/\D/g, '')
    .slice(0, maxDigitos);

const sanitizarMoneda = (valor) => {
  let limpio = String(valor ?? '')
    .replace(/,/g, '.')
    .replace(/[^0-9.]/g, '');

  const partes = limpio.split('.');
  if (partes.length > 2) {
    limpio = `${partes[0]}.${partes.slice(1).join('')}`;
  }
  const [entero, decimal] = limpio.split('.');
  const enteroAcotado = (entero || '').slice(0, 9);
  if (decimal !== undefined) {
    return `${enteroAcotado}.${decimal.slice(0, 2)}`;
  }
  return enteroAcotado;
};

const sanitizarBusquedaProducto = (valor) =>
  String(valor ?? '')
    .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s.,()$|:—-]/g, '')
    .slice(0, 120);

const sanitizarCodigoAutorizacion = (valor) =>
  String(valor ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, '')
    .slice(0, 20);

const sanitizarCbuAlias = (valor) =>
  String(valor ?? '')
    .replace(/[^a-zA-Z0-9.-]/g, '')
    .slice(0, 22);

const sanitizarComprobanteTransferencia = (valor) =>
  String(valor ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9/_-]/g, '')
    .slice(0, 40);

const sanitizarMotivoDevolucion = (valor) =>
  String(valor ?? '')
    .replace(/[^a-zA-Z0-9áéíóúÁÉÍÓÚñÑüÜ\s.,;:()°/-]/g, '')
    .slice(0, 200);

const bloquearTeclasInvalidasNumero = (e, permitirDecimal = false) => {
  const teclasBloqueadas = permitirDecimal ? ['-', '+', 'e', 'E'] : ['-', '+', 'e', 'E', '.', ','];
  if (teclasBloqueadas.includes(e.key)) {
    e.preventDefault();
  }
};

export default function VentasPOS() {
  const [sucursales, setSucursales] = useState([]);
  const [idSucursal, setIdSucursal] = useState('');
  const [subVista, setSubVista] = useState('nueva-venta'); // 'nueva-venta' | 'historial' | 'devoluciones'

  // Stock disponible en la sucursal activa
  const [stockSucursal, setStockSucursal] = useState([]);
  const [ventas, setVentas] = useState([]);
  const [devoluciones, setDevoluciones] = useState([]);

  // --- ESTADO PARA NUEVA VENTA ---
  const [busquedaProducto, setBusquedaProducto] = useState('');
  const [idProductoSeleccionado, setIdProductoSeleccionado] = useState('');
  const [cantidadAgregar, setCantidadAgregar] = useState('1');
  const [carrito, setCarrito] = useState([]);
  const [errorVenta, setErrorVenta] = useState('');
  const [erroresCampoVenta, setErroresCampoVenta] = useState({});
  const [erroresPagos, setErroresPagos] = useState({});
  const [avisoReingresoPagos, setAvisoReingresoPagos] = useState('');

  // --- MEDIOS DE PAGO (HASTA 3 COMBINADOS) ---
  const [pagos, setPagos] = useState([
    {
      idTemp: 1,
      tipo: 'efectivo',
      monto: '',
      montoEntregado: '',
      numeroTarjeta: '',
      cuotas: '1',
      codigoAutorizacion: '',
      cbuOrigen: '',
      comprobanteTransferencia: '',
    },
  ]);

  // --- ESTADO Y FILTROS PARA HISTORIAL ---
  const [ventaExpandidaId, setVentaExpandidaId] = useState(null);
  const [filtroTieneDev, setFiltroTieneDev] = useState('todos'); // 'todos' | 'si' | 'no'
  const [filtroTipoDev, setFiltroTipoDev] = useState('todos'); // 'todos' | 'parcial' | 'total' | 'ninguna'
  const [filtroMetodoPago, setFiltroMetodoPago] = useState('todos'); // 'todos' | 'efectivo' | 'tarjeta_credito' | 'transferencia'

  // --- ESTADO PARA DEVOLUCIONES ---
  const [idVentaDevolucion, setIdVentaDevolucion] = useState('');
  const [cantidadesDevolver, setCantidadesDevolver] = useState({});
  const [motivoDevolucion, setMotivoDevolucion] = useState('');
  const [reingresarStockDev, setReingresarStockDev] = useState(true);
  const [errorDevolucion, setErrorDevolucion] = useState('');
  const [erroresCampoDev, setErroresCampoDev] = useState({});

  // --- MODALES ---
  const [modalConfirmarVenta, setModalConfirmarVenta] = useState(null);
  const [modalComprobanteVenta, setModalComprobanteVenta] = useState(null);
  const [modalConfirmarDevolucion, setModalConfirmarDevolucion] = useState(null);

  useEffect(() => {
    cargarSucursales();
  }, []);

  const cargarSucursales = async () => {
    const res = await apiService.getEstablecimientos();
    if (res && res.datos) {
      const listaSuc = res.datos.filter((e) => e.tipo === 'sucursal');
      setSucursales(listaSuc);
      if (listaSuc.length > 0 && !idSucursal) {
        setIdSucursal(String(listaSuc[0].idEstablecimiento));
      }
    }
  };

  useEffect(() => {
    if (idSucursal) {
      recargarDatosSucursal(idSucursal);
      setCarrito([]);
      setBusquedaProducto('');
      setIdProductoSeleccionado('');
      setCantidadAgregar('1');
      setErrorVenta('');
      setErroresCampoVenta({});
      setErroresPagos({});
      setAvisoReingresoPagos('');
      setIdVentaDevolucion('');
      setCantidadesDevolver({});
      setMotivoDevolucion('');
      setErrorDevolucion('');
      setErroresCampoDev({});
    }
  }, [idSucursal]);

  const recargarDatosSucursal = async (idSuc) => {
    const [resStock, resVentas, resDev] = await Promise.all([
      apiService.getStockPorEstablecimiento(idSuc),
      apiService.getVentas(idSuc),
      apiService.getDevoluciones(idSuc),
    ]);

    if (resStock && resStock.datos) {
      setStockSucursal(resStock.datos);
    } else {
      setStockSucursal([]);
    }

    if (resVentas && resVentas.datos) {
      setVentas(resVentas.datos);
    } else {
      setVentas([]);
    }

    if (resDev && resDev.datos) {
      setDevoluciones(resDev.datos);
    } else {
      setDevoluciones([]);
    }
  };

  const sucursalActual =
    sucursales.find((s) => String(s.idEstablecimiento) === String(idSucursal)) || null;

  const productosDisponiblesPOS = stockSucursal.filter((item) => item.cantidadDisponible > 0);

  const itemStockSeleccionado = (() => {
    let item = productosDisponiblesPOS.find(
      (i) => String(i.idProducto) === String(idProductoSeleccionado)
    );
    if (!item && busquedaProducto.trim()) {
      const q = busquedaProducto.trim().toLowerCase();
      item = productosDisponiblesPOS.find(
        (i) =>
          `${i.nombre} — Cód: ${i.codigoBarras} ($${i.precioVenta} | Disp: ${i.cantidadDisponible} u.)`.toLowerCase() === q ||
          i.nombre.toLowerCase() === q ||
          String(i.codigoBarras).toLowerCase() === q
      );
    }
    return item || null;
  })();

  const disponibleRestanteSeleccionado = (() => {
    if (!itemStockSeleccionado) return null;
    const enCarr = carrito.find((c) => c.idProducto === itemStockSeleccionado.idProducto);
    const yaEnCarrito = enCarr ? enCarr.cantidad : 0;
    return Math.max(0, itemStockSeleccionado.cantidadDisponible - yaEnCarrito);
  })();

  const formatearOpcionProducto = (item) =>
    `${item.nombre} — Cód: ${item.codigoBarras} ($${item.precioVenta} | Disp: ${item.cantidadDisponible} u.)`;

  const handleBusquedaProductoChange = (e) => {
    const valor = sanitizarBusquedaProducto(e.target.value);
    setBusquedaProducto(valor);
    setErrorVenta('');
    setErroresCampoVenta((prev) => ({ ...prev, producto: null, cantidad: null }));

    const norm = valor.trim().toLowerCase();
    const match = productosDisponiblesPOS.find(
      (item) =>
        formatearOpcionProducto(item).toLowerCase() === norm ||
        item.nombre.toLowerCase() === norm ||
        String(item.codigoBarras).toLowerCase() === norm
    );

    if (match) {
      setIdProductoSeleccionado(String(match.idProducto));
      const enCarr = carrito.find((c) => c.idProducto === match.idProducto)?.cantidad || 0;
      const disp = Math.max(0, match.cantidadDisponible - enCarr);
      setCantidadAgregar(disp > 0 ? '1' : '0');
    } else {
      setIdProductoSeleccionado('');
    }
  };

  const handleCantidadAgregarChange = (e) => {
    const soloDigitos = sanitizarEnteroPositivo(e.target.value, 5);
    setErrorVenta('');
    setErroresCampoVenta((prev) => ({ ...prev, cantidad: null }));

    if (soloDigitos === '') {
      setCantidadAgregar('');
      return;
    }

    const num = parseInt(soloDigitos, 10);
    if (isNaN(num)) return;

    if (num === 0) {
      setCantidadAgregar('0');
      setErroresCampoVenta((prev) => ({
        ...prev,
        cantidad: 'La cantidad mínima a agregar es 1 unidad.',
      }));
      return;
    }

    if (
      disponibleRestanteSeleccionado !== null &&
      num > disponibleRestanteSeleccionado
    ) {
      setCantidadAgregar(String(disponibleRestanteSeleccionado));
      setErroresCampoVenta((prev) => ({
        ...prev,
        cantidad: `Máximo disponible para "${itemStockSeleccionado.nombre}": ${disponibleRestanteSeleccionado} u.`,
      }));
    } else {
      setCantidadAgregar(String(num));
    }
  };

  // --- CÁLCULO DEL TOTAL DEL CARRITO ---
  const totalCarrito = Number(
    carrito.reduce((acc, item) => acc + item.cantidad * item.precioVenta, 0).toFixed(2)
  );

  // Cuando hay 1 solo medio de pago, toma automáticamente el totalCarrito
  useEffect(() => {
    if (pagos.length === 1) {
      setPagos((prev) => [
        {
          ...prev[0],
          monto: totalCarrito > 0 ? String(totalCarrito) : '',
        },
      ]);
      setAvisoReingresoPagos('');
    }
  }, [totalCarrito, pagos.length]);

  // --- AGREGAR PRODUCTO AL CARRITO ---
  const handleAgregarAlCarrito = (e) => {
    e.preventDefault();
    setErrorVenta('');
    const nuevosErr = {};

    const itemStock = itemStockSeleccionado;
    if (!itemStock) {
      nuevosErr.producto = 'Seleccione un producto válido con stock disponible en esta sucursal.';
      setErroresCampoVenta(nuevosErr);
      return setErrorVenta(nuevosErr.producto);
    }

    const cant = parseInt(cantidadAgregar, 10);
    if (!cantidadAgregar || isNaN(cant) || cant <= 0) {
      nuevosErr.cantidad = 'Ingrese una cantidad entera mayor a 0.';
      setErroresCampoVenta(nuevosErr);
      return setErrorVenta(nuevosErr.cantidad);
    }

    const enCarrito = carrito.find((c) => c.idProducto === itemStock.idProducto);
    const cantidadAcumulada = (enCarrito ? enCarrito.cantidad : 0) + cant;

    if (cantidadAcumulada > itemStock.cantidadDisponible) {
      nuevosErr.cantidad = `Stock insuficiente para "${itemStock.nombre}". Disponible en sucursal: ${itemStock.cantidadDisponible} u.`;
      setErroresCampoVenta(nuevosErr);
      return setErrorVenta(nuevosErr.cantidad);
    }

    setErroresCampoVenta({});
    setCarrito((prev) => {
      if (enCarrito) {
        return prev.map((c) =>
          c.idProducto === itemStock.idProducto
            ? { ...c, cantidad: c.cantidad + cant }
            : c
        );
      }
      return [
        ...prev,
        {
          idProducto: itemStock.idProducto,
          codigoBarras: itemStock.codigoBarras,
          nombre: itemStock.nombre,
          precioVenta: itemStock.precioVenta,
          stockDisponible: itemStock.cantidadDisponible,
          cantidad: cant,
        },
      ];
    });

    setBusquedaProducto('');
    setIdProductoSeleccionado('');
    setCantidadAgregar('1');
  };

  const handleActualizarCantidadCarrito = (idProducto, nuevaCantStr) => {
    const limpio = sanitizarEnteroPositivo(nuevaCantStr, 5);
    const cant = parseInt(limpio, 10);
    setErrorVenta('');

    setCarrito((prev) =>
      prev.map((item) => {
        if (item.idProducto !== idProducto) return item;
        if (limpio === '' || isNaN(cant) || cant <= 0) return { ...item, cantidad: 0 };
        if (cant > item.stockDisponible) {
          setErrorVenta(
            `Máximo disponible para "${item.nombre}": ${item.stockDisponible} u.`
          );
          return { ...item, cantidad: item.stockDisponible };
        }
        return { ...item, cantidad: cant };
      })
    );
  };

  const handleNormalizarCantidadCarritoBlur = (idProducto) => {
    setCarrito((prev) =>
      prev.map((item) => {
        if (item.idProducto !== idProducto) return item;
        if (!item.cantidad || item.cantidad <= 0) {
          return { ...item, cantidad: 1 };
        }
        return item;
      })
    );
  };

  const handleQuitarDelCarrito = (idProducto) => {
    setCarrito((prev) => prev.filter((item) => item.idProducto !== idProducto));
    setErrorVenta('');
  };

  const limpiarErrorPagoCampo = (idTemp, campo) => {
    setErroresPagos((prev) => {
      if (!prev[idTemp]) return prev;
      const copia = { ...prev[idTemp] };
      delete copia[campo];
      return { ...prev, [idTemp]: copia };
    });
  };

  // --- MANEJO DE MEDIOS DE PAGO (HASTA 3, EFECTIVO MÁXIMO 1 VEZ) ---
  const handleCambiarPago = (idTemp, campo, valor) => {
    setErrorVenta('');
    limpiarErrorPagoCampo(idTemp, campo);

    if (campo === 'tipo') {
      if (valor === 'efectivo') {
        const yaHayEfectivo = pagos.some((p) => p.tipo === 'efectivo' && p.idTemp !== idTemp);
        if (yaHayEfectivo) {
          return setErrorVenta('El medio de pago "Efectivo" solo se puede elegir una vez por venta.');
        }
      }
      setErroresPagos((prev) => ({ ...prev, [idTemp]: {} }));
      setPagos((prev) =>
        prev.map((p) =>
          p.idTemp === idTemp
            ? {
                ...p,
                tipo: valor,
                cuotas: valor === 'tarjeta_credito' ? p.cuotas : '1',
                montoEntregado: '',
                numeroTarjeta: '',
                codigoAutorizacion: '',
                cbuOrigen: '',
                comprobanteTransferencia: '',
              }
            : p
        )
      );
      return;
    }

    if (campo === 'montoEntregado') {
      const monedaLimpia = sanitizarMoneda(valor);
      setPagos((prev) =>
        prev.map((p) => (p.idTemp === idTemp ? { ...p, montoEntregado: monedaLimpia } : p))
      );
      return;
    }

    if (campo === 'numeroTarjeta') {
      const soloDigitos = sanitizarEnteroPositivo(valor, 4);
      setPagos((prev) =>
        prev.map((p) => (p.idTemp === idTemp ? { ...p, numeroTarjeta: soloDigitos } : p))
      );
      return;
    }

    if (campo === 'codigoAutorizacion') {
      const autLimpio = sanitizarCodigoAutorizacion(valor);
      setPagos((prev) =>
        prev.map((p) => (p.idTemp === idTemp ? { ...p, codigoAutorizacion: autLimpio } : p))
      );
      return;
    }

    if (campo === 'cbuOrigen') {
      const cbuLimpio = sanitizarCbuAlias(valor);
      setPagos((prev) =>
        prev.map((p) => (p.idTemp === idTemp ? { ...p, cbuOrigen: cbuLimpio } : p))
      );
      return;
    }

    if (campo === 'comprobanteTransferencia') {
      const compLimpio = sanitizarComprobanteTransferencia(valor);
      setPagos((prev) =>
        prev.map((p) =>
          p.idTemp === idTemp ? { ...p, comprobanteTransferencia: compLimpio } : p
        )
      );
      return;
    }

    if (campo === 'cuotas') {
      const cuotaValida = PLANES_CUOTAS[parseInt(valor, 10)] ? String(valor) : '1';
      setPagos((prev) =>
        prev.map((p) => (p.idTemp === idTemp ? { ...p, cuotas: cuotaValida } : p))
      );
      return;
    }

    // Campo 'monto' (importe base a cobrar en medios combinados)
    const monedaLimpia = sanitizarMoneda(valor);

    if (monedaLimpia === '') {
      setPagos((prev) =>
        prev.map((p) => (p.idTemp === idTemp ? { ...p, monto: '' } : p))
      );
      return;
    }

    const num = parseFloat(monedaLimpia);
    if (isNaN(num) || num < 0) return;

    const sumaOtros = pagos
      .filter((p) => p.idTemp !== idTemp)
      .reduce((acc, p) => acc + (parseFloat(p.monto) || 0), 0);

    const nuevaSuma = Number((sumaOtros + num).toFixed(2));

    if (num > totalCarrito + 0.01 || nuevaSuma > totalCarrito + 0.01) {
      const msgExceso = `El importe ingresado (${formatoMoneda(num)}) hace que el total de cobros (${formatoMoneda(nuevaSuma)}) supere el costo total a pagar (${formatoMoneda(totalCarrito)}). Reingrese los valores.`;
      setErrorVenta(msgExceso);
      setErroresPagos((prev) => ({
        ...prev,
        [idTemp]: { ...(prev[idTemp] || {}), monto: 'Supera el saldo pendiente a cobrar.' },
      }));
      setPagos((prev) =>
        prev.map((p) => (p.idTemp === idTemp ? { ...p, monto: '' } : p))
      );
      return;
    }

    setAvisoReingresoPagos('');
    setPagos((prev) =>
      prev.map((p) => (p.idTemp === idTemp ? { ...p, monto: monedaLimpia } : p))
    );
  };

  const handleAgregarMedioPago = () => {
    if (pagos.length >= 3) return;
    setErrorVenta('');
    setErroresPagos({});

    const yaTieneEfectivo = pagos.some((p) => p.tipo === 'efectivo');
    const tipoPorDefecto = yaTieneEfectivo ? 'tarjeta_credito' : 'efectivo';
    const habiaMontosCargados = pagos.some((p) => (parseFloat(p.monto) || 0) > 0);

    setPagos((prev) => [
      ...prev.map((p) => ({
        ...p,
        monto: '',
      })),
      {
        idTemp: Date.now(),
        tipo: tipoPorDefecto,
        monto: '',
        montoEntregado: '',
        numeroTarjeta: '',
        cuotas: '1',
        codigoAutorizacion: '',
        cbuOrigen: '',
        comprobanteTransferencia: '',
      },
    ]);

    if (habiaMontosCargados) {
      setAvisoReingresoPagos(
        'Se añadió un nuevo medio de pago y se reiniciaron los importes anteriores. Por favor, reingrese los montos a cobrar en cada medio de pago sin superar el total.'
      );
    }
  };

  const handleQuitarMedioPago = (idTemp) => {
    if (pagos.length <= 1) return;
    setErrorVenta('');
    setAvisoReingresoPagos('');
    setErroresPagos((prev) => {
      const copia = { ...prev };
      delete copia[idTemp];
      return copia;
    });
    setPagos((prev) => prev.filter((p) => p.idTemp !== idTemp));
  };

  // --- VALIDAR Y SOLICITAR CONFIRMACIÓN DE VENTA ---
  const handleSolicitarConfirmarVenta = () => {
    setErrorVenta('');
    const nuevosErroresPagos = {};

    if (!idSucursal) {
      return setErrorVenta('Seleccione una sucursal válida.');
    }
    if (carrito.length === 0) {
      return setErrorVenta('Agregue al menos un producto al detalle de la venta.');
    }
    const itemCero = carrito.find((i) => !i.cantidad || i.cantidad <= 0);
    if (itemCero) {
      return setErrorVenta(`La cantidad de "${itemCero.nombre}" debe ser mayor a 0.`);
    }
    const itemSinStock = carrito.find((i) => i.cantidad > i.stockDisponible);
    if (itemSinStock) {
      return setErrorVenta(
        `La cantidad de "${itemSinStock.nombre}" (${itemSinStock.cantidad} u.) supera el stock disponible (${itemSinStock.stockDisponible} u.).`
      );
    }
    if (pagos.length === 0 || pagos.length > 3) {
      return setErrorVenta('Debe configurar entre 1 y 3 medios de pago.');
    }

    const cantEfectivo = pagos.filter((p) => p.tipo === 'efectivo').length;
    if (cantEfectivo > 1) {
      return setErrorVenta('Efectivo solo puede seleccionarse una vez por venta.');
    }

    let sumaPagos = 0;
    let totalInteresesFinanciacion = 0;
    const pagosFormateados = [];
    let primerErrorGlobal = '';

    for (let idx = 0; idx < pagos.length; idx++) {
      const p = pagos[idx];
      const errP = {};
      const montoNum = parseFloat(p.monto);

      if (isNaN(montoNum) || montoNum <= 0) {
        errP.monto = 'Ingrese un importe mayor a $0,00.';
        if (!primerErrorGlobal) {
          primerErrorGlobal = `Reingrese un importe válido mayor a $0 en el Medio de Pago #${idx + 1}.`;
        }
      } else if (montoNum > totalCarrito + 0.01) {
        errP.monto = `No puede superar ${formatoMoneda(totalCarrito)}.`;
        if (!primerErrorGlobal) {
          primerErrorGlobal = `El importe del Medio de Pago #${idx + 1} (${formatoMoneda(montoNum)}) supera el costo total (${formatoMoneda(totalCarrito)}).`;
        }
      } else {
        sumaPagos = Number((sumaPagos + montoNum).toFixed(2));
      }

      if (p.tipo === 'efectivo') {
        const entregadoNum =
          p.montoEntregado !== '' ? parseFloat(p.montoEntregado) : montoNum;
        if (isNaN(entregadoNum) || (!isNaN(montoNum) && entregadoNum < montoNum)) {
          errP.montoEntregado = `Debe ser mayor o igual a ${formatoMoneda(montoNum || 0)}.`;
          if (!primerErrorGlobal) {
            primerErrorGlobal = `En Efectivo (Pago #${idx + 1}), el monto entregado debe ser mayor o igual a ${formatoMoneda(montoNum || 0)}.`;
          }
        }
        if (Object.keys(errP).length === 0) {
          pagosFormateados.push({
            tipo: 'efectivo',
            monto: montoNum,
            montoEntregado: entregadoNum,
            vuelto: Number((entregadoNum - montoNum).toFixed(2)),
            resumen: `Efectivo: ${formatoMoneda(montoNum)} (Entregado: ${formatoMoneda(entregadoNum)} | Vuelto: ${formatoMoneda(entregadoNum - montoNum)})`,
          });
        }
      } else if (p.tipo === 'tarjeta_credito') {
        const digitos = (p.numeroTarjeta || '').replace(/\D/g, '');
        const aut = (p.codigoAutorizacion || '').trim();

        if (!/^\d{4}$/.test(digitos)) {
          errP.numeroTarjeta = 'Ingrese exactamente los últimos 4 dígitos numéricos.';
          if (!primerErrorGlobal) {
            primerErrorGlobal = `Ingrese los últimos 4 dígitos numéricos de la tarjeta (Pago #${idx + 1}).`;
          }
        }
        if (!PLANES_CUOTAS[parseInt(p.cuotas, 10)]) {
          errP.cuotas = 'Seleccione un plan de cuotas válido (1, 3, 6 o 12).';
          if (!primerErrorGlobal) {
            primerErrorGlobal = `Seleccione un plan de cuotas válido en el Pago #${idx + 1}.`;
          }
        }
        if (!/^[A-Z0-9-]{3,20}$/.test(aut)) {
          errP.codigoAutorizacion = 'Mínimo 3 caracteres alfanuméricos (A-Z, 0-9, -).';
          if (!primerErrorGlobal) {
            primerErrorGlobal = `Ingrese un código de autorización válido de al menos 3 caracteres (Pago #${idx + 1}).`;
          }
        }

        if (Object.keys(errP).length === 0) {
          const calc = calcularPlanCuotas(montoNum, p.cuotas);
          totalInteresesFinanciacion = Number(
            (totalInteresesFinanciacion + calc.montoInteres).toFixed(2)
          );
          const infoPlanTxt = calc.tieneInteres
            ? `${calc.cuotasNum} cuotas de ${formatoMoneda(calc.valorCuota)} (Total Financiado: ${formatoMoneda(calc.totalFinanciado)} | Recargo ${calc.recargoPct}% — CFTEA: ${calc.cftea})`
            : `1 cuota de ${formatoMoneda(calc.valorCuota)} (Sin Interés — CFTEA: 0,00%)`;

          pagosFormateados.push({
            tipo: 'tarjeta_credito',
            monto: montoNum,
            numeroTarjeta: digitos,
            cuotas: calc.cuotasNum,
            recargoPct: calc.recargoPct,
            cftea: calc.cftea,
            montoInteres: calc.montoInteres,
            totalFinanciado: calc.totalFinanciado,
            valorCuotaMensual: calc.valorCuota,
            codigoAutorizacion: `${aut} (${infoPlanTxt})`,
            resumen: `Tarjeta Crédito (****-${digitos.slice(-4)}): Base ${formatoMoneda(montoNum)} — ${infoPlanTxt} — Aut: ${aut}`,
          });
        }
      } else if (p.tipo === 'transferencia') {
        const cbu = (p.cbuOrigen || '').trim();
        const comp = (p.comprobanteTransferencia || '').trim();

        const esCbuValido = /^\d{22}$/.test(cbu);
        const esAliasValido = /^[a-zA-Z0-9.-]{6,20}$/.test(cbu) && /[a-zA-Z]/.test(cbu);

        if (!cbu) {
          errP.cbuOrigen = 'El CBU o Alias es obligatorio.';
          if (!primerErrorGlobal) {
            primerErrorGlobal = `Ingrese el CBU (22 dígitos) o Alias bancario (Pago #${idx + 1}).`;
          }
        } else if (!esCbuValido && !esAliasValido) {
          errP.cbuOrigen = 'Debe ser un CBU de 22 dígitos o un Alias válido (6 a 20 caracteres).';
          if (!primerErrorGlobal) {
            primerErrorGlobal = `CBU/Alias inválido en Pago #${idx + 1}: ingrese 22 dígitos numéricos o un Alias de 6 a 20 caracteres.`;
          }
        }

        if (!/^[A-Z0-9/_-]{3,40}$/.test(comp)) {
          errP.comprobanteTransferencia = 'Mínimo 3 caracteres alfanuméricos.';
          if (!primerErrorGlobal) {
            primerErrorGlobal = `Ingrese un N° de comprobante de transferencia válido (mínimo 3 caracteres) en Pago #${idx + 1}.`;
          }
        }

        if (Object.keys(errP).length === 0) {
          pagosFormateados.push({
            tipo: 'transferencia',
            monto: montoNum,
            cbuOrigen: cbu,
            comprobanteTransferencia: comp,
            resumen: `Transferencia (${cbu}): ${formatoMoneda(montoNum)} — Comp: ${comp}`,
          });
        }
      }

      if (Object.keys(errP).length > 0) {
        nuevosErroresPagos[p.idTemp] = errP;
      }
    }

    setErroresPagos(nuevosErroresPagos);

    if (primerErrorGlobal || Object.keys(nuevosErroresPagos).length > 0) {
      return setErrorVenta(
        primerErrorGlobal || 'Revise los campos marcados en los medios de pago.'
      );
    }

    if (sumaPagos > totalCarrito + 0.01) {
      return setErrorVenta(
        `La suma de los pagos (${formatoMoneda(sumaPagos)}) supera el costo total a pagar (${formatoMoneda(totalCarrito)}). Reingrese los valores.`
      );
    }

    if (Math.abs(sumaPagos - totalCarrito) > 0.01) {
      return setErrorVenta(
        `La suma de los pagos (${formatoMoneda(sumaPagos)}) no coincide con el total de la venta (${formatoMoneda(totalCarrito)}). Reingrese los valores.`
      );
    }

    setModalConfirmarVenta({
      idSucursal: parseInt(idSucursal, 10),
      sucursalNombre: sucursalActual?.nombre || '',
      detalles: carrito,
      total: totalCarrito,
      totalInteresesFinanciacion,
      pagos: pagosFormateados,
    });
  };

  const ejecutarConfirmarVenta = async () => {
    if (!modalConfirmarVenta) return;
    const datos = modalConfirmarVenta;
    setModalConfirmarVenta(null);

    const payload = {
      idSucursal: datos.idSucursal,
      total: datos.total,
      detalles: datos.detalles.map((d) => ({
        idProducto: d.idProducto,
        cantidad: d.cantidad,
        precioUnitario: d.precioVenta,
      })),
      pagos: datos.pagos.map(({ resumen, ...resto }) => resto),
    };

    const res = await apiService.registrarVenta(payload);
    if (res && res.status === 'success') {
      setCarrito([]);
      setAvisoReingresoPagos('');
      setErroresCampoVenta({});
      setErroresPagos({});
      setPagos([
        {
          idTemp: Date.now(),
          tipo: 'efectivo',
          monto: '',
          montoEntregado: '',
          numeroTarjeta: '',
          cuotas: '1',
          codigoAutorizacion: '',
          cbuOrigen: '',
          comprobanteTransferencia: '',
        },
      ]);
      recargarDatosSucursal(idSucursal);
      setModalComprobanteVenta({
        venta: res.datos,
        comprobantesPago: res.comprobantesPago || [],
      });
    } else {
      alert(res?.mensaje || 'Error al registrar la venta.');
    }
  };

  // --- GESTIÓN DE DEVOLUCIONES ---
  const ventasConSaldoDevolucion = ventas.filter((v) => v.saldoDevolucionDisponible > 0);
  const ventaSeleccionadaDev =
    ventas.find((v) => String(v.idVenta) === String(idVentaDevolucion)) || null;

  const handleSeleccionarVentaDevolucion = (nuevoIdVenta) => {
    setIdVentaDevolucion(nuevoIdVenta);
    setErrorDevolucion('');
    setErroresCampoDev({});
    const v = ventas.find((item) => String(item.idVenta) === String(nuevoIdVenta));
    if (v) {
      const inicial = {};
      v.detalles.forEach((d) => {
        inicial[d.idDetalleVenta] = 0;
      });
      setCantidadesDevolver(inicial);
    } else {
      setCantidadesDevolver({});
    }
  };

  const handleIniciarDevolucionDesdeHistorial = (venta) => {
    setSubVista('devoluciones');
    handleSeleccionarVentaDevolucion(String(venta.idVenta));
  };

  const handleCantidadDevolverChange = (detalle, rawValor) => {
    const limpio = sanitizarEnteroPositivo(rawValor, 5);
    const num = limpio === '' ? 0 : parseInt(limpio, 10);
    setErrorDevolucion('');
    setErroresCampoDev((prev) => ({ ...prev, items: null }));

    if (num > detalle.cantidad) {
      setErrorDevolucion(
        `No puede devolver más de ${detalle.cantidad} u. de "${detalle.productoNombre}".`
      );
      setCantidadesDevolver((prev) => ({
        ...prev,
        [detalle.idDetalleVenta]: detalle.cantidad,
      }));
      return;
    }

    setCantidadesDevolver((prev) => ({
      ...prev,
      [detalle.idDetalleVenta]: Math.max(0, num),
    }));
  };

  const calcularMontoDevolucionSeleccionado = () => {
    if (!ventaSeleccionadaDev) return 0;
    return Number(
      ventaSeleccionadaDev.detalles
        .reduce((acc, d) => {
          const cant = parseInt(cantidadesDevolver[d.idDetalleVenta] || 0, 10);
          return acc + cant * d.precioUnitario;
        }, 0)
        .toFixed(2)
    );
  };

  const handleSolicitarDevolucion = (e) => {
    e.preventDefault();
    setErrorDevolucion('');
    const nuevosErrDev = {};

    if (!ventaSeleccionadaDev) {
      nuevosErrDev.venta = 'Debe seleccionar una venta registrada de origen.';
      setErroresCampoDev(nuevosErrDev);
      return setErrorDevolucion(nuevosErrDev.venta);
    }

    const detalleExcedido = ventaSeleccionadaDev.detalles.find((d) => {
      const cant = parseInt(cantidadesDevolver[d.idDetalleVenta] || 0, 10);
      return cant < 0 || cant > d.cantidad;
    });

    if (detalleExcedido) {
      nuevosErrDev.items = `Cantidad inválida para "${detalleExcedido.productoNombre}" (máx. ${detalleExcedido.cantidad} u.).`;
      setErroresCampoDev(nuevosErrDev);
      return setErrorDevolucion(nuevosErrDev.items);
    }

    const itemsSeleccionados = ventaSeleccionadaDev.detalles
      .map((d) => ({
        idDetalleVenta: d.idDetalleVenta,
        productoNombre: d.productoNombre,
        precioUnitario: d.precioUnitario,
        cantidad: parseInt(cantidadesDevolver[d.idDetalleVenta] || 0, 10),
      }))
      .filter((i) => i.cantidad > 0);

    if (itemsSeleccionados.length === 0) {
      nuevosErrDev.items = 'Indique al menos 1 unidad a devolver en los ítems de la venta.';
      setErroresCampoDev(nuevosErrDev);
      return setErrorDevolucion(nuevosErrDev.items);
    }

    const montoCalc = calcularMontoDevolucionSeleccionado();
    if (montoCalc <= 0) {
      nuevosErrDev.items = 'El monto calculado a devolver debe ser mayor a $0,00.';
      setErroresCampoDev(nuevosErrDev);
      return setErrorDevolucion(nuevosErrDev.items);
    }

    if (montoCalc - ventaSeleccionadaDev.saldoDevolucionDisponible > 0.01) {
      nuevosErrDev.items = `El monto calculado (${formatoMoneda(montoCalc)}) supera el saldo disponible para devolver (${formatoMoneda(ventaSeleccionadaDev.saldoDevolucionDisponible)}).`;
      setErroresCampoDev(nuevosErrDev);
      return setErrorDevolucion(nuevosErrDev.items);
    }

    const motivoLimpio = motivoDevolucion.trim();
    if (!motivoLimpio) {
      nuevosErrDev.motivo = 'El motivo de la devolución es obligatorio.';
      setErroresCampoDev(nuevosErrDev);
      return setErrorDevolucion(nuevosErrDev.motivo);
    }
    if (motivoLimpio.length < 5) {
      nuevosErrDev.motivo = 'Describa el motivo con mayor detalle (mínimo 5 caracteres).';
      setErroresCampoDev(nuevosErrDev);
      return setErrorDevolucion(nuevosErrDev.motivo);
    }
    if (!/[a-zA-ZáéíóúÁÉÍÓÚñÑüÜ]/.test(motivoLimpio)) {
      nuevosErrDev.motivo = 'El motivo debe contener texto descriptivo válido.';
      setErroresCampoDev(nuevosErrDev);
      return setErrorDevolucion(nuevosErrDev.motivo);
    }

    setErroresCampoDev({});
    setModalConfirmarDevolucion({
      idVenta: ventaSeleccionadaDev.idVenta,
      numeroComprobante: ventaSeleccionadaDev.numeroComprobante,
      sucursalNombre: ventaSeleccionadaDev.sucursalNombre,
      items: itemsSeleccionados,
      montoDevuelto: montoCalc,
      motivo: motivoLimpio,
      reingresarStock: reingresarStockDev,
    });
  };

  const ejecutarConfirmarDevolucion = async () => {
    if (!modalConfirmarDevolucion) return;
    const datos = modalConfirmarDevolucion;
    setModalConfirmarDevolucion(null);

    const res = await apiService.registrarDevolucion({
      idVenta: datos.idVenta,
      motivo: datos.motivo,
      montoDevuelto: datos.montoDevuelto,
      reingresarStock: datos.reingresarStock,
      items: datos.items.map((i) => ({
        idDetalleVenta: i.idDetalleVenta,
        cantidad: i.cantidad,
      })),
    });

    if (res && res.status === 'success') {
      alert(res.mensaje);
      setIdVentaDevolucion('');
      setCantidadesDevolver({});
      setMotivoDevolucion('');
      setErroresCampoDev({});
      recargarDatosSucursal(idSucursal);
    } else {
      alert(res?.mensaje || 'No se pudo registrar la devolución.');
    }
  };

  // --- FILTRADO DE HISTORIAL DE VENTAS ---
  const ventasFiltradas = ventas.filter((v) => {
    const tieneDev = Number(v.totalDevuelto || 0) > 0;
    const esDevTotal = tieneDev && Number(v.totalDevuelto) >= Number(v.total) - 0.01;
    const tipoDevVenta = !tieneDev ? 'ninguna' : esDevTotal ? 'total' : 'parcial';

    if (filtroTieneDev === 'si' && !tieneDev) return false;
    if (filtroTieneDev === 'no' && tieneDev) return false;

    if (filtroTipoDev !== 'todos' && tipoDevVenta !== filtroTipoDev) return false;

    if (filtroMetodoPago !== 'todos') {
      const tieneMetodo = (v.mediosPago || []).some((mp) => mp.tipo === filtroMetodoPago);
      if (!tieneMetodo) return false;
    }

    return true;
  });

  const sumaPagosActual = Number(
    pagos.reduce((acc, p) => acc + (parseFloat(p.monto) || 0), 0).toFixed(2)
  );
  const diferenciaPago = Number((totalCarrito - sumaPagosActual).toFixed(2));
  const yaExisteEfectivo = pagos.some((p) => p.tipo === 'efectivo');

  return (
    <div className="page" style={{ position: 'relative' }}>
      <h2 className="page-title">Ventas y Postventa</h2>

      {/* BARRA SUPERIOR: Sub-vistas estilo texto + Selector de Sucursal */}
      <section className="card">
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: '14px',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '18px', flexWrap: 'wrap' }}>
            <button
              type="button"
              onClick={() => setSubVista('nueva-venta')}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: subVista === 'nueva-venta' ? '2px solid currentColor' : '2px solid transparent',
                fontWeight: subVista === 'nueva-venta' ? 'bold' : 'normal',
                opacity: subVista === 'nueva-venta' ? 1 : 0.65,
                cursor: 'pointer',
                padding: '4px 2px',
                fontSize: '15px',
                color: 'inherit',
              }}
            >
              Nueva Venta (POS)
            </button>

            <span className="muted">|</span>

            <button
              type="button"
              onClick={() => setSubVista('historial')}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: subVista === 'historial' ? '2px solid currentColor' : '2px solid transparent',
                fontWeight: subVista === 'historial' ? 'bold' : 'normal',
                opacity: subVista === 'historial' ? 1 : 0.65,
                cursor: 'pointer',
                padding: '4px 2px',
                fontSize: '15px',
                color: 'inherit',
              }}
            >
              Historial de Ventas ({ventas.length})
            </button>

            <span className="muted">|</span>

            <button
              type="button"
              onClick={() => setSubVista('devoluciones')}
              style={{
                background: 'none',
                border: 'none',
                borderBottom: subVista === 'devoluciones' ? '2px solid currentColor' : '2px solid transparent',
                fontWeight: subVista === 'devoluciones' ? 'bold' : 'normal',
                opacity: subVista === 'devoluciones' ? 1 : 0.65,
                cursor: 'pointer',
                padding: '4px 2px',
                fontSize: '15px',
                color: 'inherit',
              }}
            >
              Devoluciones ({devoluciones.length})
            </button>
          </div>

          <div className="field-inline">
            <label htmlFor="sel-sucursal-ventas">Sucursal de Venta:</label>
            <select
              id="sel-sucursal-ventas"
              className="select"
              value={idSucursal}
              onChange={(e) => setIdSucursal(e.target.value)}
            >
              {sucursales.map((s) => (
                <option key={s.idEstablecimiento} value={s.idEstablecimiento}>
                  {s.codigo} — {s.nombre}
                </option>
              ))}
            </select>
          </div>
        </div>
      </section>

      {/* ===================================================================== */}
      {/* SUBVISTA 1: NUEVA VENTA (CARRITO + MEDIOS DE PAGO)                    */}
      {/* ===================================================================== */}
      {subVista === 'nueva-venta' && (
        <>
          <section className="card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '10px',
                marginBottom: '12px',
              }}
            >
              <h3 className="card-title" style={{ margin: 0 }}>
                1. Selección de Productos — {sucursalActual?.nombre || 'Sucursal'}
              </h3>
              <span className="muted" style={{ fontSize: '13px' }}>
                Productos con stock disponible en local: <strong>{productosDisponiblesPOS.length}</strong>
              </span>
            </div>

            <form onSubmit={handleAgregarAlCarrito} className="form-row" noValidate>
              <div className="grow">
                <input
                  className="input"
                  list="lista-stock-sucursal-pos"
                  maxLength={120}
                  placeholder={
                    productosDisponiblesPOS.length === 0
                      ? 'Esta sucursal no tiene stock disponible para vender...'
                      : 'Escriba nombre/código o despliegue para elegir producto disponible...'
                  }
                  value={busquedaProducto}
                  onChange={handleBusquedaProductoChange}
                  style={{
                    width: '100%',
                    boxSizing: 'border-box',
                    borderColor: erroresCampoVenta.producto ? '#cf1322' : undefined,
                  }}
                />
                <datalist id="lista-stock-sucursal-pos">
                  {productosDisponiblesPOS.map((item) => (
                    <option key={item.idProducto} value={formatearOpcionProducto(item)} />
                  ))}
                </datalist>
                {erroresCampoVenta.producto && (
                  <div style={{ color: '#cf1322', fontSize: '12px', marginTop: '4px' }}>
                    {erroresCampoVenta.producto}
                  </div>
                )}
              </div>

              <div>
                <input
                  className="input narrow"
                  type="text"
                  inputMode="numeric"
                  maxLength={5}
                  placeholder="Cant."
                  value={cantidadAgregar}
                  disabled={disponibleRestanteSeleccionado === 0}
                  onKeyDown={(e) => bloquearTeclasInvalidasNumero(e, false)}
                  onChange={handleCantidadAgregarChange}
                  style={{
                    borderColor: erroresCampoVenta.cantidad ? '#cf1322' : undefined,
                  }}
                />
                {erroresCampoVenta.cantidad && (
                  <div style={{ color: '#cf1322', fontSize: '12px', marginTop: '4px' }}>
                    {erroresCampoVenta.cantidad}
                  </div>
                )}
              </div>

              <button
                type="submit"
                className="btn btn-primary"
                disabled={disponibleRestanteSeleccionado === 0}
              >
                + Agregar Ítem
              </button>
            </form>

            {itemStockSeleccionado && (
              <div className="muted" style={{ fontSize: '12px', marginTop: '6px' }}>
                Unidades disponibles para agregar de <strong>{itemStockSeleccionado.nombre}</strong>:{' '}
                <strong>{disponibleRestanteSeleccionado} u.</strong>
              </div>
            )}

            <h4 className="card-subtitle">Detalle de la Venta</h4>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>Código</th>
                    <th>Producto</th>
                    <th className="right">Stock Local</th>
                    <th className="right">Precio Unit.</th>
                    <th className="right">Cantidad</th>
                    <th className="right">Subtotal</th>
                    <th className="right">Quitar</th>
                  </tr>
                </thead>
                <tbody>
                  {carrito.length === 0 ? (
                    <tr>
                      <td colSpan="7" className="empty">
                        No hay productos agregados a la venta actual.
                      </td>
                    </tr>
                  ) : (
                    carrito.map((item) => (
                      <tr key={item.idProducto}>
                        <td>{item.codigoBarras}</td>
                        <td className="strong">{item.nombre}</td>
                        <td className="right">{item.stockDisponible} u.</td>
                        <td className="right">{formatoMoneda(item.precioVenta)}</td>
                        <td className="right">
                          <input
                            type="text"
                            inputMode="numeric"
                            maxLength={5}
                            className="input narrow"
                            style={{
                              width: '72px',
                              textAlign: 'right',
                              padding: '4px 6px',
                              borderColor: !item.cantidad || item.cantidad <= 0 ? '#cf1322' : undefined,
                            }}
                            value={item.cantidad || ''}
                            onKeyDown={(e) => bloquearTeclasInvalidasNumero(e, false)}
                            onChange={(e) =>
                              handleActualizarCantidadCarrito(item.idProducto, e.target.value)
                            }
                            onBlur={() => handleNormalizarCantidadCarritoBlur(item.idProducto)}
                          />
                        </td>
                        <td className="right strong">
                          {formatoMoneda(item.cantidad * item.precioVenta)}
                        </td>
                        <td className="right">
                          <button
                            type="button"
                            className="btn btn-danger btn-sm"
                            onClick={() => handleQuitarDelCarrito(item.idProducto)}
                          >
                            Quitar
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <div
              style={{
                display: 'flex',
                justifyContent: 'flex-end',
                alignItems: 'center',
                marginTop: '14px',
                gap: '16px',
              }}
            >
              <span className="muted" style={{ fontSize: '15px' }}>Total a Cobrar:</span>
              <span style={{ fontSize: '22px', fontWeight: 700 }}>
                {formatoMoneda(totalCarrito)}
              </span>
            </div>
          </section>

          {/* SECCIÓN 2: MEDIOS DE PAGO (HASTA 3, EFECTIVO 1 VEZ) */}
          <section className="card">
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                marginBottom: '12px',
              }}
            >
              <div>
                <h3 className="card-title" style={{ margin: 0 }}>
                  2. Medios de Pago ({pagos.length}/3)
                </h3>
                <p className="muted" style={{ margin: '4px 0 0 0', fontSize: '13px' }}>
                  Puede cobrar mediante un medio único o combinar hasta 3 medios de pago (Efectivo máximo 1 vez).
                </p>
              </div>

              <button
                type="button"
                className="btn btn-outline btn-sm"
                disabled={pagos.length >= 3 || totalCarrito <= 0}
                onClick={handleAgregarMedioPago}
              >
                + Combinar otro Medio de Pago (Máx. 3)
              </button>
            </div>

            {avisoReingresoPagos && (
              <div
                style={{
                  padding: '8px 12px',
                  marginBottom: '12px',
                  borderRadius: '6px',
                  backgroundColor: '#fef3c7',
                  color: '#92400e',
                  border: '1px solid #f59e0b',
                  fontSize: '13px',
                  fontWeight: 600,
                }}
              >
                {avisoReingresoPagos}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
              {pagos.map((p, idx) => {
                const montoNum = parseFloat(p.monto) || 0;
                const entregadoNum =
                  p.montoEntregado !== '' ? parseFloat(p.montoEntregado) || 0 : montoNum;
                const vueltoCalc = Math.max(0, Number((entregadoNum - montoNum).toFixed(2)));
                const detalleCuotas =
                  p.tipo === 'tarjeta_credito' ? calcularPlanCuotas(p.monto, p.cuotas) : null;
                const errPagoActual = erroresPagos[p.idTemp] || {};

                return (
                  <div
                    key={p.idTemp}
                    style={{
                      padding: '12px 14px',
                      border: '1px solid rgba(128, 128, 128, 0.25)',
                      borderRadius: '6px',
                    }}
                  >
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '10px',
                      }}
                    >
                      <strong className="strong">Medio de Pago #{idx + 1}</strong>
                      {pagos.length > 1 && (
                        <button
                          type="button"
                          className="btn btn-danger btn-sm"
                          onClick={() => handleQuitarMedioPago(p.idTemp)}
                        >
                          Eliminar Pago
                        </button>
                      )}
                    </div>

                    <div className="form-grid">
                      <div>
                        <label className="muted" style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                          Medio de Pago
                        </label>
                        <select
                          className="select"
                          style={{ width: '100%' }}
                          value={p.tipo}
                          onChange={(e) => handleCambiarPago(p.idTemp, 'tipo', e.target.value)}
                        >
                          <option
                            value="efectivo"
                            disabled={yaExisteEfectivo && p.tipo !== 'efectivo'}
                          >
                            Efectivo {yaExisteEfectivo && p.tipo !== 'efectivo' ? '(Ya seleccionado)' : ''}
                          </option>
                          <option value="tarjeta_credito">Tarjeta de Crédito</option>
                          <option value="transferencia">Transferencia Bancaria</option>
                        </select>
                      </div>

                      <div>
                        <label className="muted" style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                          Importe Base a Cobrar ($)
                        </label>
                        <input
                          className="input"
                          type="text"
                          inputMode="decimal"
                          maxLength={12}
                          placeholder="0.00"
                          value={p.monto}
                          disabled={pagos.length === 1}
                          onKeyDown={(e) => bloquearTeclasInvalidasNumero(e, true)}
                          onChange={(e) => handleCambiarPago(p.idTemp, 'monto', e.target.value)}
                          style={{
                            borderColor: errPagoActual.monto ? '#cf1322' : undefined,
                          }}
                        />
                        {errPagoActual.monto && (
                          <div style={{ color: '#cf1322', fontSize: '12px', marginTop: '4px' }}>
                            {errPagoActual.monto}
                          </div>
                        )}
                      </div>

                      {/* CAMPOS ESPECÍFICOS: EFECTIVO */}
                      {p.tipo === 'efectivo' && (
                        <>
                          <div>
                            <label className="muted" style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                              Monto Entregado por Cliente ($)
                            </label>
                            <input
                              className="input"
                              type="text"
                              inputMode="decimal"
                              maxLength={12}
                              placeholder={p.monto || 'Igual al importe'}
                              value={p.montoEntregado}
                              onKeyDown={(e) => bloquearTeclasInvalidasNumero(e, true)}
                              onChange={(e) =>
                                handleCambiarPago(p.idTemp, 'montoEntregado', e.target.value)
                              }
                              style={{
                                borderColor: errPagoActual.montoEntregado ? '#cf1322' : undefined,
                              }}
                            />
                            {errPagoActual.montoEntregado && (
                              <div style={{ color: '#cf1322', fontSize: '12px', marginTop: '4px' }}>
                                {errPagoActual.montoEntregado}
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="muted" style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                              Vuelto Calculado
                            </label>
                            <div
                              style={{
                                padding: '8px 10px',
                                fontWeight: 'bold',
                                fontSize: '15px',
                              }}
                            >
                              {formatoMoneda(vueltoCalc)}
                            </div>
                          </div>
                        </>
                      )}

                      {/* CAMPOS ESPECÍFICOS: TARJETA DE CRÉDITO */}
                      {p.tipo === 'tarjeta_credito' && (
                        <>
                          <div>
                            <label className="muted" style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                              N° Tarjeta (Últimos 4 dígitos)
                            </label>
                            <input
                              className="input"
                              type="text"
                              inputMode="numeric"
                              maxLength={4}
                              placeholder="Ej: 4532"
                              value={p.numeroTarjeta}
                              onKeyDown={(e) => bloquearTeclasInvalidasNumero(e, false)}
                              onChange={(e) =>
                                handleCambiarPago(p.idTemp, 'numeroTarjeta', e.target.value)
                              }
                              style={{
                                borderColor: errPagoActual.numeroTarjeta ? '#cf1322' : undefined,
                              }}
                            />
                            {errPagoActual.numeroTarjeta && (
                              <div style={{ color: '#cf1322', fontSize: '12px', marginTop: '4px' }}>
                                {errPagoActual.numeroTarjeta}
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="muted" style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                              Plan de Cuotas (1 sin interés / 3, 6, 12 con interés)
                            </label>
                            <select
                              className="select"
                              style={{
                                width: '100%',
                                borderColor: errPagoActual.cuotas ? '#cf1322' : undefined,
                              }}
                              value={p.cuotas}
                              onChange={(e) => handleCambiarPago(p.idTemp, 'cuotas', e.target.value)}
                            >
                              {[1, 3, 6, 12].map((c) => {
                                const info = calcularPlanCuotas(p.monto, c);
                                return (
                                  <option key={c} value={String(c)}>
                                    {c === 1
                                      ? `1 cuota de ${formatoMoneda(info.valorCuota)} — Sin interés (CFTEA: 0,00%)`
                                      : `${c} cuotas de ${formatoMoneda(info.valorCuota)} — Total: ${formatoMoneda(info.totalFinanciado)} (CFTEA: ${info.cftea})`}
                                  </option>
                                );
                              })}
                            </select>
                            {errPagoActual.cuotas && (
                              <div style={{ color: '#cf1322', fontSize: '12px', marginTop: '4px' }}>
                                {errPagoActual.cuotas}
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="muted" style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                              Código Autorización POS
                            </label>
                            <input
                              className="input"
                              type="text"
                              maxLength={20}
                              placeholder="Ej: AUT-9941"
                              value={p.codigoAutorizacion}
                              onChange={(e) =>
                                handleCambiarPago(p.idTemp, 'codigoAutorizacion', e.target.value)
                              }
                              style={{
                                borderColor: errPagoActual.codigoAutorizacion ? '#cf1322' : undefined,
                              }}
                            />
                            {errPagoActual.codigoAutorizacion && (
                              <div style={{ color: '#cf1322', fontSize: '12px', marginTop: '4px' }}>
                                {errPagoActual.codigoAutorizacion}
                              </div>
                            )}
                          </div>
                        </>
                      )}

                      {/* CAMPOS ESPECÍFICOS: TRANSFERENCIA */}
                      {p.tipo === 'transferencia' && (
                        <>
                          <div>
                            <label className="muted" style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                              CBU (22 dígitos) / Alias Origen
                            </label>
                            <input
                              className="input"
                              type="text"
                              maxLength={22}
                              placeholder="Ej: cliente.mp o CBU 22 dígitos"
                              value={p.cbuOrigen}
                              onChange={(e) =>
                                handleCambiarPago(p.idTemp, 'cbuOrigen', e.target.value)
                              }
                              style={{
                                borderColor: errPagoActual.cbuOrigen ? '#cf1322' : undefined,
                              }}
                            />
                            {errPagoActual.cbuOrigen && (
                              <div style={{ color: '#cf1322', fontSize: '12px', marginTop: '4px' }}>
                                {errPagoActual.cbuOrigen}
                              </div>
                            )}
                          </div>

                          <div>
                            <label className="muted" style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                              N° Comprobante Transferencia
                            </label>
                            <input
                              className="input"
                              type="text"
                              maxLength={40}
                              placeholder="Ej: TRF-0088412"
                              value={p.comprobanteTransferencia}
                              onChange={(e) =>
                                handleCambiarPago(
                                  p.idTemp,
                                  'comprobanteTransferencia',
                                  e.target.value
                                )
                              }
                              style={{
                                borderColor: errPagoActual.comprobanteTransferencia
                                  ? '#cf1322'
                                  : undefined,
                              }}
                            />
                            {errPagoActual.comprobanteTransferencia && (
                              <div style={{ color: '#cf1322', fontSize: '12px', marginTop: '4px' }}>
                                {errPagoActual.comprobanteTransferencia}
                              </div>
                            )}
                          </div>
                        </>
                      )}
                    </div>

                    {/* Resumen estilo tabla de cuotas */}
                    {detalleCuotas && detalleCuotas.capital > 0 && (
                      <div
                        style={{
                          marginTop: '10px',
                          padding: '10px 12px',
                          borderRadius: '6px',
                          backgroundColor: 'rgba(24, 144, 255, 0.06)',
                          border: '1px solid rgba(24, 144, 255, 0.2)',
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          flexWrap: 'wrap',
                          gap: '10px',
                          fontSize: '13px',
                        }}
                      >
                        <div>
                          <strong style={{ fontSize: '14px' }}>
                            {detalleCuotas.cuotasNum === 1
                              ? `1 cuota de ${formatoMoneda(detalleCuotas.valorCuota)}`
                              : `${detalleCuotas.cuotasNum} cuotas de ${formatoMoneda(detalleCuotas.valorCuota)}`}
                          </strong>
                          <span className="muted" style={{ marginLeft: '8px' }}>
                            (Capital base: {formatoMoneda(detalleCuotas.capital)})
                          </span>
                        </div>

                        <div style={{ textAlign: 'right' }}>
                          {detalleCuotas.tieneInteres ? (
                            <>
                              <div>
                                Total Financiado:{' '}
                                <strong>{formatoMoneda(detalleCuotas.totalFinanciado)}</strong>{' '}
                                <span className="muted">
                                  (+{detalleCuotas.recargoPct}% / {formatoMoneda(detalleCuotas.montoInteres)})
                                </span>
                              </div>
                              <div className="muted" style={{ fontSize: '12px' }}>
                                CFTEA: <strong>{detalleCuotas.cftea}</strong>
                              </div>
                            </>
                          ) : (
                            <div className="muted" style={{ fontSize: '12px' }}>
                              Sin interés — CFTEA: <strong>0,00%</strong>
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {errorVenta && (
              <div style={{ color: '#cf1322', fontSize: '13px', fontWeight: 'bold', marginTop: '12px' }}>
                {errorVenta}
              </div>
            )}

            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                flexWrap: 'wrap',
                gap: '12px',
                marginTop: '16px',
                paddingTop: '12px',
                borderTop: '1px solid rgba(128, 128, 128, 0.2)',
              }}
            >
              <div style={{ fontSize: '14px' }}>
                <span className="muted">Total Venta:</span>{' '}
                <strong>{formatoMoneda(totalCarrito)}</strong> |{' '}
                <span className="muted">Suma Pagos:</span>{' '}
                <strong>{formatoMoneda(sumaPagosActual)}</strong>
                {Math.abs(diferenciaPago) > 0.01 && (
                  <span style={{ color: '#cf1322', marginLeft: '10px', fontWeight: 'bold' }}>
                    (Diferencia: {formatoMoneda(diferenciaPago)})
                  </span>
                )}
              </div>

              <button
                type="button"
                className="btn btn-primary"
                onClick={handleSolicitarConfirmarVenta}
                disabled={carrito.length === 0 || Math.abs(diferenciaPago) > 0.01}
              >
                Confirmar y Emitir Comprobante
              </button>
            </div>
          </section>
        </>
      )}

      {/* ===================================================================== */}
      {/* SUBVISTA 2: HISTORIAL DE VENTAS DE LA SUCURSAL (CON FILTROS)          */}
      {/* ===================================================================== */}
      {subVista === 'historial' && (
        <section className="card">
          <div
            style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              flexWrap: 'wrap',
              gap: '12px',
              marginBottom: '14px',
            }}
          >
            <h3 className="card-title" style={{ margin: 0 }}>
              Ventas Registradas — {sucursalActual?.nombre || 'Sucursal'} ({ventasFiltradas.length})
            </h3>

            {/* BARRA DE FILTROS */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '12px', alignItems: 'center' }}>
              <div className="field-inline">
                <label htmlFor="filtro-tiene-dev">Devolución:</label>
                <select
                  id="filtro-tiene-dev"
                  className="select"
                  value={filtroTieneDev}
                  onChange={(e) => {
                    const val = e.target.value;
                    setFiltroTieneDev(val);
                    if (val === 'no') setFiltroTipoDev('todos');
                  }}
                >
                  <option value="todos">Todas</option>
                  <option value="si">Sí (Con devolución)</option>
                  <option value="no">No (Sin devolución)</option>
                </select>
              </div>

              <div className="field-inline">
                <label htmlFor="filtro-tipo-dev">Tipo Devolución:</label>
                <select
                  id="filtro-tipo-dev"
                  className="select"
                  value={filtroTipoDev}
                  onChange={(e) => setFiltroTipoDev(e.target.value)}
                >
                  <option value="todos">Todos los tipos</option>
                  <option value="parcial">Parcial</option>
                  <option value="total">Total</option>
                  <option value="ninguna">Sin devolución (-)</option>
                </select>
              </div>

              <div className="field-inline">
                <label htmlFor="filtro-metodo-pago">Método de Pago:</label>
                <select
                  id="filtro-metodo-pago"
                  className="select"
                  value={filtroMetodoPago}
                  onChange={(e) => setFiltroMetodoPago(e.target.value)}
                >
                  <option value="todos">Todos los métodos</option>
                  <option value="efectivo">Efectivo</option>
                  <option value="tarjeta_credito">Tarjeta de Crédito</option>
                  <option value="transferencia">Transferencia Bancaria</option>
                </select>
              </div>

              {(filtroTieneDev !== 'todos' ||
                filtroTipoDev !== 'todos' ||
                filtroMetodoPago !== 'todos') && (
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => {
                    setFiltroTieneDev('todos');
                    setFiltroTipoDev('todos');
                    setFiltroMetodoPago('todos');
                  }}
                >
                  Limpiar Filtros
                </button>
              )}
            </div>
          </div>

          <div className="table-wrap">
            <table className="table">
              <thead>
                <tr>
                  <th>Comprobante</th>
                  <th>Fecha y Hora</th>
                  <th>Medios de Pago</th>
                  <th className="right">Total Venta</th>
                  <th>Devolución</th>
                  <th>Tipo</th>
                  <th className="right">Monto Devuelto</th>
                  <th className="right">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {ventasFiltradas.length === 0 ? (
                  <tr>
                    <td colSpan="8" className="empty">
                      No hay ventas que coincidan con los filtros seleccionados en esta sucursal.
                    </td>
                  </tr>
                ) : (
                  ventasFiltradas.map((v) => {
                    const estaExpandida = ventaExpandidaId === v.idVenta;
                    const tieneDev = Number(v.totalDevuelto || 0) > 0;
                    const esDevTotal =
                      tieneDev && Number(v.totalDevuelto) >= Number(v.total) - 0.01;

                    return (
                      <React.Fragment key={v.idVenta}>
                        <tr>
                          <td className="strong">{v.numeroComprobante}</td>
                          <td>{v.fechaHora}</td>
                          <td>
                            {v.mediosPago.map((mp) => mp.detalle).join(' + ') || '-'}
                          </td>
                          <td className="right strong">{formatoMoneda(v.total)}</td>
                          <td>
                            {tieneDev ? (
                              <span className="tag tag-danger">Sí</span>
                            ) : (
                              <span className="tag tag-success">No</span>
                            )}
                          </td>
                          <td>
                            {!tieneDev ? (
                              <span className="muted">-</span>
                            ) : esDevTotal ? (
                              <span className="tag tag-danger">Total</span>
                            ) : (
                              <span
                                className="tag"
                                style={{ backgroundColor: '#fef3c7', color: '#92400e' }}
                              >
                                Parcial
                              </span>
                            )}
                          </td>
                          <td className="right">
                            {tieneDev ? (
                              <span className="tag tag-danger">
                                -{formatoMoneda(v.totalDevuelto)}
                              </span>
                            ) : (
                              <span className="muted">$ 0,00</span>
                            )}
                          </td>
                          <td className="right">
                            <div
                              style={{
                                display: 'flex',
                                flexDirection: 'column',
                                alignItems: 'stretch',
                                gap: '6px',
                                minWidth: '105px',
                              }}
                            >
                              <button
                                type="button"
                                className="btn btn-sm"
                                onClick={() =>
                                  setVentaExpandidaId(estaExpandida ? null : v.idVenta)
                                }
                              >
                                {estaExpandida ? 'Ocultar Detalle' : 'Ver Detalle'}
                              </button>
                              {v.saldoDevolucionDisponible > 0 && (
                                <button
                                  type="button"
                                  className="btn btn-danger btn-sm"
                                  onClick={() => handleIniciarDevolucionDesdeHistorial(v)}
                                >
                                  Devolver
                                </button>
                              )}
                            </div>
                          </td>
                        </tr>

                        {estaExpandida && (
                          <tr>
                            <td colSpan="8" style={{ backgroundColor: 'rgba(128, 128, 128, 0.06)' }}>
                              <div style={{ padding: '8px 12px' }}>
                                <strong>Productos Vendidos:</strong>
                                <table className="table" style={{ marginTop: '6px', fontSize: '13px' }}>
                                  <thead>
                                    <tr>
                                      <th>Código</th>
                                      <th>Producto</th>
                                      <th className="right">Cantidad</th>
                                      <th className="right">Precio Unit.</th>
                                      <th className="right">Subtotal</th>
                                    </tr>
                                  </thead>
                                  <tbody>
                                    {v.detalles.map((d) => (
                                      <tr key={d.idDetalleVenta}>
                                        <td>{d.codigoBarras}</td>
                                        <td>{d.productoNombre}</td>
                                        <td className="right">{d.cantidad} u.</td>
                                        <td className="right">{formatoMoneda(d.precioUnitario)}</td>
                                        <td className="right">{formatoMoneda(d.subtotal)}</td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>

                                {v.devoluciones.length > 0 && (
                                  <div style={{ marginTop: '10px', fontSize: '13px' }}>
                                    <strong>Devoluciones asociadas:</strong>
                                    <ul style={{ margin: '4px 0 0 18px' }}>
                                      {v.devoluciones.map((dev) => (
                                        <li key={dev.idDevolucion}>
                                          [{dev.fechaHora}] {formatoMoneda(dev.montoDevuelto)} — Motivo: {dev.motivo}
                                        </li>
                                      ))}
                                    </ul>
                                  </div>
                                )}
                              </div>
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* ===================================================================== */}
      {/* SUBVISTA 3: GESTIÓN DE DEVOLUCIONES (OBLIGATORIAMENTE SOBRE VENTA)    */}
      {/* ===================================================================== */}
      {subVista === 'devoluciones' && (
        <>
          <section className="card">
            <h3 className="card-title">
              Registrar Devolución — {sucursalActual?.nombre || 'Sucursal'}
            </h3>
            <p className="muted" style={{ fontSize: '13px', marginTop: 0 }}>
              Toda devolución debe asociarse obligatoriamente a una venta registrada previamente en esta sucursal.
            </p>

            <form onSubmit={handleSolicitarDevolucion} noValidate>
              <div className="form-row">
                <div className="grow">
                  <label className="muted" style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                    Venta de Origen (Comprobante)
                  </label>
                  <select
                    className="select"
                    style={{
                      width: '100%',
                      borderColor: erroresCampoDev.venta ? '#cf1322' : undefined,
                    }}
                    value={idVentaDevolucion}
                    onChange={(e) => handleSeleccionarVentaDevolucion(e.target.value)}
                  >
                    <option value="">-- Seleccione una venta registrada --</option>
                    {ventasConSaldoDevolucion.map((v) => (
                      <option key={v.idVenta} value={v.idVenta}>
                        {v.numeroComprobante} ({v.fechaHora}) — Total: {formatoMoneda(v.total)} | Saldo devolución: {formatoMoneda(v.saldoDevolucionDisponible)}
                      </option>
                    ))}
                  </select>
                  {erroresCampoDev.venta && (
                    <div style={{ color: '#cf1322', fontSize: '12px', marginTop: '4px' }}>
                      {erroresCampoDev.venta}
                    </div>
                  )}
                </div>
              </div>

              {ventaSeleccionadaDev && (
                <div style={{ marginTop: '14px' }}>
                  <h4 className="card-subtitle">
                    Seleccione las unidades a devolver de {ventaSeleccionadaDev.numeroComprobante}
                  </h4>
                  <div className="table-wrap">
                    <table className="table">
                      <thead>
                        <tr>
                          <th>Producto</th>
                          <th className="right">Cant. Vendida</th>
                          <th className="right">Precio Unit.</th>
                          <th className="right">Cant. a Devolver</th>
                          <th className="right">Subtotal Devuelto</th>
                        </tr>
                      </thead>
                      <tbody>
                        {ventaSeleccionadaDev.detalles.map((d) => {
                          const cantDev = parseInt(cantidadesDevolver[d.idDetalleVenta] || 0, 10);
                          return (
                            <tr key={d.idDetalleVenta}>
                              <td className="strong">{d.productoNombre}</td>
                              <td className="right">{d.cantidad} u.</td>
                              <td className="right">{formatoMoneda(d.precioUnitario)}</td>
                              <td className="right">
                                <input
                                  type="text"
                                  inputMode="numeric"
                                  maxLength={5}
                                  className="input narrow"
                                  style={{
                                    width: '75px',
                                    textAlign: 'right',
                                    padding: '4px 6px',
                                    borderColor: erroresCampoDev.items ? '#cf1322' : undefined,
                                  }}
                                  value={cantidadesDevolver[d.idDetalleVenta] ?? 0}
                                  onKeyDown={(e) => bloquearTeclasInvalidasNumero(e, false)}
                                  onChange={(e) => handleCantidadDevolverChange(d, e.target.value)}
                                />
                              </td>
                              <td className="right strong">
                                {formatoMoneda(cantDev * d.precioUnitario)}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                  {erroresCampoDev.items && (
                    <div style={{ color: '#cf1322', fontSize: '12px', marginTop: '6px' }}>
                      {erroresCampoDev.items}
                    </div>
                  )}

                  <div className="form-row" style={{ marginTop: '14px', alignItems: 'flex-end' }}>
                    <div className="grow">
                      <label className="muted" style={{ fontSize: '12px', display: 'block', marginBottom: '4px' }}>
                        Motivo de la Devolución ({motivoDevolucion.length}/200)
                      </label>
                      <input
                        className="input"
                        maxLength={200}
                        style={{
                          width: '100%',
                          boxSizing: 'border-box',
                          borderColor: erroresCampoDev.motivo ? '#cf1322' : undefined,
                        }}
                        placeholder="Ej: Producto con falla de fábrica / Cambio solicitado por cliente..."
                        value={motivoDevolucion}
                        onChange={(e) => {
                          setMotivoDevolucion(sanitizarMotivoDevolucion(e.target.value));
                          setErrorDevolucion('');
                          setErroresCampoDev((prev) => ({ ...prev, motivo: null }));
                        }}
                      />
                      {erroresCampoDev.motivo && (
                        <div style={{ color: '#cf1322', fontSize: '12px', marginTop: '4px' }}>
                          {erroresCampoDev.motivo}
                        </div>
                      )}
                    </div>

                    <label className="field-inline" style={{ paddingBottom: '8px' }}>
                      <input
                        type="checkbox"
                        checked={reingresarStockDev}
                        onChange={(e) => setReingresarStockDev(e.target.checked)}
                      />
                      Reingresar unidades al stock de la sucursal
                    </label>
                  </div>

                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginTop: '14px',
                    }}
                  >
                    <div>
                      <span className="muted">Monto Total a Reintegrar:</span>{' '}
                      <strong style={{ fontSize: '18px' }}>
                        {formatoMoneda(calcularMontoDevolucionSeleccionado())}
                      </strong>
                    </div>

                    <button type="submit" className="btn btn-primary">
                      Registrar Devolución
                    </button>
                  </div>
                </div>
              )}

              {errorDevolucion && (
                <div style={{ color: '#cf1322', fontSize: '13px', fontWeight: 'bold', marginTop: '10px' }}>
                  {errorDevolucion}
                </div>
              )}
            </form>
          </section>

          <section className="card">
            <h3 className="card-title">
              Historial de Devoluciones — {sucursalActual?.nombre || 'Sucursal'}
            </h3>
            <div className="table-wrap">
              <table className="table">
                <thead>
                  <tr>
                    <th>ID</th>
                    <th>Fecha y Hora</th>
                    <th>Comprobante Venta Origen</th>
                    <th>Motivo</th>
                    <th className="right">Monto Devuelto</th>
                  </tr>
                </thead>
                <tbody>
                  {devoluciones.length === 0 ? (
                    <tr>
                      <td colSpan="5" className="empty">
                        No hay devoluciones registradas en esta sucursal.
                      </td>
                    </tr>
                  ) : (
                    devoluciones.map((dev) => (
                      <tr key={dev.idDevolucion}>
                        <td className="muted">#{dev.idDevolucion}</td>
                        <td>{dev.fechaHora}</td>
                        <td className="strong">{dev.numeroComprobante}</td>
                        <td>{dev.motivo}</td>
                        <td className="right strong">{formatoMoneda(dev.montoDevuelto)}</td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* ===================================================================== */}
      {/* MODAL 1: CONFIRMAR REGISTRO DE VENTA                                  */}
      {/* ===================================================================== */}
      {modalConfirmarVenta && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            className="card"
            style={{ maxWidth: '540px', width: '92%', margin: 0, borderTop: '5px solid #1890ff' }}
          >
            <h3 className="card-title" style={{ textAlign: 'center' }}>
              Confirmar Venta en {modalConfirmarVenta.sucursalNombre}
            </h3>

            <div
              style={{
                margin: '12px 0',
                padding: '10px 14px',
                backgroundColor: 'rgba(24, 144, 255, 0.06)',
                border: '1px solid rgba(24, 144, 255, 0.25)',
                borderRadius: '6px',
                fontSize: '13px',
              }}
            >
              <strong>Ítems a descontar de stock:</strong>
              <ul style={{ margin: '6px 0 10px 18px' }}>
                {modalConfirmarVenta.detalles.map((d) => (
                  <li key={d.idProducto}>
                    {d.cantidad}× <strong>{d.nombre}</strong> — {formatoMoneda(d.cantidad * d.precioVenta)}
                  </li>
                ))}
              </ul>

              <strong>Medios de Pago:</strong>
              <ul style={{ margin: '6px 0 0 18px' }}>
                {modalConfirmarVenta.pagos.map((p, i) => (
                  <li key={i}>{p.resumen}</li>
                ))}
              </ul>
            </div>

            <div style={{ textAlign: 'center', fontSize: '17px', fontWeight: 'bold' }}>
              Total Venta: {formatoMoneda(modalConfirmarVenta.total)}
              {modalConfirmarVenta.totalInteresesFinanciacion > 0 && (
                <div style={{ fontSize: '13px', fontWeight: 'normal', marginTop: '4px' }}>
                  + Intereses financiación: {formatoMoneda(modalConfirmarVenta.totalInteresesFinanciacion)} | Total Financiado:{' '}
                  <strong>
                    {formatoMoneda(
                      modalConfirmarVenta.total + modalConfirmarVenta.totalInteresesFinanciacion
                    )}
                  </strong>
                </div>
              )}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '20px' }}>
              <button type="button" className="btn" onClick={() => setModalConfirmarVenta(null)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-primary" onClick={ejecutarConfirmarVenta}>
                Confirmar Venta
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 2: COMPROBANTE DE VENTA EMITIDO                                 */}
      {/* ===================================================================== */}
      {modalComprobanteVenta && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            className="card"
            style={{ maxWidth: '520px', width: '92%', margin: 0, borderTop: '5px solid #52c41a' }}
          >
            <h3 className="card-title" style={{ textAlign: 'center', color: '#237804' }}>
              Comprobante Emitido: {modalComprobanteVenta.venta.numeroComprobante}
            </h3>
            <p className="muted" style={{ textAlign: 'center', margin: '4px 0 12px 0' }}>
              {modalComprobanteVenta.venta.sucursalNombre} — {modalComprobanteVenta.venta.fechaHora}
            </p>

            <div
              style={{
                padding: '12px',
                backgroundColor: 'rgba(82, 196, 26, 0.08)',
                border: '1px solid rgba(82, 196, 26, 0.3)',
                borderRadius: '6px',
                fontSize: '13px',
                lineHeight: '1.6',
              }}
            >
              <div>
                <strong>Detalle:</strong>
              </div>
              {modalComprobanteVenta.venta.detalles.map((d) => (
                <div key={d.idDetalleVenta}>
                  • {d.cantidad}× {d.productoNombre}: {formatoMoneda(d.subtotal)}
                </div>
              ))}
              <div style={{ marginTop: '8px' }}>
                <strong>Cobro procesado:</strong>
              </div>
              {modalComprobanteVenta.comprobantesPago.map((txt, idx) => (
                <div key={idx}>{txt}</div>
              ))}
              <div style={{ marginTop: '10px', fontSize: '16px', fontWeight: 'bold' }}>
                TOTAL VENTA: {formatoMoneda(modalComprobanteVenta.venta.total)}
              </div>
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', marginTop: '18px' }}>
              <button
                type="button"
                className="btn btn-primary"
                style={{ backgroundColor: '#52c41a', borderColor: '#52c41a' }}
                onClick={() => setModalComprobanteVenta(null)}
              >
                Aceptar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===================================================================== */}
      {/* MODAL 3: CONFIRMAR DEVOLUCIÓN                                         */}
      {/* ===================================================================== */}
      {modalConfirmarDevolucion && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
        >
          <div
            className="card"
            style={{ maxWidth: '480px', width: '92%', margin: 0, borderTop: '5px solid #ff4d4f' }}
          >
            <h3 className="card-title" style={{ textAlign: 'center', color: '#cf1322' }}>
              Confirmar Devolución
            </h3>
            <p className="muted" style={{ textAlign: 'center' }}>
              Venta origen: <strong className="strong">{modalConfirmarDevolucion.numeroComprobante}</strong> ({modalConfirmarDevolucion.sucursalNombre})
            </p>

            <div
              style={{
                padding: '12px',
                backgroundColor: 'rgba(255, 77, 79, 0.06)',
                border: '1px solid rgba(255, 77, 79, 0.25)',
                borderRadius: '6px',
                fontSize: '13px',
                lineHeight: '1.6',
              }}
            >
              {modalConfirmarDevolucion.items.map((it) => (
                <div key={it.idDetalleVenta}>
                  • {it.cantidad}× <strong>{it.productoNombre}</strong> ({formatoMoneda(it.cantidad * it.precioUnitario)})
                </div>
              ))}
              <div style={{ marginTop: '6px' }}>
                <span className="muted">Motivo:</span> <strong>{modalConfirmarDevolucion.motivo}</strong>
              </div>
              <div>
                <span className="muted">Reingreso a stock local:</span>{' '}
                <strong>{modalConfirmarDevolucion.reingresarStock ? 'Sí (suma unidades al local)' : 'No (mercadería no apta)'}</strong>
              </div>
            </div>

            <div style={{ textAlign: 'center', fontSize: '18px', fontWeight: 'bold', marginTop: '12px' }}>
              Monto a Reintegrar: {formatoMoneda(modalConfirmarDevolucion.montoDevuelto)}
            </div>

            <div style={{ display: 'flex', justifyContent: 'center', gap: '15px', marginTop: '20px' }}>
              <button type="button" className="btn" onClick={() => setModalConfirmarDevolucion(null)}>
                Cancelar
              </button>
              <button type="button" className="btn btn-danger" onClick={ejecutarConfirmarDevolucion}>
                Confirmar Devolución
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}