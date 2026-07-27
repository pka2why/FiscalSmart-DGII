import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Loader2, PieChart } from 'lucide-react';
import { api } from '../api';
import { useAuth } from '../AuthContext';
import type { AuthUser, Company, Tenant } from '../types';

type AuthResponse = {
  user: AuthUser;
  tenant: Tenant;
  company: Company;
  companies: Company[];
};

export const RegisterPage: React.FC = () => {
  const { setSession } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    name: '',
    email: '',
    password: '',
    companyName: '',
    rnc: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const data = await api<AuthResponse>('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify(form),
      });
      setSession(data);
      navigate('/');
    } catch (err: any) {
      setError(err.message || 'Error al registrar');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 flex items-center justify-center p-4">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-lg p-8">
        <div className="flex items-center gap-2 mb-6">
          <PieChart className="text-indigo-600" />
          <h1 className="text-2xl font-bold text-slate-800">FiscalSmart</h1>
        </div>
        <h2 className="text-lg font-semibold text-slate-700 mb-4">Crear cuenta</h2>
        <form onSubmit={onSubmit} className="space-y-3">
          {(
            [
              ['name', 'Tu nombre', 'text'],
              ['email', 'Email', 'email'],
              ['password', 'Contraseña (mín. 6)', 'password'],
              ['companyName', 'Nombre de la empresa', 'text'],
              ['rnc', 'RNC informante', 'text'],
            ] as const
          ).map(([key, label, type]) => (
            <div key={key}>
              <label className="block text-sm text-slate-600 mb-1">{label}</label>
              <input
                type={type}
                required={key !== 'rnc'}
                value={form[key]}
                onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                className="w-full border rounded-lg px-3 py-2"
              />
            </div>
          ))}
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={loading}
            className="w-full bg-indigo-600 text-white py-2.5 rounded-lg font-semibold hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="animate-spin" size={16} />}
            Crear cuenta
          </button>
        </form>
        <p className="text-sm text-slate-500 mt-4 text-center">
          ¿Ya tienes cuenta?{' '}
          <Link to="/login" className="text-indigo-600 font-medium">
            Inicia sesión
          </Link>
        </p>
      </div>
    </div>
  );
};
