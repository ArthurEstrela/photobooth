import React, { createContext, useContext, useState, useCallback } from 'react';
import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const ADMIN_TOKEN_KEY = 'admin_token';
const TENANT_TOKEN_KEY = 'token';

function decodeJwt(token: string): Record<string, unknown> | null {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

interface AdminAuthContextValue {
  adminToken: string | null;
  adminEmail: string | null;
  isImpersonating: boolean;
  impersonatedEmail: string | null;
  adminLogin: (email: string, password: string) => Promise<void>;
  adminLogout: () => void;
  startImpersonation: (tenantToken: string) => void;
  stopImpersonation: () => void;
}

const AdminAuthContext = createContext<AdminAuthContextValue | null>(null);

export function AdminAuthProvider({ children }: { children: React.ReactNode }) {
  const [adminToken, setAdminTokenState] = useState<string | null>(
    () => localStorage.getItem(ADMIN_TOKEN_KEY),
  );

  // isImpersonating is derived — not stored in state — so it survives hard reloads
  const activeToken = localStorage.getItem(TENANT_TOKEN_KEY);
  const activePayload = activeToken ? decodeJwt(activeToken) : null;
  const isImpersonating = !!adminToken && !!activeToken && activePayload?.impersonated === true;
  const impersonatedEmail = isImpersonating ? (activePayload?.email as string) : null;

  const adminEmail = adminToken ? (decodeJwt(adminToken)?.email as string) ?? null : null;

  const adminLogin = useCallback(async (email: string, password: string) => {
    const { data } = await axios.post<{ token: string }>(`${API_URL}/auth/admin/login`, {
      email,
      password,
    });
    localStorage.setItem(ADMIN_TOKEN_KEY, data.token);
    setAdminTokenState(data.token);
  }, []);

  const adminLogout = useCallback(() => {
    localStorage.removeItem(ADMIN_TOKEN_KEY);
    localStorage.removeItem(TENANT_TOKEN_KEY);
    localStorage.removeItem('tenantId');
    localStorage.removeItem('email');
    setAdminTokenState(null);
    window.location.href = '/admin/login';
  }, []);

  const startImpersonation = useCallback((tenantToken: string) => {
    localStorage.setItem(TENANT_TOKEN_KEY, tenantToken);
    window.location.href = '/';
  }, []);

  const stopImpersonation = useCallback(() => {
    localStorage.removeItem(TENANT_TOKEN_KEY);
    localStorage.removeItem('tenantId');
    localStorage.removeItem('email');
    window.location.href = '/admin';
  }, []);

  return (
    <AdminAuthContext.Provider
      value={{
        adminToken,
        adminEmail,
        isImpersonating,
        impersonatedEmail,
        adminLogin,
        adminLogout,
        startImpersonation,
        stopImpersonation,
      }}
    >
      {children}
    </AdminAuthContext.Provider>
  );
}

export function useAdminAuth(): AdminAuthContextValue {
  const ctx = useContext(AdminAuthContext);
  if (!ctx) throw new Error('useAdminAuth must be used inside <AdminAuthProvider>');
  return ctx;
}
