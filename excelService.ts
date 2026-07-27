import * as XLSX from 'xlsx';
import { ReportType } from './types';

export const generateExcel = (
  data: any[],
  type: ReportType,
  rncInformante: string = '',
  periodo: string = ''
) => {
  // Define official column headers
  const colHeaders606 = [
    'RNC o Cédula (1)',
    'Tipo de Identificación (2)',
    'Tipo de Gasto (3)',
    'Número de Comprobante Fiscal (4)',
    'NCF Modificado (5)',
    'Fecha Comprobante (6)',
    'Fecha Pago (7)',
    'Monto Facturado en Servicios (8)',
    'Monto Facturado en Bienes (9)',
    'Total Facturado (10)',
    'ITBIS Facturado (11)',
    'ITBIS Retenido (12)',
    'ITBIS Sujeto a Proporcionalidad (13)',
    'ITBIS por Adelantar (14)',
    'ITBIS Percibido en Compras (15)',
    'Tipo de Retención en ISR (16)',
    'Monto Retención en ISR (17)',
    'ISR Percibido en Compras (18)',
    'Impuesto Selectivo al Consumo (19)',
    'Otros Impuestos/Tasas (20)',
    'Monto Propina Legal (21)',
    'Forma de Pago (22)'
  ];

  const colHeaders607 = [
    'RNC o Cédula del Cliente (1)',
    'Tipo de Identificación (2)',
    'Número de Comprobante Fiscal (3)',
    'NCF Modificado (4)',
    'Tipo de Ingreso (5)',
    'Fecha Comprobante (6)',
    'Fecha Retención (7)',
    'Monto Facturado (8)',
    'ITBIS Facturado (9)',
    'ITBIS Retenido por Terceros (10)',
    'ITBIS Percibido (11)',
    'Retención Renta por Terceros (12)',
    'ISR Percibido (13)',
    'Impuesto Selectivo al Consumo (14)',
    'Otros Impuestos/Tasas (15)',
    'Monto Propina Legal (16)',
    'Monto Efectivo (17)',
    'Monto Cheque/Transferencia/Depósito (18)',
    'Monto Tarjeta Crédito/Débito (19)',
    'Monto Venta a Crédito (20)',
    'Bonos o Cupones de Regalo (21)',
    'Permuta (22)',
    'Otras Formas de Ventas (23)'
  ];

  const colHeaders = type === ReportType.REPORT_606 ? colHeaders606 : colHeaders607;

  // Build the official top metadata header rows
  const metaRows = [
    ['REPÚBLICA DOMINICANA - MINISTERIO DE HACIENDA'],
    ['DIRECCIÓN GENERAL DE IMPUESTOS INTERNOS (DGII)'],
    [type === ReportType.REPORT_606 
      ? 'FORMATO DE ENVÍO DE COMPRAS DE BIENES Y SERVICIOS (606)' 
      : 'FORMATO DE ENVÍO DE DETALLES DE VENTAS DE BIENES Y SERVICIOS (607)'
    ],
    [`RNC / Cédula del Informante: ${rncInformante || 'NO ESPECIFICADO'}`],
    [`Periodo de Reporte: ${periodo || 'NO ESPECIFICADO'}`],
    [`Cantidad de Registros: ${data.length}`],
    [''] // Empty separator row
  ];

  // Map database structures to official column data arrays
  const mappedDataRows = data.map((item) => {
    if (type === ReportType.REPORT_606) {
      // 606 Compras logic
      const rnc = String(item.rncCedula || '').trim();
      
      // Auto-detect Tipo de Identificación if missing
      // 1 = RNC (9 chars), 2 = Cédula (11 chars), 3 = Pasaporte/Otro (others)
      let tipoId = item.tipoId || '';
      if (!tipoId && rnc) {
        tipoId = rnc.length === 9 ? '1' : rnc.length === 11 ? '2' : '3';
      }

      // Safe formatting for dates (should be AAAAMMDD)
      const cleanDate = (dateStr: string) => {
        if (!dateStr) return '';
        return String(dateStr).replace(/[-/]/g, '').trim();
      };

      const fComprobante = cleanDate(item.fechaComprobante);
      const fPago = cleanDate(item.fechaPago);

      // Smart split of invoice amount into Servicios vs Bienes
      // In DGII, Total = Servicios + Bienes + Taxes.
      let serv = Number(item.montoServicios) || 0;
      let bien = Number(item.montoBienes) || 0;
      const total = Number(item.totalFacturado) || 0;
      const itbis = Number(item.itbisFacturado) || 0;
      const otros = Number(item.otrosImpuestos) || 0;
      const propina = Number(item.montoPropinaLegal) || 0;
      const subtotal = Math.max(0, total - itbis - otros - propina);

      if (item.tipoBienServicio === 'bien') {
        bien = subtotal;
        serv = 0;
      } else if (item.tipoBienServicio === 'servicio') {
        serv = subtotal;
        bien = 0;
      } else if (serv === 0 && bien === 0 && total > 0) {
        const tg = item.tipoGasto || '02';
        // Classify standard Bienes/Costo categories, put rest in Servicios
        if (['09', '10'].includes(tg)) {
          bien = subtotal;
        } else {
          serv = subtotal;
        }
      }

      return [
        rnc,                                               // RNC o Cédula (1)
        String(tipoId),                                    // Tipo de Identificación (2)
        String(item.tipoGasto || '02'),                    // Tipo de Gasto (3)
        String(item.ncf || '').trim(),                     // NCF (4)
        String(item.ncfModificado || '').trim(),           // NCF Modificado (5)
        fComprobante,                                      // Fecha Comprobante (6)
        fPago,                                             // Fecha Pago (7)
        serv,                                              // Monto Servicios (8)
        bien,                                              // Monto Bienes (9)
        total || (serv + bien),                            // Total Facturado (10)
        Number(item.itbisFacturado) || 0,                 // ITBIS Facturado (11)
        Number(item.itbisRetenido) || 0,                  // ITBIS Retenido (12)
        Number(item.itbisSujetoACosto) || 0,              // ITBIS Proporcionalidad (13)
        Number(item.itbisPorAdelantar) || 0,              // ITBIS por Adelantar (14)
        Number(item.itbisPercibidoenCompras) || 0,         // ITBIS Percibido en Compras (15)
        String(item.tipoRetencionISR || ''),               // Tipo Retención ISR (16)
        Number(item.montoRetencionISR) || 0,              // Monto Retención ISR (17)
        Number(item.isrPercibidoenCompras) || 0,          // ISR Percibido en Compras (18)
        Number(item.impuestoSelectivoConsumo) || 0,       // Impuesto Selectivo al Consumo (19)
        Number(item.otrosImpuestos) || 0,                  // Otros Impuestos (20)
        Number(item.montoPropinaLegal) || 0,               // Propina Legal (21)
        String(item.formaPago || '01')                     // Forma de Pago (22)
      ];
    } else {
      // 607 Ventas logic
      const rnc = String(item.rncCedula || '').trim();
      let tipoId = item.tipoId || '';
      if (!tipoId && rnc) {
        tipoId = rnc.length === 9 ? '1' : rnc.length === 11 ? '2' : '3';
      }

      const cleanDate = (dateStr: string) => {
        if (!dateStr) return '';
        return String(dateStr).replace(/[-/]/g, '').trim();
      };

      const fComprobante = cleanDate(item.fechaComprobante);
      const fRetencion = cleanDate(item.fechaRetencion);

      const mFacturado = Number(item.montoFacturado) || 0;
      const itbis = Number(item.itbisFacturado) || 0;
      const propina = Number(item.montoPropinaLegal) || 0;

      // Smart payment fallback: payment columns sum MUST equal Facturado + ITBIS + Propina
      // If all payment columns are 0, default the whole amount to "Monto Efectivo" to pass validation.
      const totalTrans = mFacturado + itbis + propina;
      let efectivo = Number(item.montoEfectivo) || 0;
      let cheque = Number(item.montoChequeTransferencia) || 0;
      let tarjeta = Number(item.montoTarjeta) || 0;
      let credito = Number(item.montoVentaCredito) || 0;
      let bonos = Number(item.montoBonos) || 0;
      let permuta = Number(item.montoPermuta) || 0;
      let otras = Number(item.montoOtrasFormas) || 0;

      if (efectivo === 0 && cheque === 0 && tarjeta === 0 && credito === 0 && bonos === 0 && permuta === 0 && otras === 0 && totalTrans > 0) {
        efectivo = totalTrans;
      }

      return [
        rnc,                                               // RNC o Cédula Cliente (1)
        String(tipoId),                                    // Tipo de Identificación (2)
        String(item.ncf || '').trim(),                     // NCF (3)
        String(item.ncfModificado || '').trim(),           // NCF Modificado (4)
        String(item.tipoIngreso || '01'),                  // Tipo de Ingreso (5)
        fComprobante,                                      // Fecha Comprobante (6)
        fRetencion,                                        // Fecha Retención (7)
        mFacturado,                                        // Monto Facturado (8)
        itbis,                                             // ITBIS Facturado (9)
        Number(item.itbisRetenidoPorTerceros) || 0,        // ITBIS Retenido Terceros (10)
        Number(item.itbisPercibido) || 0,                  // ITBIS Percibido (11)
        Number(item.retencionRentaPorTerceros) || 0,       // Retencion Renta por Terceros (12)
        Number(item.isrPercibido) || 0,                    // ISR Percibido (13)
        Number(item.impuestoSelectivoConsumo) || 0,       // Impuesto Selectivo Consumo (14)
        Number(item.otrosImpuestos) || 0,                  // Otros Impuestos (15)
        propina,                                           // Propina Legal (16)
        efectivo,                                          // Monto Efectivo (17)
        cheque,                                            // Cheque/Transferencia (18)
        tarjeta,                                           // Tarjeta (19)
        credito,                                           // Crédito (20)
        bonos,                                             // Bonos (21)
        permuta,                                           // Permuta (22)
        otras                                              // Otras Formas (23)
      ];
    }
  });

  // Combine meta rows, headers, and data rows
  const allRows = [
    ...metaRows,
    colHeaders,
    ...mappedDataRows
  ];

  // Create worksheet from AOA (Array of Arrays)
  const ws = XLSX.utils.aoa_to_sheet(allRows);
  const wb = XLSX.utils.book_new();

  // Set worksheet metadata and columns width styling
  // We calculate auto column widths based on the column headers and the actual data rows (ignoring top metadata rows)
  const colWidths = colHeaders.map((header, colIndex) => {
    let maxLength = header.length;
    // Iterate only through data rows to check for value lengths
    for (let i = 0; i < mappedDataRows.length; i++) {
      const val = mappedDataRows[i][colIndex];
      if (val !== undefined && val !== null) {
        const strVal = String(val);
        if (strVal.length > maxLength) {
          maxLength = strVal.length;
        }
      }
    }
    return { wch: Math.min(Math.max(maxLength + 3, 11), 35) };
  });

  ws['!cols'] = colWidths;

  // Append sheet to workbook
  XLSX.utils.book_append_sheet(wb, ws, `Formato ${type}`);

  // Generate output file and trigger download
  const wbout = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
  const blob = new Blob([wbout], { type: 'application/octet-stream' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  
  const cleanPeriod = periodo ? `_${periodo}` : '';
  a.download = `Formato_${type}${cleanPeriod}_Exportado.xlsx`;
  a.click();
  URL.revokeObjectURL(url);
};
