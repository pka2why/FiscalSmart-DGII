import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  ArrowLeft,
  CheckCircle,
  Coins,
  Download,
  Eye,
  FileUp,
  History,
  Loader2,
  Pencil,
  Play,
  Trash2,
  X,
} from 'lucide-react';
import { api, downloadAuthenticated } from '../api';
import { useAuth } from '../AuthContext';
import type { BatchExport, FiscalBatch, InvoiceRecord } from '../types';

const GASTO_LABELS: Record<string, string> = {
  '01': 'Gastos de personal',
  '02': 'Gastos de trabajos, suministros y servicios',
  '03': 'Arrendamientos',
  '04': 'Gastos de activos fijos',
  '05': 'Gastos de representación',
  '06': 'Gastos deducciones admitidas',
  '07': 'Gastos financieros',
  '08': 'Gastos extraordinarios',
  '09': 'Compras y gastos que forman parte del costo de venta',
  '10': 'Adquisiciones de activos',
  '11': 'Gastos de Seguros',
};

const INGRESO_LABELS: Record<string, string> = {
  '01': 'Operaciones',
  '02': 'Financieros',
  '03': 'Extraordinarios',
  '04': 'Otros Ingresos',
};

const validateRncCedulaByTipo = (val: any, tipoId?: string) => {
  if (!val) return { isValid: false, message: 'El campo es requerido' };
  const clean = String(val).replace(/[^0-9]/g, '');
  if (tipoId === '1') {
    return { isValid: clean.length === 9, message: 'RNC inválido: debe contener exactamente 9 dígitos.' };
  }
  if (tipoId === '2') {
    return { isValid: clean.length === 11, message: 'Cédula inválida: debe contener exactamente 11 dígitos.' };
  }
  if (tipoId === '3') {
    return { isValid: String(val).trim().length > 0, message: 'Pasaporte requerido.' };
  }
  return {
    isValid: clean.length === 9 || clean.length === 11,
    message: 'Identificación incorrecta: RNC 9 dígitos o Cédula 11.',
  };
};

const validateNcfWithMsg = (val: any) => {
  if (!val) return { isValid: false, message: 'El NCF es requerido' };
  const clean = String(val).trim().toUpperCase();
  if (/^B[0-9]{10}$/.test(clean)) return { isValid: true, message: 'NCF válido' };
  if (/^E[0-9]{12}$/.test(clean)) return { isValid: true, message: 'e-CF válido' };
  if (/^A[0-9]{18}$/.test(clean)) return { isValid: true, message: 'NCF formato anterior válido' };
  return {
    isValid: false,
    message: 'NCF incorrecto. Formatos: B+10, E+12 o A+18 dígitos.',
  };
};

