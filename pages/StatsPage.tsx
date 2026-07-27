import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  BarChart3,
  Coins,
  LayoutDashboard,
  Loader2,
  LogOut,
  PieChart,
  RefreshCw,
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import type { It1BreakdownRow, It1Stats } from '../types';

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function money(n: number) {
  return n.toLocaleString('es-DO', {
    style: 'currency',
    currency: 'DOP',
    minimumFractionDigits: 2,
  });
}

const KpiCard: React.FC<{
  label: string;
  value: string;
  hint?: string;
  accent?: 'default' | 'positive' | 'negative' | 'neutral';
}> = ({ label, value, hint, accent = 'default' }) => {
  const valueColor =
    accent === 'positive'
      ? 'text-emerald-700'
      : accent === 'negative'
        ? 'text-rose-700'
        : accent === 'neutral'
          ? 'text-slate-700'
          : 'text-indigo-700';
  return (
    <div className="bg-white border rounded-xl p-4">
      <div className="text-xs text-slate-500 uppercase tracking-wide">{label}</div>
      <div className={`text-xl font-bold mt-1 ${valueColor}`}>{value}</div>
      {hint ? <div className="text-xs text-slate-400 mt-1">{hint}</div> : null}
    </div>
  );
};

const MetricRow: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="flex justify-between gap-4 py-1.5 text-sm border-b border-slate-100 last:border-0">
    <span className="text-slate-600">{label}</span>
    <span className="font-medium text-slate-800 tabular-nums">{money(value)}</span>
  </div>
);

