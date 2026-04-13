import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardLayout } from './components/DashboardLayout';
import { Home } from './pages/Home';
import { EventsPage } from './pages/EventsPage';
import { FramesPage } from './pages/FramesPage';
import { GuestPhoto } from './pages/GuestPhoto';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { useDashboardSocket } from './hooks/useDashboardSocket';
import { BoothsPage } from './pages/BoothsPage';
import { GalleryPage } from './pages/GalleryPage';
import { PaymentsPage } from './pages/PaymentsPage';
import { SettingsPage } from './pages/SettingsPage';
import { AnalyticsPage } from './pages/AnalyticsPage';

const queryClient = new QueryClient();

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
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/booths" element={<BoothsPage />} />
          <Route path="/events" element={<EventsPage />} />
          <Route path="/frames" element={<FramesPage />} />
          <Route path="/gallery" element={<GalleryPage />} />
          <Route path="/payments" element={<PaymentsPage />} />
          <Route path="/analytics" element={<AnalyticsPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Routes>
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
