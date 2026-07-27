
import { Type } from "@google/genai";
import { ReportType } from "./types";

const schema606 = {
  type: Type.OBJECT,
  properties: {
    nombreSuplidor: { type: Type.STRING, description: "Nombre legal o comercial del suplidor" },
    rncCedula: { type: Type.STRING, description: "RNC o Cédula del proveedor" },
    tipoId: { type: Type.STRING, description: "1 para RNC, 2 para Cédula, 3 para Pasaporte" },
    tipoGasto: { 
      type: Type.STRING, 
      description: "Código DGII: 01-Gastos de Personal, 02-Gastos por Trabajos/Servicios, 03-Arrendamientos, 04-Gastos de Activos Fijos, 05-Gastos de Representación, 06-Otras Deducciones, 07-Gastos Financieros, 08-Gastos Extraordinarios, 09-Compras para Costo de Ventas, 10-Adquisición Activos, 11-Gastos de Seguros" 
    },
    ncf: { type: Type.STRING, description: "Número de Comprobante Fiscal" },
    ncfModificado: { type: Type.STRING, description: "NCF modificado si aplica" },
    fechaComprobante: { type: Type.STRING, description: "Fecha YYYYMMDD" },
    fechaPago: { type: Type.STRING, description: "Fecha de pago YYYYMMDD" },
    montoServicios: { type: Type.NUMBER },
    montoBienes: { type: Type.NUMBER },
    totalFacturado: { type: Type.NUMBER },
    itbisFacturado: { type: Type.NUMBER },
    itbisRetenido: { type: Type.NUMBER },
    itbisSujetoACosto: { type: Type.NUMBER },
    itbisPorAdelantar: { type: Type.NUMBER },
    itbisPercibidoenCompras: { type: Type.NUMBER },
    tipoRetencionISR: { type: Type.STRING },
    montoRetencionISR: { type: Type.NUMBER },
    isrPercibidoenCompras: { type: Type.NUMBER },
    impuestoSelectivoConsumo: { type: Type.NUMBER },
    otrosImpuestos: { type: Type.NUMBER },
    montoPropinaLegal: { type: Type.NUMBER, description: "Monto de la propina legal (10%) si aplica" },
    formaPago: { type: Type.STRING, description: "01-Efectivo, 02-Cheque/Transf, 03-Tarjeta, 04-Crédito, 05-Bonos, 06-Permuta, 07-Otras" },
  },
  required: ["rncCedula", "ncf", "fechaComprobante", "totalFacturado", "nombreSuplidor", "tipoGasto"],
};

const schema607 = {
  type: Type.OBJECT,
  properties: {
    nombreCliente: { type: Type.STRING, description: "Nombre del cliente o razón social" },
    rncCedula: { type: Type.STRING, description: "RNC o Cédula del cliente" },
    tipoId: { type: Type.STRING, description: "1 para RNC, 2 para Cédula" },
    ncf: { type: Type.STRING, description: "Número de Comprobante Fiscal" },
    ncfModificado: { type: Type.STRING, description: "NCF modificado si aplica" },
    tipoIngreso: { 
      type: Type.STRING, 
      description: "01-Ingresos por Operaciones, 02-Ingresos Financieros, 03-Ingresos Extraordinarios, 04-Otros Ingresos" 
    },
    fechaComprobante: { type: Type.STRING, description: "Fecha YYYYMMDD" },
    fechaRetencion: { type: Type.STRING, description: "Fecha retención YYYYMMDD" },
    montoFacturado: { type: Type.NUMBER },
    itbisFacturado: { type: Type.NUMBER },
    itbisRetenidoPorTerceros: { type: Type.NUMBER },
    itbisPercibido: { type: Type.NUMBER },
    retencionRentaPorTerceros: { type: Type.NUMBER },
    isrPercibido: { type: Type.NUMBER },
    impuestoSelectivoConsumo: { type: Type.NUMBER },
    otrosImpuestos: { type: Type.NUMBER },
    montoPropinaLegal: { type: Type.NUMBER, description: "Monto de la propina legal (10%) si aplica" },
    montoEfectivo: { type: Type.NUMBER },
    montoChequeTransferencia: { type: Type.NUMBER },
    montoTarjeta: { type: Type.NUMBER },
    montoVentaCredito: { type: Type.NUMBER },
    montoBonos: { type: Type.NUMBER },
    montoPermuta: { type: Type.NUMBER },
    montoOtrasFormas: { type: Type.NUMBER },
  },
  required: ["rncCedula", "ncf", "fechaComprobante", "montoFacturado", "nombreCliente", "tipoIngreso"],
};

export const processInvoice = async (file: File, type: ReportType) => {
  const base64Data = await fileToBase64(file);
  const mimeType = file.type;

  try {
    const response = await fetch("/api/process-invoice", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        base64Data,
        mimeType,
        reportType: type,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      const errorMsg = errorData.error || `HTTP ${response.status}`;
      if (errorMsg === "KEY_NOT_FOUND" || response.status === 401 || response.status === 404) {
        throw new Error("KEY_NOT_FOUND");
      }
      if (errorMsg === "QUOTA_EXCEEDED" || response.status === 429) {
        throw new Error("QUOTA_EXCEEDED");
      }
      throw new Error(errorMsg);
    }

    return await response.json();
  } catch (error: any) {
    throw error;
  }
};

const fileToBase64 = (file: File): Promise<string> => {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = (error) => reject(error);
  });
};