const BreakdownTable: React.FC<{ title: string; rows: It1BreakdownRow[] }> = ({
  title,
  rows,
}) => (
  <div className="bg-white border rounded-xl overflow-hidden">
    <div className="px-4 py-3 border-b bg-slate-50">
      <h3 className="font-semibold text-slate-800 text-sm">{title}</h3>
    </div>
    {rows.length === 0 ? (
      <div className="p-6 text-sm text-slate-400 text-center">Sin datos</div>
    ) : (
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-xs text-slate-500 border-b">
              <th className="px-4 py-2 font-medium">Código</th>
              <th className="px-4 py-2 font-medium">Descripción</th>
              <th className="px-4 py-2 font-medium text-right">Cant.</th>
              <th className="px-4 py-2 font-medium text-right">Total</th>
              <th className="px-4 py-2 font-medium text-right">ITBIS</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={`${r.code}-${r.label}`} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-2 font-mono text-xs text-slate-500">{r.code}</td>
                <td className="px-4 py-2 text-slate-700">{r.label}</td>
                <td className="px-4 py-2 text-right tabular-nums">{r.count}</td>
                <td className="px-4 py-2 text-right tabular-nums">{money(r.total)}</td>
                <td className="px-4 py-2 text-right tabular-nums">{money(r.itbis)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    )}
  </div>
);

export const StatsPage: React.FC = () => {
  const { user, tenant, company, logout, updateCreditBalance } = useAuth();
  const navigate = useNavigate();
  const [period, setPeriod] = useState(currentPeriod);
  const [stats, setStats] = useState<It1Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const load = async () => {
    if (!/^\d{6}$/.test(period)) {
      setError('Periodo inválido (YYYYMM)');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const data = await api<It1Stats>(`/api/stats?period=${period}`);
      setStats(data);
      const credits = await api<{ balance: number }>('/api/credits');
      updateCreditBalance(credits.balance);
    } catch (err: any) {
      setError(err.message || 'Error cargando estadísticas');
      setStats(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, [period, company?.id]);

  const hasData =
    stats && (stats.ops.count606 > 0 || stats.ops.count607 > 0 || stats.ops.completed > 0);

  const itbisAccent =
    !stats
      ? 'default'
      : stats.kpis.itbisAPagar > 0
        ? 'negative'
        : stats.kpis.itbisAPagar < 0
          ? 'positive'
          : 'neutral';

  const itbisLabel =
    !stats
      ? 'ITBIS a pagar'
      : stats.kpis.itbisAPagar > 0
        ? 'ITBIS a pagar'
        : stats.kpis.itbisAPagar < 0
          ? 'Saldo a favor'
          : 'ITBIS neto';

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
          {company ? (
            <p className="text-indigo-400 text-xs mt-1 normal-case tracking-normal">
              {company.name}
            </p>
          ) : null}
        </div>
        <nav className="px-4 space-y-1">
          <Link
            to="/"
            className="flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-indigo-800 text-sm"
          >
            <LayoutDashboard size={16} /> Lotes
          </Link>
          <Link
            to="/stats"
            className="flex items-center gap-2 px-3 py-2 rounded-lg bg-indigo-800 text-sm"
          >
            <BarChart3 size={16} /> IT1
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
            <LogOut size={16} /> Cerrar sesión
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

      <main className="flex-1 p-6 max-w-6xl">
        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Resumen IT1</h2>
            <p className="text-slate-500 text-sm">
              Consolidado DGII de reportes 606 (compras) y 607 (ventas)
              {stats?.rncInformante ? ` · RNC ${stats.rncInformante}` : ''}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="block text-xs text-slate-500 mb-1">Periodo (YYYYMM)</label>
              <input
                value={period}
                onChange={(e) => setPeriod(e.target.value.replace(/\D/g, '').slice(0, 6))}
                className="border rounded-lg px-3 py-2 w-32"
                maxLength={6}
              />
            </div>
            <button
              onClick={load}
              disabled={loading}
              className="bg-indigo-600 text-white px-4 py-2 rounded-lg font-medium flex items-center gap-2 hover:bg-indigo-700 disabled:opacity-60"
            >
              {loading ? (
                <Loader2 className="animate-spin" size={16} />
              ) : (
                <RefreshCw size={16} />
              )}
              Actualizar
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-4 text-sm text-red-700 bg-red-50 border border-red-100 rounded-lg p-3">
            {error}
          </div>
        )}

        {loading && !stats ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-indigo-600" size={36} />
          </div>
        ) : !hasData ? (
          <div className="bg-white border rounded-xl p-12 text-center text-slate-400">
            No hay facturas completadas para el periodo {period}. Procesa lotes 606/607
            primero.
          </div>
        ) : stats ? (
          <div className="space-y-6">
            <div className="grid grid-cols-2 md:grid-cols-5 gap-3 text-sm">
              <div className="bg-white border rounded-xl p-3">
                <div className="text-xs text-slate-500">Docs 606</div>
                <div className="text-lg font-bold text-slate-800">{stats.ops.count606}</div>
              </div>
              <div className="bg-white border rounded-xl p-3">
                <div className="text-xs text-slate-500">Docs 607</div>
                <div className="text-lg font-bold text-slate-800">{stats.ops.count607}</div>
              </div>
              <div className="bg-white border rounded-xl p-3">
                <div className="text-xs text-slate-500">Completadas</div>
                <div className="text-lg font-bold text-slate-800">{stats.ops.completed}</div>
              </div>
              <div className="bg-white border rounded-xl p-3">
                <div className="text-xs text-slate-500">Pendientes</div>
                <div className="text-lg font-bold text-amber-700">{stats.ops.pending}</div>
              </div>
              <div className="bg-white border rounded-xl p-3">
                <div className="text-xs text-slate-500">Errores</div>
                <div className="text-lg font-bold text-rose-700">{stats.ops.error}</div>
              </div>
            </div>

            <div className="grid md:grid-cols-3 lg:grid-cols-5 gap-3">
              <KpiCard label="Total compras" value={money(stats.kpis.totalCompras)} />
              <KpiCard label="Total ventas" value={money(stats.kpis.totalVentas)} />
              <KpiCard label="ITBIS crédito" value={money(stats.kpis.itbisCredito)} hint="606" />
              <KpiCard
                label="ITBIS generado"
                value={money(stats.kpis.itbisGenerado)}
                hint="607"
              />
              <KpiCard
                label={itbisLabel}
                value={money(Math.abs(stats.kpis.itbisAPagar))}
                hint={`Generado − crédito − retenido (${money(stats.kpis.itbisRetenido606)})`}
                accent={itbisAccent}
              />
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div className="bg-white border rounded-xl p-4">
                <h3 className="font-semibold text-slate-800 mb-3">606 — Compras</h3>
                <MetricRow label="Monto bienes" value={stats.compras606.montoBienes} />
                <MetricRow label="Monto servicios" value={stats.compras606.montoServicios} />
                <MetricRow label="Total facturado" value={stats.compras606.totalFacturado} />
                <MetricRow label="ITBIS facturado" value={stats.compras606.itbisFacturado} />
                <MetricRow label="ITBIS retenido" value={stats.compras606.itbisRetenido} />
                <MetricRow
                  label="ITBIS sujeto a proporcionalidad"
                  value={stats.compras606.itbisSujetoACosto}
                />
                <MetricRow
                  label="ITBIS por adelantar"
                  value={stats.compras606.itbisPorAdelantar}
                />
                <MetricRow
                  label="ITBIS percibido en compras"
                  value={stats.compras606.itbisPercibidoenCompras}
                />
                <MetricRow
                  label="Retención ISR"
                  value={stats.compras606.montoRetencionISR}
                />
                <MetricRow
                  label="ISR percibido"
                  value={stats.compras606.isrPercibidoenCompras}
                />
                <MetricRow
                  label="ISC"
                  value={stats.compras606.impuestoSelectivoConsumo}
                />
                <MetricRow label="Otros impuestos" value={stats.compras606.otrosImpuestos} />
                <MetricRow
                  label="Propina legal"
                  value={stats.compras606.montoPropinaLegal}
                />
              </div>

              <div className="bg-white border rounded-xl p-4">
                <h3 className="font-semibold text-slate-800 mb-3">607 — Ventas</h3>
                <MetricRow label="Monto facturado" value={stats.ventas607.montoFacturado} />
                <MetricRow label="ITBIS facturado" value={stats.ventas607.itbisFacturado} />
                <MetricRow
                  label="ITBIS retenido por terceros"
                  value={stats.ventas607.itbisRetenidoPorTerceros}
                />
                <MetricRow label="ITBIS percibido" value={stats.ventas607.itbisPercibido} />
                <MetricRow
                  label="Retención renta por terceros"
                  value={stats.ventas607.retencionRentaPorTerceros}
                />
                <MetricRow label="ISR percibido" value={stats.ventas607.isrPercibido} />
                <MetricRow
                  label="ISC"
                  value={stats.ventas607.impuestoSelectivoConsumo}
                />
                <MetricRow label="Otros impuestos" value={stats.ventas607.otrosImpuestos} />
                <MetricRow
                  label="Propina legal"
                  value={stats.ventas607.montoPropinaLegal}
                />
                <div className="mt-3 pt-2 border-t border-slate-100">
                  <div className="text-xs font-semibold text-slate-500 uppercase mb-1">
                    Formas de pago
                  </div>
                  <MetricRow label="Efectivo" value={stats.ventas607.montoEfectivo} />
                  <MetricRow
                    label="Cheque / transferencia"
                    value={stats.ventas607.montoChequeTransferencia}
                  />
                  <MetricRow label="Tarjeta" value={stats.ventas607.montoTarjeta} />
                  <MetricRow label="Crédito" value={stats.ventas607.montoVentaCredito} />
                  <MetricRow label="Bonos" value={stats.ventas607.montoBonos} />
                  <MetricRow label="Permuta" value={stats.ventas607.montoPermuta} />
                  <MetricRow label="Otras formas" value={stats.ventas607.montoOtrasFormas} />
                </div>
              </div>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <BreakdownTable title="Por tipo de gasto (606)" rows={stats.byTipoGasto} />
              <BreakdownTable title="Por tipo de ingreso (607)" rows={stats.byTipoIngreso} />
              <BreakdownTable title="Por forma de pago (606)" rows={stats.byFormaPago606} />
              <BreakdownTable title="Por tipo NCF (606)" rows={stats.byNcfPrefix606} />
              <BreakdownTable title="Por tipo NCF (607)" rows={stats.byNcfPrefix607} />
            </div>
          </div>
        ) : null}
      </main>
    </div>
  );
};
