export enum ReportType {
  REPORT_606 = '606',
  REPORT_607 = '607'
}

export interface ProcessingFile {
  id: string;
  file?: File;
  previewUrl: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  extractedData?: any;
  error?: string;
  originalFilename?: string;
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

export interface AuthUser {
  id: string;
  tenantId: string;
  email: string;
  name: string;
  role: string;
}

export interface Tenant {
  id: string;
  name: string;
  rnc: string;
  creditBalance: number;
}

export interface FiscalBatch {
  id: string;
  tenantId: string;
  reportType: '606' | '607';
  period: string;
  rncInformante: string;
  status: 'draft' | 'ready' | 'exported' | 'archived';
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
  invoiceCount?: number;
  completedCount?: number;
  latestExportVersion?: number | null;
}

export interface InvoiceRecord {
  id: string;
  batchId: string;
  status: 'pending' | 'processing' | 'completed' | 'error';
  originalFilename: string;
  mimeType: string;
  extractedData?: any;
  error?: string | null;
  sortOrder: number;
  creditsCharged: number;
  createdAt: string;
  updatedAt: string;
  previewUrl: string;
}

export interface BatchExport {
  id: string;
  batchId: string;
  version: number;
  exportedBy?: string;
  exportedAt: string;
  filename: string;
  recordCount: number;
}

export interface CreditPackage {
  id: string;
  code: string;
  name: string;
  credits: number;
  priceCents: number;
  currency: string;
  active: boolean;
}

export interface CreditLedgerEntry {
  id: string;
  delta: number;
  balanceAfter: number;
  reason: string;
  invoiceId?: string | null;
  meta?: Record<string, unknown>;
  createdAt: string;
}
