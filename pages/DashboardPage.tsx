import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Coins,
  FileSpreadsheet,
  LayoutDashboard,
  Loader2,
  LogOut,
  PieChart,
  Plus,
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import type { FiscalBatch } from '../types';

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export const DashboardPage: React.FC = () => {
  const { user, tenant, logout, updateCreditBalance } = useAuth();
  const navigate = useNavigate();
  const [batches, setBatches] = useState<FiscalBatch[]>([]);
  const [period, setPeriod] = useState(currentPeriod);
  const [reportType, setReportType] = useState<'606' | '607'>('606');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const data = await api<{ batches: FiscalBatch[] }>(`/api/batches?period=${period}`);
      setBatches(data.batches);
      const credits = await api<{ balance: number }>('/api/credits');
      updateCreditBalance(credits.balance);
    } catch (err: any) {
      setError(err.message || 'Error cargando lotes');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [period]);

  const createBatch = async () => {
    setCreating(true);
    setError('');
    try {
      const data = await api<{ batch: FiscalBatch }>('/api/batches', {
        method: 'POST',
        body: JSON.stringify({
          reportType,
          period,
          rncInformante: tenant?.rnc || '',
        }),
      });
      navigate(`/batches/${data.batch.id}`);
    } catch (err: any) {
      setError(err.message || 'No se pudo crear el lote');
    } finally {
      setCreating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col md:flex-row">
      <aside className="w-full md:w-64 bg-indigo-900 text-white flex-shrink-0">
        <div className="p-6">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <PieChart className="text-indigo-400" />
            FiscalSmart
          </h1>
          <p className="text-indigo-300 text-xs mt-1 uppercase tracking-wider font-semibold">
            {tenant?.name}
          </p>
        </div>
        <nav className="px-4 space-y-1">
          <Link
            to="/"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-800 text-sm"
          >
            <LayoutDashboard size={16} /> Lotes
          </Link>
          <Link
            to="/credits"
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-indigo-800 text-sm"
          >
            <Coins size={16} /> Créditos
          </Link>
          <button
            onClick={async () => {
              await logout();
              navigate('/login');
            }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-indigo-800 text-sm text-left"
          >
            <LogOut size={16} /> Salir
          </button>
        </nav>
        <div className="p-4 mt-auto">
          <div className="bg-indigo-800/60 rounded-xl p-3 text-sm">
            <div className="text-indigo-200 text-xs">Créditos</div>
            <div className="text-xl font-bold flex items-center gap-2">
              <Coins size={18} className="text-amber-300" />
              {tenant?.creditBalance ?? 0}
            </div>
            <div className="text-indigo-300 text-xs mt-1">{user?.email}</div>
          </div>
        </div>
      </aside>

      <main className="flex-1 p-6">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Lotes fiscales</h2>
            <p className="text-slate-500 text-sm">Un lote por periodo y tipo (606/607)</p>
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Periodo (YYYYMM)</label>
              <input
                value={period}
                onChange={(e) => setPeriod(e.target.value)}
                className="border rounded-lg px-3 py-2 w-32"
                maxLength={6}
              />
            </div>
            <div>
              <label className="block text-xs text-slate-500 mb-1">Tipo</label>
              <select
                value={reportType}
                onChange={(e) => setReportType(e.target.value as '606' | '607')}
                className="border rounded-lg px-3 py-2"
              >
                <option value="606">606 Compras</option>
                <option value="607">607 Ventas</option>
              </select>
            </div>
            <button
              onClick={createBatch}
              disabled={creating}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-indigo-700 disabled:opacity-60"
            >
              {creating ? <Loader2 className="animate-spin" size={16} /> : <Plus size={16} />}
              Abrir / Crear lote
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg p-3">
            {error}
          </div>
        )}

        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-indigo-600" size={36} />
          </div>
        ) : batches.length === 0 ? (
          <div className="bg-white border rounded-xl p-12 text-center text-slate-400">
            No hay lotes para {period}. Crea uno para empezar.
          </div>
        ) : (
          <div className="grid gap-3">
            {batches.map((b) => (
              <button
                key={b.id}
                onClick={() => navigate(`/batches/${b.id}`)}
                className="bg-white border rounded-xl p-4 text-left hover:border-indigo-300 hover:shadow-sm transition flex items-center justify-between gap-4"
              >
                <div>
                  <div className="font-semibold text-slate-800 flex items-center gap-2">
                    <FileSpreadsheet size={18} className="text-indigo-600" />
                    Formato {b.reportType} · Periodo {b.period}
                  </div>
                  <div className="text-sm text-slate-500 mt-1">
                    RNC {b.rncInformante || '—'} · {b.completedCount ?? 0}/{b.invoiceCount ?? 0}{' '}
                    facturas · estado {b.status}
                    {b.latestExportVersion
                      ? ` · export v${b.latestExportVersion}`
                      : ''}
                  </div>
                </div>
                <span className="text-indigo-600 text-sm font-medium">Abrir →</span>
              </button>
            ))}
          </div>
        )}
      </main>
    </div>
  );
};
