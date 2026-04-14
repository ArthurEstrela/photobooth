import { Suspense, lazy } from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardLayout } from './components/DashboardLayout';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useDashboardSocket } from './hooks/useDashboardSocket';
import { Skeleton } from './components/ui';

// ── Eager (tiny, always needed) ──────────────────────────────────────────────
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { GuestPhoto } from './pages/GuestPhoto';

// ── Lazy (code-split per route) ───────────────────────────────────────────────
const Home         = lazy(() => import('./pages/Home').then((m) => ({ default: m.Home })));
const BoothsPage   = lazy(() => import('./pages/BoothsPage').then((m) => ({ default: m.BoothsPage })));
const EventsPage   = lazy(() => import('./pages/EventsPage').then((m) => ({ default: m.EventsPage })));
const FramesPage   = lazy(() => import('./pages/FramesPage').then((m) => ({ default: m.FramesPage })));
const GalleryPage  = lazy(() => import('./pages/GalleryPage').then((m) => ({ default: m.GalleryPage })));
const PaymentsPage = lazy(() => import('./pages/PaymentsPage').then((m) => ({ default: m.PaymentsPage })));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage').then((m) => ({ default: m.AnalyticsPage })));
const SettingsPage = lazy(() => import('./pages/SettingsPage').then((m) => ({ default: m.SettingsPage })));

const queryClient = new QueryClient();

function PageLoader() {
  return (
    <div className="p-6 space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-32 w-full" />
      <Skeleton className="h-32 w-full" />
    </div>
  );
}

// Initializes WebSocket — must be inside AuthProvider
function DashboardSocketInit() {
  useDashboardSocket();
  return null;
}

function AppContent() {
  const location = useLocation();
  const isPublic =
    location.pathname.startsWith('/p/') ||
    location.pathname === '/login' ||
    location.pathname === '/register';

  if (isPublic) {
    return (
      <Routes>
        <Route path="/p/:sessionId" element={<GuestPhoto />} />
        <Route path="/login" element={<LoginPage />} />
        <Route path="/register" element={<RegisterPage />} />
      </Routes>
    );
  }

  return (
    <ProtectedRoute>
      <DashboardSocketInit />
      <DashboardLayout>
        <Suspense fallback={<PageLoader />}>
          <Routes>
            <Route path="/"          element={<Home />} />
            <Route path="/booths"    element={<BoothsPage />} />
            <Route path="/events"    element={<EventsPage />} />
            <Route path="/frames"    element={<FramesPage />} />
            <Route path="/gallery"   element={<GalleryPage />} />
            <Route path="/payments"  element={<PaymentsPage />} />
            <Route path="/analytics" element={<AnalyticsPage />} />
            <Route path="/settings"  element={<SettingsPage />} />
          </Routes>
        </Suspense>
      </DashboardLayout>
    </ProtectedRoute>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <AppContent />
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