function useAuthenticatedFileUrl(path: string | null, mimeType?: string) {
  const [url, setUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    let objectUrl: string | null = null;
    let cancelled = false;

    const run = async () => {
      if (!path) {
        setUrl(null);
        return;
      }
      setLoading(true);
      setError('');
      try {
        const res = await fetch(path, { credentials: 'include' });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error(
            data.message || data.error || `No se pudo cargar el archivo (${res.status})`
          );
        }
        const blob = await res.blob();
        const typed =
          mimeType && (!blob.type || blob.type === 'application/octet-stream')
            ? new Blob([blob], { type: mimeType })
            : blob;
        objectUrl = URL.createObjectURL(typed);
        if (!cancelled) setUrl(objectUrl);
      } catch (err: any) {
        if (!cancelled) {
          setUrl(null);
          setError(err.message || 'Error cargando archivo');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    run();
    return () => {
      cancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [path, mimeType]);

  return { url, loading, error };
}

const Field: React.FC<{
  label: string;
  children: React.ReactNode;
  hint?: string;
  warn?: boolean;
}> = ({ label, children, hint, warn }) => (
  <div>
    <label className="block text-xs font-medium text-slate-600 mb-1">{label}</label>
    {children}
    {hint && (
      <p className={`text-xs mt-1 ${warn ? 'text-amber-600' : 'text-slate-400'}`}>{hint}</p>
    )}
  </div>
);

const InvoiceReviewModal: React.FC<{
  invoice: InvoiceRecord;
  reportType: '606' | '607';
  onClose: () => void;
  onSaveField: (field: string, value: any) => Promise<void>;
}> = ({ invoice, reportType, onClose, onSaveField }) => {
  const { url, loading, error } = useAuthenticatedFileUrl(
    invoice.previewUrl,
    invoice.mimeType
  );
  const [draft, setDraft] = useState<Record<string, any>>(invoice.extractedData || {});
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setDraft(invoice.extractedData || {});
  }, [invoice.id, invoice.updatedAt, invoice.extractedData]);

  const labels = reportType === '607' ? INGRESO_LABELS : GASTO_LABELS;
  const nameField = reportType === '607' ? 'nombreCliente' : 'nombreSuplidor';
  const catField = reportType === '607' ? 'tipoIngreso' : 'tipoGasto';
  const amountField = reportType === '607' ? 'montoFacturado' : 'totalFacturado';
  const isImage = (invoice.mimeType || '').startsWith('image/');
  const isPdf = invoice.mimeType === 'application/pdf';

  const rncCheck = validateRncCedulaByTipo(draft.rncCedula, draft.tipoId);
  const ncfCheck = validateNcfWithMsg(draft.ncf);

  const updateLocal = (field: string, value: any) => {
    setDraft((prev) => ({ ...prev, [field]: value }));
  };

  const persist = async (field: string, value: any) => {
    setSaving(true);
    try {
      let typedValue = value;
      if (
        [
          'montoPropinaLegal',
          'itbisFacturado',
          'totalFacturado',
          'montoFacturado',
          'montoBienes',
          'montoServicios',
          'otrosImpuestos',
          'montoEfectivo',
          'montoChequeTransferencia',
          'montoTarjeta',
          'montoVentaCredito',
        ].includes(field)
      ) {
        typedValue = parseFloat(value) || 0;
      }
      updateLocal(field, typedValue);
      await onSaveField(field, typedValue);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black/60 z-50 flex items-center justify-center p-3 md:p-6">
      <div className="bg-white rounded-2xl w-full max-w-6xl max-h-[94vh] overflow-hidden flex flex-col shadow-2xl">
        <div className="flex items-center justify-between gap-3 px-4 py-3 border-b bg-slate-50">
          <div>
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <Pencil size={16} className="text-indigo-600" />
              Previsualizar y corregir
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 font-mono">{invoice.originalFilename}</p>
          </div>
          <div className="flex items-center gap-2">
            {saving && (
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Loader2 size={12} className="animate-spin" /> Guardando…
              </span>
            )}
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-slate-200 text-slate-600"
              aria-label="Cerrar"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        <div className="grid md:grid-cols-2 flex-1 min-h-0 overflow-hidden">
          <div className="bg-slate-900/95 p-3 md:p-4 overflow-auto flex items-start justify-center min-h-[280px]">
            {loading && <Loader2 className="animate-spin text-white m-auto" size={32} />}
            {!loading && error && (
              <p className="text-red-300 text-sm m-auto text-center px-4">{error}</p>
            )}
            {!loading && url && isImage && (
              <img
                src={url}
                alt={invoice.originalFilename}
                className="max-w-full max-h-[80vh] object-contain rounded shadow-lg"
              />
            )}
            {!loading && url && isPdf && (
              <iframe title="pdf" src={url} className="w-full h-[80vh] rounded bg-white" />
            )}
            {!loading && url && !isImage && !isPdf && (
              <a
                href={url}
                download={invoice.originalFilename}
                className="text-indigo-200 underline m-auto"
              >
                Descargar archivo
              </a>
            )}
          </div>

          <div className="overflow-auto p-4 md:p-5 space-y-4 bg-white">
            {invoice.error && (
              <div className="bg-red-50 text-red-700 text-sm rounded-lg p-3 border border-red-100">
                {invoice.error}
              </div>
            )}

            {!invoice.extractedData && (
              <div className="bg-amber-50 text-amber-800 text-sm rounded-lg p-3 border border-amber-100">
                Esta factura aún no tiene datos extraídos. Procesa el OCR primero.
              </div>
            )}

            <Field label={reportType === '606' ? 'Nombre suplidor' : 'Nombre cliente'}>
              <input
                className="w-full border rounded-lg px-3 py-2"
                value={draft[nameField] || ''}
                disabled={!invoice.extractedData}
                onChange={(e) => updateLocal(nameField, e.target.value)}
                onBlur={(e) => persist(nameField, e.target.value)}
              />
            </Field>

            <div className="grid grid-cols-3 gap-3">
              <Field
                label="RNC / Cédula"
                warn={!rncCheck.isValid && !!draft.rncCedula}
                hint={!rncCheck.isValid && draft.rncCedula ? rncCheck.message : undefined}
              >
                <input
                  className={`w-full border rounded-lg px-3 py-2 ${
                    !rncCheck.isValid && draft.rncCedula ? 'border-amber-400' : ''
                  }`}
                  value={draft.rncCedula || ''}
                  disabled={!invoice.extractedData}
                  onChange={(e) => updateLocal('rncCedula', e.target.value)}
                  onBlur={(e) => persist('rncCedula', e.target.value)}
                />
              </Field>
              <Field label="Tipo ID">
                <select
                  className="w-full border rounded-lg px-3 py-2"
                  value={draft.tipoId || '1'}
                  disabled={!invoice.extractedData}
                  onChange={(e) => persist('tipoId', e.target.value)}
                >
                  <option value="1">1 — RNC</option>
                  <option value="2">2 — Cédula</option>
                  <option value="3">3 — Pasaporte</option>
                </select>
              </Field>
              <Field
                label="NCF"
                warn={!ncfCheck.isValid && !!draft.ncf}
                hint={!ncfCheck.isValid && draft.ncf ? ncfCheck.message : undefined}
              >
                <input
                  className={`w-full border rounded-lg px-3 py-2 ${
                    !ncfCheck.isValid && draft.ncf ? 'border-amber-400' : ''
                  }`}
                  value={draft.ncf || ''}
                  disabled={!invoice.extractedData}
                  onChange={(e) => updateLocal('ncf', e.target.value)}
                  onBlur={(e) => persist('ncf', e.target.value)}
                />
              </Field>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Field label="Fecha comprobante (YYYYMMDD)">
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={draft.fechaComprobante || ''}
                  disabled={!invoice.extractedData}
                  onChange={(e) => updateLocal('fechaComprobante', e.target.value)}
                  onBlur={(e) => persist('fechaComprobante', e.target.value)}
                />
              </Field>
              <Field label={reportType === '606' ? 'Fecha pago' : 'Fecha retención'}>
                <input
                  className="w-full border rounded-lg px-3 py-2"
                  value={
                    (reportType === '606' ? draft.fechaPago : draft.fechaRetencion) || ''
                  }
                  disabled={!invoice.extractedData}
                  onChange={(e) =>
                    updateLocal(
                      reportType === '606' ? 'fechaPago' : 'fechaRetencion',
                      e.target.value
                    )
                  }
                  onBlur={(e) =>
                    persist(
                      reportType === '606' ? 'fechaPago' : 'fechaRetencion',
                      e.target.value
                    )
                  }
                />
              </Field>
            </div>

            <Field label={reportType === '606' ? 'Tipo de gasto' : 'Tipo de ingreso'}>
              <select
                className="w-full border rounded-lg px-3 py-2"
                value={draft[catField] || ''}
                disabled={!invoice.extractedData}
                onChange={(e) => persist(catField, e.target.value)}
              >
                <option value="">—</option>
                {Object.entries(labels).map(([code, label]) => (
                  <option key={code} value={code}>
                    {code} — {label}
                  </option>
                ))}
              </select>
            </Field>

            <div className="grid grid-cols-2 gap-3">
              <Field label={reportType === '606' ? 'Total facturado' : 'Monto facturado'}>
                <input
                  type="number"
                  className="w-full border rounded-lg px-3 py-2"
                  value={draft[amountField] ?? ''}
                  disabled={!invoice.extractedData}
                  onChange={(e) => updateLocal(amountField, e.target.value)}
                  onBlur={(e) => persist(amountField, e.target.value)}
                />
              </Field>
              <Field label="ITBIS facturado">
                <input
                  type="number"
                  className="w-full border rounded-lg px-3 py-2"
                  value={draft.itbisFacturado ?? ''}
                  disabled={!invoice.extractedData}
                  onChange={(e) => updateLocal('itbisFacturado', e.target.value)}
                  onBlur={(e) => persist('itbisFacturado', e.target.value)}
                />
              </Field>
            </div>

            {reportType === '606' && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Monto servicios">
                  <input
                    type="number"
                    className="w-full border rounded-lg px-3 py-2"
                    value={draft.montoServicios ?? ''}
                    disabled={!invoice.extractedData}
                    onChange={(e) => updateLocal('montoServicios', e.target.value)}
                    onBlur={(e) => persist('montoServicios', e.target.value)}
                  />
                </Field>
                <Field label="Monto bienes">
                  <input
                    type="number"
                    className="w-full border rounded-lg px-3 py-2"
                    value={draft.montoBienes ?? ''}
                    disabled={!invoice.extractedData}
                    onChange={(e) => updateLocal('montoBienes', e.target.value)}
                    onBlur={(e) => persist('montoBienes', e.target.value)}
                  />
                </Field>
                <Field label="Forma de pago">
                  <select
                    className="w-full border rounded-lg px-3 py-2"
                    value={draft.formaPago || '01'}
                    disabled={!invoice.extractedData}
                    onChange={(e) => persist('formaPago', e.target.value)}
                  >
                    <option value="01">01 Efectivo</option>
                    <option value="02">02 Cheque/Transf</option>
                    <option value="03">03 Tarjeta</option>
                    <option value="04">04 Crédito</option>
                    <option value="05">05 Bonos</option>
                    <option value="06">06 Permuta</option>
                    <option value="07">07 Otras</option>
                  </select>
                </Field>
                <Field label="Propina legal">
                  <input
                    type="number"
                    className="w-full border rounded-lg px-3 py-2"
                    value={draft.montoPropinaLegal ?? ''}
                    disabled={!invoice.extractedData}
                    onChange={(e) => updateLocal('montoPropinaLegal', e.target.value)}
                    onBlur={(e) => persist('montoPropinaLegal', e.target.value)}
                  />
                </Field>
              </div>
            )}

            {reportType === '607' && (
              <div className="grid grid-cols-2 gap-3">
                <Field label="Efectivo">
                  <input
                    type="number"
                    className="w-full border rounded-lg px-3 py-2"
                    value={draft.montoEfectivo ?? ''}
                    disabled={!invoice.extractedData}
                    onChange={(e) => updateLocal('montoEfectivo', e.target.value)}
                    onBlur={(e) => persist('montoEfectivo', e.target.value)}
                  />
                </Field>
                <Field label="Cheque/Transferencia">
                  <input
                    type="number"
                    className="w-full border rounded-lg px-3 py-2"
                    value={draft.montoChequeTransferencia ?? ''}
                    disabled={!invoice.extractedData}
                    onChange={(e) => updateLocal('montoChequeTransferencia', e.target.value)}
                    onBlur={(e) => persist('montoChequeTransferencia', e.target.value)}
                  />
                </Field>
                <Field label="Tarjeta">
                  <input
                    type="number"
                    className="w-full border rounded-lg px-3 py-2"
                    value={draft.montoTarjeta ?? ''}
                    disabled={!invoice.extractedData}
                    onChange={(e) => updateLocal('montoTarjeta', e.target.value)}
                    onBlur={(e) => persist('montoTarjeta', e.target.value)}
                  />
                </Field>
                <Field label="Crédito">
                  <input
                    type="number"
                    className="w-full border rounded-lg px-3 py-2"
                    value={draft.montoVentaCredito ?? ''}
                    disabled={!invoice.extractedData}
                    onChange={(e) => updateLocal('montoVentaCredito', e.target.value)}
                    onBlur={(e) => persist('montoVentaCredito', e.target.value)}
                  />
                </Field>
                <Field label="Propina legal">
                  <input
                    type="number"
                    className="w-full border rounded-lg px-3 py-2"
                    value={draft.montoPropinaLegal ?? ''}
                    disabled={!invoice.extractedData}
                    onChange={(e) => updateLocal('montoPropinaLegal', e.target.value)}
                    onBlur={(e) => persist('montoPropinaLegal', e.target.value)}
                  />
                </Field>
              </div>
            )}

            <Field label="NCF modificado">
              <input
                className="w-full border rounded-lg px-3 py-2"
                value={draft.ncfModificado || ''}
                disabled={!invoice.extractedData}
                onChange={(e) => updateLocal('ncfModificado', e.target.value)}
                onBlur={(e) => persist('ncfModificado', e.target.value)}
              />
            </Field>

            {(!rncCheck.isValid && draft.rncCedula) || (!ncfCheck.isValid && draft.ncf) ? (
              <div className="flex items-start gap-2 text-amber-700 bg-amber-50 border border-amber-100 rounded-lg p-3 text-sm">
                <AlertTriangle size={16} className="mt-0.5 flex-shrink-0" />
                <span>Revisa RNC/Cédula y NCF antes de exportar el lote.</span>
              </div>
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
};

export const BatchWorkspacePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const { tenant, updateCreditBalance } = useAuth();
  const [batch, setBatch] = useState<FiscalBatch | null>(null);
  const [invoices, setInvoices] = useState<InvoiceRecord[]>([]);
  const [exports, setExports] = useState<BatchExport[]>([]);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const [previewId, setPreviewId] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  const pendingCount = useMemo(
    () => invoices.filter((i) => i.status === 'pending' || i.status === 'error').length,
    [invoices]
  );

  const load = async () => {
    if (!id) return;
    setLoading(true);
    try {
      const data = await api<{ batch: FiscalBatch; invoices: InvoiceRecord[] }>(
        `/api/batches/${id}`
      );
      setBatch(data.batch);
      setInvoices(data.invoices);
      const credits = await api<{ balance: number }>('/api/credits');
      updateCreditBalance(credits.balance);
    } catch (err: any) {
      setError(err.message || 'Error cargando lote');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [id]);

  const onUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (!id || !e.target.files?.length) return;
    setUploading(true);
    setError('');
    try {
      const form = new FormData();
      Array.from(e.target.files).forEach((f: File) => form.append('files', f));
      const data = await api<{ invoices: InvoiceRecord[] }>(`/api/batches/${id}/invoices`, {
        method: 'POST',
        body: form,
      });
      setInvoices((prev) => [...prev, ...data.invoices]);
      setMessage(`${data.invoices.length} archivo(s) subidos`);
    } catch (err: any) {
      setError(err.message || 'Error al subir');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const processAll = async () => {
    if (!id) return;
    setProcessing(true);
    setError('');
    setMessage('');
    try {
      const result = await api<{
        processed: number;
        failed: number;
        skippedInsufficientCredits: number;
        balance: number;
      }>(`/api/batches/${id}/invoices/process`, { method: 'POST' });
      updateCreditBalance(result.balance);
      await load();
      setMessage(
        `Procesadas: ${result.processed}. Errores: ${result.failed}.` +
          (result.skippedInsufficientCredits
            ? ` Sin créditos para ${result.skippedInsufficientCredits}.`
            : '')
      );
    } catch (err: any) {
      setError(err.message || 'Error al procesar');
    } finally {
      setProcessing(false);
    }
  };

  const saveField = async (invoiceId: string, field: string, value: any) => {
    const invoice = invoices.find((i) => i.id === invoiceId);
    if (!invoice?.extractedData) return;
    let typedValue = value;
    if (
      [
        'montoPropinaLegal',
        'itbisFacturado',
        'totalFacturado',
        'montoFacturado',
        'montoBienes',
        'montoServicios',
        'otrosImpuestos',
        'montoEfectivo',
        'montoChequeTransferencia',
        'montoTarjeta',
        'montoVentaCredito',
      ].includes(field)
    ) {
      typedValue = parseFloat(value) || 0;
    }
    const extractedData = { ...invoice.extractedData, [field]: typedValue };
    const updated = await api<{ invoice: InvoiceRecord }>(`/api/invoices/${invoiceId}`, {
      method: 'PATCH',
      body: JSON.stringify({ extractedData }),
    });
    setInvoices((prev) => prev.map((i) => (i.id === invoiceId ? updated.invoice : i)));
  };

  const removeInvoice = async (invoiceId: string) => {
    await api(`/api/invoices/${invoiceId}`, { method: 'DELETE' });
    setInvoices((prev) => prev.filter((i) => i.id !== invoiceId));
    if (previewId === invoiceId) setPreviewId(null);
  };

  const saveRnc = async (rncInformante: string) => {
    if (!id) return;
    const data = await api<{ batch: FiscalBatch }>(`/api/batches/${id}`, {
      method: 'PATCH',
      body: JSON.stringify({ rncInformante }),
    });
    setBatch(data.batch);
  };

  const exportBatch = async () => {
    if (!id || !batch) return;
    try {
      await downloadAuthenticated(
        `/api/batches/${id}/export`,
        `Formato_${batch.reportType}_${batch.period}.xlsx`,
        'POST'
      );
      setMessage('Exportación generada');
      const hist = await api<{ exports: BatchExport[] }>(`/api/batches/${id}/exports`);
      setExports(hist.exports);
      await load();
    } catch (err: any) {
      setError(err.message || 'Error al exportar');
    }
  };

  const openHistory = async () => {
    if (!id) return;
    const hist = await api<{ exports: BatchExport[] }>(`/api/batches/${id}/exports`);
    setExports(hist.exports);
    setShowHistory(true);
  };

  const preview = invoices.find((i) => i.id === previewId);
  const labels = batch?.reportType === '607' ? INGRESO_LABELS : GASTO_LABELS;
  const nameField = batch?.reportType === '607' ? 'nombreCliente' : 'nombreSuplidor';
  const catField = batch?.reportType === '607' ? 'tipoIngreso' : 'tipoGasto';
  const amountField = batch?.reportType === '607' ? 'montoFacturado' : 'totalFacturado';

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-indigo-600" size={40} />
      </div>
    );
  }

  if (!batch) {
    return (
      <div className="p-8">
        <p className="text-red-600">{error || 'Lote no encontrado'}</p>
        <Link to="/" className="text-indigo-600 text-sm">
          Volver
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-4 py-3 flex flex-wrap items-center gap-3 justify-between">
        <div className="flex items-center gap-3">
          <Link to="/" className="text-indigo-600 inline-flex items-center gap-1 text-sm">
            <ArrowLeft size={16} /> Lotes
          </Link>
          <div>
            <h1 className="font-bold text-slate-800">
              {batch.reportType} · {batch.period}
            </h1>
            <p className="text-xs text-slate-500">Estado: {batch.status}</p>
          </div>
        </div>
        <div className="flex items-center gap-3 text-sm">
          <Link
            to="/credits"
            className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg"
          >
            <Coins size={14} /> {tenant?.creditBalance ?? 0} créditos
          </Link>
          <button
            onClick={openHistory}
            className="inline-flex items-center gap-1 border px-3 py-1.5 rounded-lg hover:bg-slate-50"
          >
            <History size={14} /> Historial
          </button>
          <button
            onClick={exportBatch}
            className="inline-flex items-center gap-1 bg-emerald-600 text-white px-3 py-1.5 rounded-lg hover:bg-emerald-700"
          >
            <Download size={14} /> Exportar Excel
          </button>
        </div>
      </header>

      <div className="p-4 max-w-7xl mx-auto space-y-4">
        {(message || error) && (
          <div
            className={`rounded-lg p-3 text-sm ${
              error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
            }`}
          >
            {error || message}
          </div>
        )}

        <div className="bg-white border rounded-xl p-4 grid md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs text-slate-500">RNC informante</label>
            <input
              defaultValue={batch.rncInformante}
              onBlur={(e) => saveRnc(e.target.value)}
              className="w-full border rounded-lg px-3 py-2 mt-1"
            />
          </div>
          <div className="flex items-end">
            <label className="w-full cursor-pointer bg-indigo-50 text-indigo-700 border border-indigo-100 rounded-lg px-4 py-2.5 flex items-center justify-center gap-2 hover:bg-indigo-100">
              {uploading ? <Loader2 className="animate-spin" size={16} /> : <FileUp size={16} />}
              Subir facturas
              <input
                type="file"
                accept="image/*,.pdf"
                multiple
                className="hidden"
                onChange={onUpload}
              />
            </label>
          </div>
          <div className="flex items-end">
            <button
              onClick={processAll}
              disabled={processing || pendingCount === 0}
              className="w-full bg-indigo-600 text-white rounded-lg px-4 py-2.5 font-medium flex items-center justify-center gap-2 hover:bg-indigo-700 disabled:opacity-50"
            >
              {processing ? <Loader2 className="animate-spin" size={16} /> : <Play size={16} />}
              Procesar OCR ({pendingCount} · {pendingCount} créd.)
            </button>
          </div>
        </div>

        {(tenant?.creditBalance ?? 0) < pendingCount && pendingCount > 0 && (
          <div className="bg-amber-50 border border-amber-200 text-amber-800 rounded-lg p-3 text-sm">
            Saldo insuficiente para procesar todas las pendientes. Recarga créditos o procesa
            parcialmente.
          </div>
        )}

        <div className="bg-white border rounded-xl overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead className="bg-slate-50 text-slate-500 text-left">
              <tr>
                <th className="p-3">Estado</th>
                <th className="p-3">Archivo</th>
                <th className="p-3">Nombre</th>
                <th className="p-3">RNC/Cédula</th>
                <th className="p-3">NCF</th>
                <th className="p-3">Categoría</th>
                <th className="p-3">Monto</th>
                <th className="p-3">ITBIS</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {invoices.map((inv) => (
                <tr key={`${inv.id}-${inv.updatedAt}`} className="border-t align-top">
                  <td className="p-3">
                    {inv.status === 'completed' && (
                      <CheckCircle className="text-emerald-500" size={16} />
                    )}
                    {inv.status === 'error' && <AlertCircle className="text-red-500" size={16} />}
                    {(inv.status === 'pending' || inv.status === 'processing') && (
                      <span className="text-xs text-slate-400">{inv.status}</span>
                    )}
                  </td>
                  <td className="p-3 text-xs text-slate-500 max-w-[120px] truncate">
                    {inv.originalFilename}
                  </td>
                  <td className="p-2">
                    <input
                      className="border rounded px-2 py-1 w-full"
                      defaultValue={inv.extractedData?.[nameField] || ''}
                      disabled={!inv.extractedData}
                      onBlur={(e) => saveField(inv.id, nameField, e.target.value)}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      className="border rounded px-2 py-1 w-full"
                      defaultValue={inv.extractedData?.rncCedula || ''}
                      disabled={!inv.extractedData}
                      onBlur={(e) => saveField(inv.id, 'rncCedula', e.target.value)}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      className="border rounded px-2 py-1 w-full"
                      defaultValue={inv.extractedData?.ncf || ''}
                      disabled={!inv.extractedData}
                      onBlur={(e) => saveField(inv.id, 'ncf', e.target.value)}
                    />
                  </td>
                  <td className="p-2">
                    <select
                      className="border rounded px-2 py-1 w-full"
                      defaultValue={inv.extractedData?.[catField] || ''}
                      disabled={!inv.extractedData}
                      onChange={(e) => saveField(inv.id, catField, e.target.value)}
                    >
                      <option value="">—</option>
                      {Object.entries(labels).map(([code, label]) => (
                        <option key={code} value={code}>
                          {code} — {label}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      className="border rounded px-2 py-1 w-24"
                      defaultValue={inv.extractedData?.[amountField] ?? ''}
                      disabled={!inv.extractedData}
                      onBlur={(e) => saveField(inv.id, amountField, e.target.value)}
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      className="border rounded px-2 py-1 w-24"
                      defaultValue={inv.extractedData?.itbisFacturado ?? ''}
                      disabled={!inv.extractedData}
                      onBlur={(e) => saveField(inv.id, 'itbisFacturado', e.target.value)}
                    />
                  </td>
                  <td className="p-2 whitespace-nowrap">
                    <button
                      onClick={() => setPreviewId(inv.id)}
                      className="p-1.5 text-indigo-600 hover:bg-indigo-50 rounded"
                      title="Previsualizar y corregir"
                    >
                      <Eye size={16} />
                    </button>
                    <button
                      onClick={() => removeInvoice(inv.id)}
                      className="p-1.5 text-slate-500 hover:text-red-600"
                      title="Eliminar"
                    >
                      <Trash2 size={16} />
                    </button>
                  </td>
                </tr>
              ))}
              {invoices.length === 0 && (
                <tr>
                  <td colSpan={9} className="p-10 text-center text-slate-400">
                    Sube facturas para este lote
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {preview && (
        <InvoiceReviewModal
          invoice={preview}
          reportType={batch.reportType}
          onClose={() => setPreviewId(null)}
          onSaveField={(field, value) => saveField(preview.id, field, value)}
        />
      )}

      {showHistory && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-lg w-full p-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-semibold">Historial de exportaciones</h3>
              <button onClick={() => setShowHistory(false)}>
                <X size={18} />
              </button>
            </div>
            <div className="space-y-2 max-h-80 overflow-auto">
              {exports.map((ex) => (
                <div
                  key={ex.id}
                  className="border rounded-lg p-3 flex items-center justify-between gap-2 text-sm"
                >
                  <div>
                    <div className="font-medium">
                      v{ex.version} · {ex.recordCount} registros
                    </div>
                    <div className="text-slate-500 text-xs">
                      {new Date(ex.exportedAt).toLocaleString()}
                    </div>
                  </div>
                  <button
                    className="text-indigo-600 inline-flex items-center gap-1"
                    onClick={() =>
                      downloadAuthenticated(`/api/exports/${ex.id}/download`, ex.filename)
                    }
                  >
                    <Download size={14} /> Descargar
                  </button>
                </div>
              ))}
              {exports.length === 0 && (
                <p className="text-slate-400 text-sm text-center py-6">Sin exportaciones aún</p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
