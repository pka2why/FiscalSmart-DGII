import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { api } from './api';
import type { AuthUser, Tenant } from './types';

interface AuthState {
  user: AuthUser | null;
  tenant: Tenant | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setSession: (user: AuthUser, tenant: Tenant) => void;
  logout: () => Promise<void>;
  updateCreditBalance: (balance: number) => void;
}

const AuthContext = createContext<AuthState | null>(null);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [tenant, setTenant] = useState<Tenant | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const data = await api<{ user: AuthUser; tenant: Tenant }>('/api/auth/me');
      setUser(data.user);
      setTenant(data.tenant);
    } catch {
      setUser(null);
      setTenant(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const setSession = (nextUser: AuthUser, nextTenant: Tenant) => {
    setUser(nextUser);
    setTenant(nextTenant);
  };

  const logout = async () => {
    try {
      await api('/api/auth/logout', { method: 'POST' });
    } catch {
      // Always clear local session even if the request fails.
    }
    setUser(null);
    setTenant(null);
  };

  const updateCreditBalance = (balance: number) => {
    setTenant((prev) => (prev ? { ...prev, creditBalance: balance } : prev));
  };

  return (
    <AuthContext.Provider
      value={{ user, tenant, loading, refresh, setSession, logout, updateCreditBalance }}
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
