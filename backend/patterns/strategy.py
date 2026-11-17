from abc import ABC, abstractmethod


class MedioPagoStrategy(ABC):
    """Interfaz del Patrón Strategy para el procesamiento polimórfico de cobros."""

    def __init__(self, monto: float):
        self.monto = float(monto)

    @abstractmethod
    def validarMonto(self) -> None:
        """Valida las reglas de negocio específicas del medio de pago. Lanza ValueError si falla."""
        pass

    @abstractmethod
    def procesarPago(self) -> dict:
        """Ejecuta el procesamiento del cobro y retorna los datos específicos persistibles."""
        pass

    @abstractmethod
    def emitirComprobantePago(self) -> str:
        """Emite el texto del cupón / comprobante correspondiente a la estrategia."""
        pass

    def cancelarORevertir(self) -> str:
        """Reversión polimórfica ante anulación o devolución."""
        return f"Reversión registrada por ${self.monto:.2f}"


class EstrategiaEfectivo(MedioPagoStrategy):
    def __init__(self, monto: float, monto_entregado: float = None):
        super().__init__(monto)
        self.monto_entregado = float(monto_entregado) if monto_entregado is not None else self.monto
        self.vuelto = 0.0

    def validarMonto(self) -> None:
        if self.monto <= 0:
            raise ValueError("El monto a cobrar en Efectivo debe ser mayor a $0.")
        if self.monto_entregado < self.monto:
            raise ValueError(
                f"El monto entregado (${self.monto_entregado:.2f}) es menor al importe a cobrar (${self.monto:.2f})."
            )

    def procesarPago(self) -> dict:
        self.validarMonto()
        self.vuelto = round(self.monto_entregado - self.monto, 2)
        return {
            "tipo": "efectivo",
            "monto": self.monto,
            "montoEntregado": self.monto_entregado,
            "vuelto": self.vuelto,
            "comprobante": self.emitirComprobantePago(),
        }

    def emitirComprobantePago(self) -> str:
        return (
            f"Efectivo: Cobrado ${self.monto:.2f} | "
            f"Entregado ${self.monto_entregado:.2f} | Vuelto ${self.vuelto:.2f}"
        )


class EstrategiaTarjetaCredito(MedioPagoStrategy):
    def __init__(self, monto: float, numero_tarjeta: str = "", cuotas: int = 1, codigo_autorizacion: str = ""):
        super().__init__(monto)
        self.numero_tarjeta = str(numero_tarjeta or "").strip()
        self.cuotas = int(cuotas or 1)
        self.codigo_autorizacion = str(codigo_autorizacion or "").strip()

    def validarMonto(self) -> None:
        if self.monto <= 0:
            raise ValueError("El monto a cobrar con Tarjeta de Crédito debe ser mayor a $0.")
        if self.cuotas < 1 or self.cuotas > 24:
            raise ValueError("La cantidad de cuotas debe estar entre 1 y 24.")
        digitos = "".join(c for c in self.numero_tarjeta if c.isdigit())
        if len(digitos) < 4:
            raise ValueError("Ingrese al menos los últimos 4 dígitos de la tarjeta de crédito.")
        if len(self.codigo_autorizacion) < 3:
            raise ValueError("Ingrese un código de autorización válido (mínimo 3 caracteres).")

    def procesarPago(self) -> dict:
        self.validarMonto()
        digitos = "".join(c for c in self.numero_tarjeta if c.isdigit())
        tarjeta_enmascarada = f"****-{digitos[-4:]}"
        self.numero_tarjeta = tarjeta_enmascarada
        return {
            "tipo": "tarjeta_credito",
            "monto": self.monto,
            "numeroTarjeta": tarjeta_enmascarada,
            "cuotas": self.cuotas,
            "codigoAutorizacion": self.codigo_autorizacion,
            "comprobante": self.emitirComprobantePago(),
        }

    def emitirComprobantePago(self) -> str:
        return (
            f"Tarjeta Crédito ({self.numero_tarjeta}): ${self.monto:.2f} "
            f"en {self.cuotas} cuota(s) | Aut: {self.codigo_autorizacion}"
        )


class EstrategiaTransferencia(MedioPagoStrategy):
    def __init__(self, monto: float, cbu_origen: str = "", comprobante_transferencia: str = ""):
        super().__init__(monto)
        self.cbu_origen = str(cbu_origen or "").strip()
        self.comprobante_transferencia = str(comprobante_transferencia or "").strip()

    def validarMonto(self) -> None:
        if self.monto <= 0:
            raise ValueError("El monto a cobrar por Transferencia debe ser mayor a $0.")
        if len(self.cbu_origen) < 6:
            raise ValueError("Ingrese un CBU / Alias de origen válido (mínimo 6 caracteres).")
        if len(self.comprobante_transferencia) < 3:
            raise ValueError("Ingrese el número de comprobante de transferencia.")

    def procesarPago(self) -> dict:
        self.validarMonto()
        return {
            "tipo": "transferencia",
            "monto": self.monto,
            "cbuOrigen": self.cbu_origen,
            "comprobanteTransferencia": self.comprobante_transferencia,
            "comprobante": self.emitirComprobantePago(),
        }

    def emitirComprobantePago(self) -> str:
        return (
            f"Transferencia desde '{self.cbu_origen}': ${self.monto:.2f} | "
            f"Comp. N° {self.comprobante_transferencia}"
        )


def crear_estrategia_pago(pago_data: dict) -> MedioPagoStrategy:
    """Fábrica que instancia la estrategia concreta según el medio de pago elegido."""
    tipo = (pago_data.get("tipo") or "").strip().lower()
    monto = float(pago_data.get("monto", 0))

    if tipo == "efectivo":
        return EstrategiaEfectivo(
            monto=monto,
            monto_entregado=pago_data.get("montoEntregado"),
        )
    if tipo == "tarjeta_credito":
        return EstrategiaTarjetaCredito(
            monto=monto,
            numero_tarjeta=pago_data.get("numeroTarjeta", ""),
            cuotas=pago_data.get("cuotas", 1),
            codigo_autorizacion=pago_data.get("codigoAutorizacion", ""),
        )
    if tipo == "transferencia":
        return EstrategiaTransferencia(
            monto=monto,
            cbu_origen=pago_data.get("cbuOrigen", ""),
            comprobante_transferencia=pago_data.get("comprobanteTransferencia", ""),
        )

    raise ValueError(f"Medio de pago no soportado: '{tipo}'.")