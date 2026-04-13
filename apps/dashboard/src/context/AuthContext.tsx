import React, { createContext, useContext, useState } from 'react';
import { AuthResponseDto, LoginDto, RegisterDto } from '@packages/shared';
import { api } from '../lib/api';

interface AuthContextValue {
  token: string | null;
  tenantId: string | null;
  user: { email: string } | null;
  isAuthenticated: boolean;
  login: (dto: LoginDto) => Promise<void>;
  register: (dto: RegisterDto) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [token, setToken] = useState<string | null>(
    () => localStorage.getItem('token'),
  );
  const [tenantId, setTenantId] = useState<string | null>(
    () => localStorage.getItem('tenantId'),
  );
  const [email, setEmail] = useState<string | null>(
    () => localStorage.getItem('email'),
  );

  const persist = (data: AuthResponseDto) => {
    setToken(data.accessToken);
    setTenantId(data.tenantId);
    setEmail(data.email);
    localStorage.setItem('token', data.accessToken);
    localStorage.setItem('tenantId', data.tenantId);
    localStorage.setItem('email', data.email);
  };

  const login = async (dto: LoginDto) => {
    const res = await api.post<AuthResponseDto>('/auth/login', dto);
    persist(res.data);
  };

  const register = async (dto: RegisterDto) => {
    const res = await api.post<AuthResponseDto>('/auth/register', dto);
    persist(res.data);
  };

  const logout = () => {
    setToken(null);
    setTenantId(null);
    setEmail(null);
    localStorage.removeItem('token');
    localStorage.removeItem('tenantId');
    localStorage.removeItem('email');
  };

  const user = email ? { email } : null;

  return (
    <AuthContext.Provider
      value={{ token, tenantId, user, isAuthenticated: !!token, login, register, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
