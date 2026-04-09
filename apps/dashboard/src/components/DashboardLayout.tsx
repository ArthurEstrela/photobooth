import React from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Calendar, Image as ImageIcon, Smartphone, CreditCard, Settings, LogOut } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

const SidebarLink = ({ to, icon: Icon, label }: { to: string; icon: any; label: string }) => {
  const location = useLocation();
  const isActive = location.pathname === to;
  return (
    <Link
      to={to}
      className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
        isActive ? 'bg-blue-600 text-white' : 'text-gray-400 hover:bg-gray-800 hover:text-white'
      }`}
    >
      <Icon size={20} />
      <span className="font-medium">{label}</span>
    </Link>
  );
};

export const DashboardLayout: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div className="flex min-h-screen bg-gray-50">
      <aside className="w-64 bg-gray-900 text-white p-6 flex flex-col fixed h-full">
        <div className="flex items-center gap-2 mb-10 px-2">
          <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center font-bold">P</div>
          <h1 className="text-xl font-bold tracking-tight">PhotoBooth OS</h1>
        </div>
        <nav className="flex-1 space-y-2">
          <SidebarLink to="/" icon={LayoutDashboard} label="Início" />
          <SidebarLink to="/events" icon={Calendar} label="Eventos" />
          <SidebarLink to="/gallery" icon={ImageIcon} label="Galeria" />
          <SidebarLink to="/booths" icon={Smartphone} label="Cabines" />
          <SidebarLink to="/payments" icon={CreditCard} label="Pagamentos" />
          <SidebarLink to="/settings" icon={Settings} label="Configurações" />
        </nav>
        <div className="mt-auto pt-6 border-t border-gray-800">
          <button
            onClick={handleLogout}
            className="flex items-center gap-3 px-4 py-3 text-gray-400 hover:text-white w-full transition-colors"
          >
            <LogOut size={20} />
            <span className="font-medium">Sair</span>
          </button>
        </div>
      </aside>
      <main className="ml-64 flex-1">
        <div className="p-8">{children}</div>
      </main>
    </div>
  );
};
