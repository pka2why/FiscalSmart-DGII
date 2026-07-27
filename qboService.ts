
import { QboTransaction } from "./types.ts";

/**
 * Obtiene transacciones reales desde el servidor (Proxy de QBO API)
 */
export const fetchQboTransactions = async (): Promise<QboTransaction[]> => {
  const res = await fetch('/api/qbo/transactions');
  
  if (res.status === 401) {
    throw new Error('REAUTH_REQUIRED');
  }
  
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || `Error del servidor: ${res.status}`);
  }
  
  return await res.json();
};

/**
 * Obtiene la URL de inicio de sesión de QuickBooks
 */
export const getQboAuthUrl = async (): Promise<string> => {
  const res = await fetch('/api/qbo/auth');
  if (!res.ok) {
    const errorData = await res.json().catch(() => ({}));
    throw new Error(errorData.error || 'No se pudo obtener la URL de autenticación');
  }
  const data = await res.json();
  return data.authUri;
};
