import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Coins,
  KeyRound,
  Loader2,
  LogOut,
  RefreshCw,
  Search,
  Shield,
} from 'lucide-react';
import type { CreditLedgerEntry } from '../types';

const SECRET_KEY = 'fs_admin_secret';

interface AdminTenant {
  tenantId: string;
  name: string;
  rnc: string;
  creditBalance: number;
  createdAt: string;
  ownerEmail?: string;
  ownerName?: string;
}

interface UsageRow {
  tenantId: string;
  name: string;
  rnc: string;
  creditsUsed: number;
  creditsAdded: number;
}

async function adminFetch<T>(
  path: string,
  secret: string,
  options: RequestInit = {}
): Promise<T> {
  const headers = new Headers(options.headers || {});
  headers.set('x-admin-secret', secret);
  if (options.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }
  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    throw new Error(data.error || `HTTP ${res.status}`);
  }
  return data as T;
}

export const AdminCreditsPage: React.FC = () => {
  const [secretInput, setSecretInput] = useState('');
  const [secret, setSecret] = useState(() => sessionStorage.getItem(SECRET_KEY) || '');
  const [tenants, setTenants] = useState<AdminTenant[]>([]);
  const [usage, setUsage] = useState<UsageRow[]>([]);
  const [ledger, setLedger] = useState<CreditLedgerEntry[]>([]);
  const [selectedTenantId, setSelectedTenantId] = useState('');
  const [query, setQuery] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [credits, setCredits] = useState('50');
  const [note, setNote] = useState('');
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [granting, setGranting] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const unlock = (e: React.FormEvent) => {
    e.preventDefault();
    const value = secretInput.trim();
    if (!value) return;
    sessionStorage.setItem(SECRET_KEY, value);
    setSecret(value);
    setSecretInput('');
  };

  const lock = () => {
    sessionStorage.removeItem(SECRET_KEY);
    setSecret('');
    setTenants([]);
    setUsage([]);
    setLedger([]);
  };

  const load = useCallback(async () => {
    if (!secret) return;
    setLoading(true);
    setError('');
    try {
      const qs = new URLSearchParams();
      if (from) qs.set('from', from);
      if (to) qs.set('to', to);
      const [tenantsRes, usageRes] = await Promise.all([
        adminFetch<{ tenants: AdminTenant[] }>('/api/admin/credits/tenants', secret),
        adminFetch<{ rows: UsageRow[] }>(
          `/api/admin/credits/usage${qs.toString() ? `?${qs}` : ''}`,
          secret
        ),
      ]);
      setTenants(tenantsRes.tenants);
      setUsage(usageRes.rows);
    } catch (err: any) {
      setError(err.message || 'Error cargando datos');
      if (String(err.message).includes('inválido') || String(err.message).includes('401')) {
        lock();
      }
    } finally {
      setLoading(false);
    }
  }, [secret, from, to]);

  useEffect(() => {
    if (secret) load();
  }, [secret, load]);

  const loadLedger = async (tenantId: string) => {
    setSelectedTenantId(tenantId);
    try {
      const data = await adminFetch<{ entries: CreditLedgerEntry[] }>(
        `/api/admin/credits/tenants/${tenantId}/ledger`,
        secret
      );
      setLedger(data.entries);
      const t = tenants.find((x) => x.tenantId === tenantId);
      if (t?.ownerEmail) setEmail(t.ownerEmail);
    } catch (err: any) {
      setError(err.message || 'Error cargando ledger');
    }
  };

  const grant = async (e: React.FormEvent) => {
    e.preventDefault();
    setGranting(true);
    setMessage('');
    setError('');
    try {
      const body: Record<string, unknown> = {
        credits: Number(credits),
        note,
      };
      if (selectedTenantId) body.tenantId = selectedTenantId;
      else if (email.trim()) body.email = email.trim();
      else throw new Error('Selecciona un tenant o indica un email');

      const result = await adminFetch<{ tenantId: string; balance: number }>(
        '/api/admin/credits/grant',
        secret,
        { method: 'POST', body: JSON.stringify(body) }
      );
      setMessage(`Créditos otorgados. Nuevo saldo: ${result.balance}`);
      setNote('');
      await load();
      if (result.tenantId) await loadLedger(result.tenantId);
    } catch (err: any) {
      setError(err.message || 'No se pudo otorgar');
    } finally {
      setGranting(false);
    }
  };

  const filtered = tenants.filter((t) => {
    const q = query.toLowerCase();
    if (!q) return true;
    return (
      t.name.toLowerCase().includes(q) ||
      (t.ownerEmail || '').toLowerCase().includes(q) ||
      (t.rnc || '').includes(q)
    );
  });

  if (!secret) {
    return (
      <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
        <form
          onSubmit={unlock}
          className="bg-white rounded-2xl shadow-xl w-full max-w-md p-8 space-y-4"
        >
          <div className="flex items-center gap-2 text-slate-800">
            <Shield className="text-indigo-600" />
            <h1 className="text-xl font-bold">Admin · Créditos</h1>
          </div>
          <p className="text-sm text-slate-500">
            Ingresa el <code className="bg-slate-100 px-1 rounded">ADMIN_SECRET</code> configurado
            en Railway.
          </p>
          <div>
            <label className="text-sm text-slate-600 mb-1 block">Admin secret</label>
            <input
              type="password"
              value={secretInput}
              onChange={(e) => setSecretInput(e.target.value)}
              className="w-full border rounded-lg px-3 py-2"
              autoFocus
              required
            />
          </div>
          <button
            type="submit"
            className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-semibold hover:bg-indigo-700 flex items-center justify-center gap-2"
          >
            <KeyRound size={16} /> Entrar
          </button>
          <Link to="/login" className="block text-center text-sm text-indigo-600">
            Volver al login
          </Link>
        </form>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Shield className="text-indigo-600" size={20} />
          <h1 className="font-bold text-slate-800">Admin · Gestión de créditos</h1>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => load()}
            className="inline-flex items-center gap-1 border px-3 py-1.5 rounded-lg text-sm hover:bg-slate-50"
          >
            <RefreshCw size={14} /> Actualizar
          </button>
          <button
            onClick={lock}
            className="inline-flex items-center gap-1 border px-3 py-1.5 rounded-lg text-sm hover:bg-slate-50"
          >
            <LogOut size={14} /> Cerrar
          </button>
        </div>
      </header>

      <div className="max-w-6xl mx-auto p-4 space-y-4">
        {(message || error) && (
          <div
            className={`rounded-lg p-3 text-sm ${
              error ? 'bg-red-50 text-red-700' : 'bg-emerald-50 text-emerald-700'
            }`}
          >
            {error || message}
          </div>
        )}

        <div className="grid lg:grid-cols-2 gap-4">
          <form onSubmit={grant} className="bg-white border rounded-xl p-4 space-y-3">
            <h2 className="font-semibold text-slate-800 flex items-center gap-2">
              <Coins className="text-amber-500" size={18} /> Otorgar créditos
            </h2>
            <div>
              <label className="text-xs text-slate-500">Email del usuario (owner)</label>
              <input
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setSelectedTenantId('');
                }}
                className="w-full border rounded-lg px-3 py-2 mt-1"
                placeholder="cliente@empresa.com"
              />
            </div>
            {selectedTenantId && (
              <p className="text-xs text-indigo-600">
                Tenant seleccionado: {selectedTenantId.slice(0, 8)}…
              </p>
            )}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500">Cantidad</label>
                <input
                  type="number"
                  min={1}
                  value={credits}
                  onChange={(e) => setCredits(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 mt-1"
                  required
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Nota / factura</label>
                <input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 mt-1"
                  placeholder="Factura 001"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={granting}
              className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {granting ? <Loader2 className="animate-spin" size={16} /> : <Coins size={16} />}
              Otorgar
            </button>
          </form>

          <div className="bg-white border rounded-xl p-4 space-y-3">
            <h2 className="font-semibold text-slate-800">Uso por periodo</h2>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-slate-500">Desde</label>
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 mt-1"
                />
              </div>
              <div>
                <label className="text-xs text-slate-500">Hasta</label>
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2 mt-1"
                />
              </div>
            </div>
            <div className="overflow-auto max-h-56 border rounded-lg">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-left sticky top-0">
                  <tr>
                    <th className="p-2">Empresa</th>
                    <th className="p-2">Usados</th>
                    <th className="p-2">Agregados</th>
                  </tr>
                </thead>
                <tbody>
                  {usage.map((row) => (
                    <tr key={row.tenantId} className="border-t">
                      <td className="p-2">{row.name}</td>
                      <td className="p-2 text-red-600">{row.creditsUsed}</td>
                      <td className="p-2 text-green-600">{row.creditsAdded}</td>
                    </tr>
                  ))}
                  {usage.length === 0 && (
                    <tr>
                      <td colSpan={3} className="p-4 text-center text-slate-400">
                        Sin datos
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div className="bg-white border rounded-xl p-4">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-3">
            <h2 className="font-semibold text-slate-800">Tenants / usuarios</h2>
            <div className="relative">
              <Search size={14} className="absolute left-3 top-2.5 text-slate-400" />
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar empresa, email, RNC…"
                className="border rounded-lg pl-8 pr-3 py-1.5 text-sm w-64"
              />
            </div>
          </div>

          {loading ? (
            <div className="py-10 flex justify-center">
              <Loader2 className="animate-spin text-indigo-600" />
            </div>
          ) : (
            <div className="overflow-auto">
              <table className="w-full text-sm min-w-[700px]">
                <thead className="bg-slate-50 text-slate-500 text-left">
                  <tr>
                    <th className="p-3">Empresa</th>
                    <th className="p-3">Owner</th>
                    <th className="p-3">RNC</th>
                    <th className="p-3">Saldo</th>
                    <th className="p-3"></th>
                  </tr>
                </thead>
                <tbody>
                  {filtered.map((t) => (
                    <tr
                      key={t.tenantId}
                      className={`border-t ${
                        selectedTenantId === t.tenantId ? 'bg-indigo-50' : ''
                      }`}
                    >
                      <td className="p-3 font-medium text-slate-800">{t.name}</td>
                      <td className="p-3">
                        <div>{t.ownerName || '—'}</div>
                        <div className="text-xs text-slate-500">{t.ownerEmail || '—'}</div>
                      </td>
                      <td className="p-3">{t.rnc || '—'}</td>
                      <td className="p-3 font-semibold">{t.creditBalance}</td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          onClick={() => loadLedger(t.tenantId)}
                          className="text-indigo-600 hover:underline"
                        >
                          Seleccionar
                        </button>
                      </td>
                    </tr>
                  ))}
                  {filtered.length === 0 && (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-slate-400">
                        No hay tenants
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {selectedTenantId && (
          <div className="bg-white border rounded-xl p-4">
            <h2 className="font-semibold text-slate-800 mb-3">Ledger del tenant</h2>
            <div className="overflow-auto max-h-72">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-left sticky top-0">
                  <tr>
                    <th className="p-2">Fecha</th>
                    <th className="p-2">Motivo</th>
                    <th className="p-2">Delta</th>
                    <th className="p-2">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {ledger.map((e) => (
                    <tr key={e.id} className="border-t">
                      <td className="p-2">{new Date(e.createdAt).toLocaleString()}</td>
                      <td className="p-2">{e.reason}</td>
                      <td
                        className={`p-2 font-medium ${
                          e.delta < 0 ? 'text-red-600' : 'text-green-600'
                        }`}
                      >
                        {e.delta > 0 ? `+${e.delta}` : e.delta}
                      </td>
                      <td className="p-2">{e.balanceAfter}</td>
                    </tr>
                  ))}
                  {ledger.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-slate-400">
                        Sin movimientos
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
