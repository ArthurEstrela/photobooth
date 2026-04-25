import React from 'react';
import { useNavigate } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import { Button, Card, Skeleton } from '../components/ui';
import { useAdminTenants, useImpersonate } from '../hooks/api/useAdmin';
import { useAdminAuth } from '../context/AdminAuthContext';

export const AdminTenantsPage: React.FC = () => {
  const { data: tenants, isLoading } = useAdminTenants();
  const impersonate = useImpersonate();
  const { adminToken, adminEmail, adminLogout, startImpersonation } = useAdminAuth();
  const navigate = useNavigate();

  // Redirect to admin login if not authenticated as admin
  React.useEffect(() => {
    if (!adminToken) navigate('/admin/login');
  }, [adminToken, navigate]);

  const handleImpersonate = (tenantId: string) => {
    impersonate.mutate(tenantId, {
      onSuccess: (data) => startImpersonation(data.token),
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Admin</h1>
          <p className="text-xs text-gray-400">{adminEmail}</p>
        </div>
        <Button variant="ghost" size="sm" onClick={adminLogout}>
          <LogOut size={14} className="mr-1.5" />
          Sair
        </Button>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-8">
        <h2 className="text-lg font-semibold text-gray-900 mb-4">Tenants</h2>

        {isLoading ? (
          <Skeleton className="h-64 w-full rounded-2xl" />
        ) : (
          <Card padding="none">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">Nome</th>
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">Email</th>
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">Cadastro</th>
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">MP</th>
                  <th className="text-left px-6 py-3 text-gray-500 font-medium">Cabines</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody>
                {(tenants ?? []).map((t) => (
                  <tr key={t.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50">
                    <td className="px-6 py-4 font-medium text-gray-900">{t.name}</td>
                    <td className="px-6 py-4 text-gray-500">{t.email}</td>
                    <td className="px-6 py-4 text-gray-400">
                      {new Date(t.createdAt).toLocaleDateString('pt-BR')}
                    </td>
                    <td className="px-6 py-4">
                      {t.mpConnected ? (
                        <span className="text-green-600 font-medium">Conectado</span>
                      ) : (
                        <span className="text-gray-400">Não conectado</span>
                      )}
                    </td>
                    <td className="px-6 py-4 text-gray-500">{t.boothCount}</td>
                    <td className="px-6 py-4">
                      <Button
                        variant="secondary"
                        size="sm"
                        onClick={() => handleImpersonate(t.id)}
                        loading={impersonate.isPending}
                      >
                        Entrar como
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
        )}
      </div>
    </div>
  );
};
