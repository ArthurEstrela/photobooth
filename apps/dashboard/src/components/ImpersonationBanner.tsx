import React from 'react';
import { AlertTriangle } from 'lucide-react';
import { useAdminAuth } from '../context/AdminAuthContext';

export const ImpersonationBanner: React.FC = () => {
  const { isImpersonating, impersonatedEmail, stopImpersonation } = useAdminAuth();

  if (!isImpersonating) return null;

  return (
    <div className="w-full bg-amber-400 text-amber-900 text-sm font-medium px-4 py-2 flex items-center justify-between">
      <span className="flex items-center gap-2">
        <AlertTriangle size={15} />
        Visualizando como: <strong>{impersonatedEmail}</strong>
      </span>
      <button
        onClick={stopImpersonation}
        className="ml-4 underline hover:no-underline font-semibold"
      >
        Sair da impersonação
      </button>
    </div>
  );
};
