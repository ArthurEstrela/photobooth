import React, { useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import {
  LayoutDashboard, Smartphone, Calendar, Layers, Image,
  CreditCard, Receipt, BarChart2, Settings, LogOut, MoreHorizontal, X,
} from 'lucide-react';
import { Avatar } from './ui';
import { useAuth } from '../context/AuthContext';
import { ImpersonationBanner } from './ImpersonationBanner';
import { BillingWall } from './BillingWall';

const NAV_ITEMS = [
  { label: 'Início',        icon: LayoutDashboard, path: '/' },
  { label: 'Cabines',       icon: Smartphone,      path: '/booths' },
  { label: 'Eventos',       icon: Calendar,        path: '/events' },
  { label: 'Molduras',      icon: Layers,          path: '/frames' },
  { label: 'Galeria',       icon: Image,           path: '/gallery' },
  { label: 'Pagamentos',    icon: CreditCard,      path: '/payments' },
  { label: 'Assinatura',    icon: Receipt,         path: '/billing' },
  { label: 'Analytics',     icon: BarChart2,       path: '/analytics' },
  { label: 'Configurações', icon: Settings,        path: '/settings' },
];

const MOBILE_TABS = NAV_ITEMS.slice(0, 5);
const MOBILE_MORE = NAV_ITEMS.slice(5);

interface DashboardLayoutProps {
  children: React.ReactNode;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({ children }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [moreOpen, setMoreOpen] = useState(false);

  const isActive = (path: string) =>
    path === '/' ? location.pathname === '/' : location.pathname.startsWith(path);

  const sideNavClass = (path: string) =>
    `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-colors
    ${isActive(path)
      ? 'bg-primary-light text-primary'
      : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'}`;

  return (
    <div className="flex h-screen bg-gray-50">
      <ImpersonationBanner />
      <BillingWall />
      {/* ── DESKTOP SIDEBAR (lg+) ─────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-64 h-screen bg-white border-r border-gray-100 fixed left-0 top-0 z-10">
        <div className="px-5 h-16 flex items-center border-b border-gray-100">
          <span className="text-lg font-bold text-gray-900">PhotoBooth OS</span>
        </div>
        <nav className="flex-1 px-3 py-4 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ label, icon: Icon, path }) => (
            <Link key={path} to={path} className={sideNavClass(path)}>
              <Icon size={18} />
              <span>{label}</span>
            </Link>
          ))}
        </nav>
        <div className="px-3 py-4 border-t border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2 min-w-0">
            <Avatar name={user?.email || 'User'} size="sm" />
            <span className="text-xs text-gray-500 truncate">{user?.email}</span>
          </div>
          <button
            onClick={logout}
            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* ── TABLET SIDEBAR (md–lg) ────────────────────────────── */}
      <aside className="hidden md:flex lg:hidden flex-col w-16 h-screen bg-white border-r border-gray-100 fixed left-0 top-0 z-10">
        <div className="h-16 flex items-center justify-center border-b border-gray-100">
          <span className="text-sm font-black text-primary">PB</span>
        </div>
        <nav className="flex-1 px-2 py-4 space-y-0.5 overflow-y-auto">
          {NAV_ITEMS.map(({ label, icon: Icon, path }) => (
            <Link
              key={path}
              to={path}
              title={label}
              className={`flex items-center justify-center w-10 h-10 rounded-xl mx-auto transition-colors
                ${isActive(path) ? 'bg-primary-light text-primary' : 'text-gray-500 hover:bg-gray-50 hover:text-gray-900'}`}
            >
              <Icon size={18} />
            </Link>
          ))}
        </nav>
        <div className="px-2 py-4 border-t border-gray-100 flex justify-center">
          <button
            onClick={logout}
            className="flex items-center justify-center w-10 h-10 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-xl"
          >
            <LogOut size={16} />
          </button>
        </div>
      </aside>

      {/* ── MOBILE HEADER ─────────────────────────────────────── */}
      <header className="md:hidden fixed top-0 left-0 right-0 z-10 bg-white border-b border-gray-100 px-4 h-14 flex items-center justify-between">
        <span className="font-bold text-gray-900">PhotoBooth OS</span>
        <Avatar name={user?.email || 'User'} size="sm" />
      </header>

      {/* ── MAIN CONTENT ──────────────────────────────────────── */}
      <main className="flex-1 overflow-y-auto lg:ml-64 md:ml-16 pt-14 md:pt-0 pb-20 md:pb-0">
        <div className="max-w-7xl mx-auto p-4 md:p-6 lg:p-8">
          {children}
        </div>
      </main>

      {/* ── MOBILE BOTTOM TAB BAR ─────────────────────────────── */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-10 bg-white border-t border-gray-100 flex items-center safe-area-bottom">
        {MOBILE_TABS.map(({ label, icon: Icon, path }) => (
          <Link
            key={path}
            to={path}
            className={`flex-1 flex flex-col items-center justify-center py-2 gap-0.5 transition-colors
              ${isActive(path) ? 'text-primary' : 'text-gray-500'}`}
          >
            <Icon size={20} />
            <span className="text-[10px] font-medium">{label}</span>
          </Link>
        ))}
        <button
          onClick={() => setMoreOpen(true)}
          className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-gray-500"
        >
          <MoreHorizontal size={20} />
          <span className="text-[10px] font-medium">Mais</span>
        </button>
      </nav>

      {/* ── MOBILE "MORE" BOTTOM SHEET ────────────────────────── */}
      {moreOpen && (
        <div
          className="md:hidden fixed inset-0 z-50 bg-black/40"
          onClick={() => setMoreOpen(false)}
        >
          <div
            className="absolute bottom-0 left-0 right-0 bg-white rounded-t-2xl p-4 pb-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <span className="font-semibold text-gray-900">Mais opções</span>
              <button onClick={() => setMoreOpen(false)} className="p-1 text-gray-400">
                <X size={20} />
              </button>
            </div>
            <div className="space-y-0.5">
              {MOBILE_MORE.map(({ label, icon: Icon, path }) => (
                <button
                  key={path}
                  onClick={() => { navigate(path); setMoreOpen(false); }}
                  className={`w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium transition-colors
                    ${isActive(path) ? 'bg-primary-light text-primary' : 'text-gray-700 hover:bg-gray-50'}`}
                >
                  <Icon size={18} />
                  <span>{label}</span>
                </button>
              ))}
              <button
                onClick={() => { logout(); setMoreOpen(false); }}
                className="w-full flex items-center gap-3 px-3 py-3 rounded-xl text-sm font-medium text-red-600 hover:bg-red-50"
              >
                <LogOut size={18} />
                <span>Sair</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
