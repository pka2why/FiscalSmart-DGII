
export enum ReportType {
  REPORT_606 = '606', // Compras y Gastos
  REPORT_607 = '607'  // Ventas e Ingresos
}

export interface ProcessingFile {
  id: string;
  file: File;
  previewUrl: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  extractedData?: any;
  error?: string;
}

export interface InvoiceData606 {
  nombreSuplidor: string;
  rncCedula: string;
  tipoId: string;
  tipoGasto: string;
  ncf: string;
  ncfModificado: string;
  fechaComprobante: string;
  fechaPago: string;
  montoServicios: number;
  montoBienes: number;
  totalFacturado: number;
  itbisFacturado: number;
  itbisRetenido: number;
  itbisSujetoACosto: number;
  itbisPorAdelantar: number;
  itbisPercibidoenCompras: number;
  tipoRetencionISR: string;
  montoRetencionISR: number;
  isrPercibidoenCompras: number;
  impuestoSelectivoConsumo: number;
  otrosImpuestos: number;
  montoPropinaLegal: number;
  formaPago: string;
}

export interface InvoiceData607 {
  nombreCliente: string;
  rncCedula: string;
  tipoId: string;
  ncf: string;
  ncfModificado: string;
  tipoIngreso: string;
  fechaComprobante: string;
  fechaRetencion: string;
  montoFacturado: number;
  itbisFacturado: number;
  itbisRetenidoPorTerceros: number;
  itbisPercibido: number;
  retencionRentaPorTerceros: number;
  isrPercibido: number;
  impuestoSelectivoConsumo: number;
  otrosImpuestos: number;
  montoPropinaLegal: number;
  montoEfectivo: number;
  montoChequeTransferencia: number;
  montoTarjeta: number;
  montoVentaCredito: number;
  montoBonos: number;
  montoPermuta: number;
  montoOtrasFormas: number;
}
