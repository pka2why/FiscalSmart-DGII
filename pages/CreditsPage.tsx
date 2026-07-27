import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, Coins, Loader2, LogOut } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import type { CreditLedgerEntry, CreditPackage } from '../types';

export const CreditsPage: React.FC = () => {
  const { tenant, logout, updateCreditBalance } = useAuth();
  const navigate = useNavigate();
  const [balance, setBalance] = useState(tenant?.creditBalance ?? 0);
  const [packages, setPackages] = useState<CreditPackage[]>([]);
  const [entries, setEntries] = useState<CreditLedgerEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const [credits, ledger] = await Promise.all([
          api<{ balance: number; packages: CreditPackage[] }>('/api/credits'),
          api<{ entries: CreditLedgerEntry[] }>('/api/credits/ledger?limit=50'),
        ]);
        setBalance(credits.balance);
        setPackages(credits.packages);
        setEntries(ledger.entries);
        updateCreditBalance(credits.balance);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const reasonLabel = (reason: string) => {
    switch (reason) {
      case 'signup_bonus':
        return 'Bonus de registro';
      case 'admin_grant':
        return 'Recarga admin';
      case 'purchase':
        return 'Compra';
      case 'ocr_charge':
        return 'OCR Gemini';
      case 'ocr_refund':
        return 'Reembolso OCR';
      default:
        return reason;
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center justify-between gap-3 mb-4">
          <Link to="/" className="inline-flex items-center gap-2 text-indigo-600 text-sm">
            <ArrowLeft size={16} /> Volver a lotes
          </Link>
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
        <h1 className="text-2xl font-bold text-slate-800 mb-2 flex items-center gap-2">
          <Coins className="text-amber-500" /> Créditos Gemini
        </h1>
        <p className="text-slate-500 text-sm mb-6">
          1 crédito = 1 factura procesada con OCR. Upload, edición y Excel no consumen créditos.
        </p>

        {loading ? (
          <Loader2 className="animate-spin text-indigo-600" />
        ) : (
          <>
            <div className="bg-white border rounded-xl p-6 mb-6">
              <div className="text-sm text-slate-500">Saldo actual</div>
              <div className="text-4xl font-bold text-slate-800">{balance}</div>
              <p className="text-sm text-slate-500 mt-3">
                Para recargar, contacta al administrador. Las recargas se aplican con el endpoint
                admin (facturación offline en esta versión).
              </p>
            </div>

            <h2 className="font-semibold text-slate-700 mb-3">Paquetes (referencia)</h2>
            <div className="grid md:grid-cols-3 gap-3 mb-8">
              {packages.map((p) => (
                <div key={p.id} className="bg-white border rounded-xl p-4">
                  <div className="font-semibold text-slate-800">{p.name}</div>
                  <div className="text-2xl font-bold text-indigo-600 my-2">{p.credits} créd.</div>
                  <div className="text-sm text-slate-500">
                    {(p.priceCents / 100).toLocaleString('es-DO', {
                      style: 'currency',
                      currency: p.currency,
                    })}
                  </div>
                </div>
              ))}
            </div>

            <h2 className="font-semibold text-slate-700 mb-3">Historial</h2>
            <div className="bg-white border rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-slate-500 text-left">
                  <tr>
                    <th className="p-3">Fecha</th>
                    <th className="p-3">Motivo</th>
                    <th className="p-3">Delta</th>
                    <th className="p-3">Saldo</th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((e) => (
                    <tr key={e.id} className="border-t">
                      <td className="p-3">{new Date(e.createdAt).toLocaleString()}</td>
                      <td className="p-3">{reasonLabel(e.reason)}</td>
                      <td className={`p-3 font-medium ${e.delta < 0 ? 'text-red-600' : 'text-green-600'}`}>
                        {e.delta > 0 ? `+${e.delta}` : e.delta}
                      </td>
                      <td className="p-3">{e.balanceAfter}</td>
                    </tr>
                  ))}
                  {entries.length === 0 && (
                    <tr>
                      <td colSpan={4} className="p-6 text-center text-slate-400">
                        Sin movimientos
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};
