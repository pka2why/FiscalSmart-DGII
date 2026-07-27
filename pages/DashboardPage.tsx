import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  Building2,
  Coins,
  FileSpreadsheet,
  LayoutDashboard,
  Loader2,
  LogOut,
  PieChart,
  Plus,
  Trash2,
  UserPlus,
  Users,
} from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import type { Company, CompanyMember, FiscalBatch } from '../types';

function currentPeriod() {
  const d = new Date();
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`;
}

export const DashboardPage: React.FC = () => {
  const {
    user,
    tenant,
    company,
    companies,
    logout,
    switchCompany,
    refresh,
    updateCreditBalance,
  } = useAuth();
  const navigate = useNavigate();
  const [batches, setBatches] = useState<FiscalBatch[]>([]);
  const [period, setPeriod] = useState(currentPeriod);
  const [reportType, setReportType] = useState<'606' | '607'>('606');
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [switching, setSwitching] = useState(false);
  const [error, setError] = useState('');

  const [showCreateCompany, setShowCreateCompany] = useState(false);
  const [newCompanyName, setNewCompanyName] = useState('');
  const [newCompanyRnc, setNewCompanyRnc] = useState('');
  const [creatingCompany, setCreatingCompany] = useState(false);

  const [showMembers, setShowMembers] = useState(false);
  const [members, setMembers] = useState<CompanyMember[]>([]);
  const [membersLoading, setMembersLoading] = useState(false);
  const [memberForm, setMemberForm] = useState({
    email: '',
    name: '',
    password: '',
    role: 'member' as 'owner' | 'member',
  });
  const [addingMember, setAddingMember] = useState(false);

  const isTenantOwner = user?.tenantRole === 'owner';
  const isCompanyOwner = company?.role === 'owner';

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
  }, [period, company?.id]);

  const createBatch = async () => {
    setCreating(true);
    setError('');
    try {
      const data = await api<{ batch: FiscalBatch }>('/api/batches', {
        method: 'POST',
        body: JSON.stringify({
          reportType,
          period,
          rncInformante: company?.rnc || '',
        }),
      });
      navigate(`/batches/${data.batch.id}`);
    } catch (err: any) {
      setError(err.message || 'No se pudo crear el lote');
    } finally {
      setCreating(false);
    }
  };

  const onSwitchCompany = async (companyId: string) => {
    if (companyId === company?.id) return;
    setSwitching(true);
    setError('');
    try {
      await switchCompany(companyId);
    } catch (err: any) {
      setError(err.message || 'No se pudo cambiar de empresa');
    } finally {
      setSwitching(false);
    }
  };

  const createCompany = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreatingCompany(true);
    setError('');
    try {
      const data = await api<{ company: Company }>('/api/companies', {
        method: 'POST',
        body: JSON.stringify({ name: newCompanyName, rnc: newCompanyRnc }),
      });
      setShowCreateCompany(false);
      setNewCompanyName('');
      setNewCompanyRnc('');
      await switchCompany(data.company.id);
      await refresh();
    } catch (err: any) {
      setError(err.message || 'No se pudo crear la empresa');
    } finally {
      setCreatingCompany(false);
    }
  };

  const loadMembers = async () => {
    if (!company) return;
    setMembersLoading(true);
    try {
      const data = await api<{ members: CompanyMember[] }>(
        `/api/companies/${company.id}/members`
      );
      setMembers(data.members);
    } catch (err: any) {
      setError(err.message || 'Error cargando miembros');
    } finally {
      setMembersLoading(false);
    }
  };

  useEffect(() => {
    if (showMembers) loadMembers();
  }, [showMembers, company?.id]);

  const addMember = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!company) return;
    setAddingMember(true);
    setError('');
    try {
      await api(`/api/companies/${company.id}/members`, {
        method: 'POST',
        body: JSON.stringify(memberForm),
      });
      setMemberForm({ email: '', name: '', password: '', role: 'member' });
      await loadMembers();
    } catch (err: any) {
      setError(err.message || 'No se pudo agregar el miembro');
    } finally {
      setAddingMember(false);
    }
  };

  const removeMember = async (userId: string) => {
    if (!company) return;
    setError('');
    try {
      await api(`/api/companies/${company.id}/members/${userId}`, {
        method: 'DELETE',
      });
      await loadMembers();
    } catch (err: any) {
      setError(err.message || 'No se pudo quitar el miembro');
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

        <div className="px-4 mb-4">
          <label className="block text-indigo-300 text-xs mb-1 font-medium">
            Empresa activa
          </label>
          <div className="relative">
            <Building2
              size={14}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-indigo-300"
            />
            <select
              value={company?.id || ''}
              disabled={switching || companies.length === 0}
              onChange={(e) => onSwitchCompany(e.target.value)}
              className="w-full bg-indigo-800 text-white text-sm rounded-lg pl-8 pr-3 py-2 border border-indigo-700"
            >
              {companies.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>
          {company?.rnc ? (
            <p className="text-indigo-400 text-xs mt-1">RNC {company.rnc}</p>
          ) : null}
          <div className="flex flex-wrap gap-2 mt-2">
            {isTenantOwner && (
              <button
                type="button"
                onClick={() => setShowCreateCompany((v) => !v)}
                className="text-xs text-indigo-200 hover:text-white flex items-center gap-1"
              >
                <Plus size={12} /> Nueva empresa
              </button>
            )}
            {company && (
              <button
                type="button"
                onClick={() => setShowMembers((v) => !v)}
                className="text-xs text-indigo-200 hover:text-white flex items-center gap-1"
              >
                <Users size={12} /> Miembros
              </button>
            )}
          </div>
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
              navigate('/');
            }}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg hover:bg-indigo-800 text-sm text-left"
          >
            <LogOut size={16} /> Cerrar sesión
          </button>
        </nav>
        <div className="p-4 mt-auto">
          <div className="bg-indigo-800/60 rounded-xl p-3 text-sm">
            <div className="text-indigo-200 text-xs">Créditos (tenant)</div>
            <div className="text-xl font-bold flex items-center gap-2">
              <Coins size={18} className="text-amber-300" />
              {tenant?.creditBalance ?? 0}
            </div>
            <div className="text-indigo-300 text-xs mt-1">{user?.email}</div>
          </div>
        </div>
      </aside>

      <main className="flex-1 p-6">
        <div className="flex md:hidden justify-end mb-3">
          <button
            onClick={async () => {
              await logout();
              navigate('/');
            }}
            className="inline-flex items-center gap-2 text-sm text-slate-600 border rounded-lg px-3 py-1.5 hover:bg-white"
          >
            <LogOut size={14} /> Cerrar sesión
          </button>
        </div>

        {showCreateCompany && isTenantOwner && (
          <form
            onSubmit={createCompany}
            className="mb-6 bg-white border rounded-xl p-4 space-y-3"
          >
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <Building2 size={16} /> Nueva empresa
            </h3>
            <div className="grid md:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-slate-500 mb-1">Nombre</label>
                <input
                  required
                  value={newCompanyName}
                  onChange={(e) => setNewCompanyName(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
              <div>
                <label className="block text-xs text-slate-500 mb-1">RNC</label>
                <input
                  value={newCompanyRnc}
                  onChange={(e) => setNewCompanyRnc(e.target.value)}
                  className="w-full border rounded-lg px-3 py-2"
                />
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creatingCompany}
                className="bg-indigo-600 text-white px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-60 flex items-center gap-2"
              >
                {creatingCompany && <Loader2 className="animate-spin" size={14} />}
                Crear y activar
              </button>
              <button
                type="button"
                onClick={() => setShowCreateCompany(false)}
                className="px-4 py-2 rounded-lg text-sm border"
              >
                Cancelar
              </button>
            </div>
          </form>
        )}

        {showMembers && company && (
          <div className="mb-6 bg-white border rounded-xl p-4 space-y-4">
            <h3 className="font-semibold text-slate-800 flex items-center gap-2">
              <Users size={16} /> Miembros · {company.name}
            </h3>
            {membersLoading ? (
              <Loader2 className="animate-spin text-indigo-600" size={20} />
            ) : (
              <ul className="divide-y border rounded-lg">
                {members.map((m) => (
                  <li
                    key={m.id}
                    className="flex items-center justify-between gap-3 px-3 py-2 text-sm"
                  >
                    <div>
                      <div className="font-medium text-slate-800">{m.name}</div>
                      <div className="text-slate-500 text-xs">
                        {m.email} · {m.role}
                      </div>
                    </div>
                    {isCompanyOwner && m.id !== user?.id && (
                      <button
                        type="button"
                        onClick={() => removeMember(m.id)}
                        className="text-red-600 hover:bg-red-50 p-1.5 rounded"
                        title="Quitar"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {isCompanyOwner && (
              <form onSubmit={addMember} className="space-y-3 border-t pt-3">
                <h4 className="text-sm font-medium text-slate-700 flex items-center gap-1">
                  <UserPlus size={14} /> Agregar miembro
                </h4>
                <div className="grid md:grid-cols-2 gap-2">
                  <input
                    required
                    type="email"
                    placeholder="Email"
                    value={memberForm.email}
                    onChange={(e) =>
                      setMemberForm((f) => ({ ...f, email: e.target.value }))
                    }
                    className="border rounded-lg px-3 py-2 text-sm"
                  />
                  <input
                    placeholder="Nombre (si es usuario nuevo)"
                    value={memberForm.name}
                    onChange={(e) =>
                      setMemberForm((f) => ({ ...f, name: e.target.value }))
                    }
                    className="border rounded-lg px-3 py-2 text-sm"
                  />
                  <input
                    type="password"
                    placeholder="Contraseña (si es usuario nuevo)"
                    value={memberForm.password}
                    onChange={(e) =>
                      setMemberForm((f) => ({ ...f, password: e.target.value }))
                    }
                    className="border rounded-lg px-3 py-2 text-sm"
                  />
                  <select
                    value={memberForm.role}
                    onChange={(e) =>
                      setMemberForm((f) => ({
                        ...f,
                        role: e.target.value as 'owner' | 'member',
                      }))
                    }
                    className="border rounded-lg px-3 py-2 text-sm"
                  >
                    <option value="member">member</option>
                    <option value="owner">owner</option>
                  </select>
                </div>
                <button
                  type="submit"
                  disabled={addingMember}
                  className="bg-indigo-600 text-white px-3 py-1.5 rounded-lg text-sm disabled:opacity-60"
                >
                  {addingMember ? 'Agregando…' : 'Agregar'}
                </button>
              </form>
            )}
          </div>
        )}

        <div className="flex flex-col md:flex-row md:items-end md:justify-between gap-4 mb-6">
          <div>
            <h2 className="text-2xl font-bold text-slate-800">Lotes fiscales</h2>
            <p className="text-slate-500 text-sm">
              {company
                ? `${company.name} · un lote por periodo y tipo (606/607)`
                : 'Un lote por periodo y tipo (606/607)'}
            </p>
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
              disabled={creating || !company}
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
