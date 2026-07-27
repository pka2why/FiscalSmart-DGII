import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api';
import type { AuthUser, Company, Tenant } from './types';

interface AuthSession {
  user: AuthUser;
  tenant: Tenant;
  company: Company;
  companies: Company[];
}

interface AuthState {
  user: AuthUser | null;
  tenant: Tenant | null;
  company: Company | null;
  companies: Company[];
  loading: boolean;
  refresh: () => Promise<void>;
  setSession: (session: AuthSession) => void;
  switchCompany: (companyId: string) => Promise<void>;
  logout: () => Promise<void>;
  updateCreditBalance: (balance: number) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [company, setCompany] = useState<Company | null>(null);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);

  const applySession = (session: AuthSession) => {
    setUser(session.user);
    setTenant(session.tenant);
    setCompany(session.company);
    setCompanies(session.companies);
  };

  const clearSession = () => {
    setUser(null);
    setTenant(null);
    setCompany(null);
    setCompanies([]);
  };

  const refresh = useCallback(async () => {
    try {
      const data = await api<AuthSession>('/api/auth/me');
      applySession(data);
    } catch {
      clearSession();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setSession = (session: AuthSession) => {
    applySession(session);
  };

  const switchCompany = async (companyId: string) => {
    const data = await api<AuthSession>(`/api/companies/${companyId}/switch`, {
      method: 'POST',
    });
    applySession(data);
  };

  const logout = async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch {
      // Always clear local session even if the request fails.
    }
    clearSession();
  };

  const updateCreditBalance = (balance: number) => {
    setTenant((prev) => (prev ? { ...prev, creditBalance: balance } : prev));
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        tenant,
        company,
        companies,
        loading,
        refresh,
        setSession,
        switchCompany,
        logout,
        updateCreditBalance,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
