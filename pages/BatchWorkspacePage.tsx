import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle,
  Coins,
  Download,
  Eye,
  FileUp,
  History,
  Loader2,
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
          <Link to="/credits" className="inline-flex items-center gap-1 text-amber-700 bg-amber-50 px-3 py-1.5 rounded-lg">
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
              <input type="file" accept="image/*,.pdf" multiple className="hidden" onChange={onUpload} />
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
            Saldo insuficiente para procesar todas las pendientes. Recarga créditos o procesa parcialmente.
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
                <tr key={inv.id} className="border-t align-top">
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
                      className="p-1.5 text-slate-500 hover:text-indigo-600"
                      title="Vista previa"
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
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl max-w-4xl w-full max-h-[90vh] overflow-auto p-4 relative">
            <button
              className="absolute top-3 right-3 text-slate-500"
              onClick={() => setPreviewId(null)}
            >
              <X />
            </button>
            <h3 className="font-semibold mb-3">{preview.originalFilename}</h3>
            {preview.error && (
              <p className="text-sm text-red-600 mb-2">{preview.error}</p>
            )}
            <img
              src={preview.previewUrl}
              alt="preview"
              className="max-w-full rounded border"
            />
          </div>
        </div>
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
                    <div className="font-medium">v{ex.version} · {ex.recordCount} registros</div>
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
