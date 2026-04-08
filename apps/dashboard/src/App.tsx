// apps/dashboard/src/App.tsx

import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardLayout } from './components/DashboardLayout';
import { Home } from './pages/Home';
import { EventsPage } from './pages/EventsPage';
import { GuestPhoto } from './pages/GuestPhoto';
import { useDashboardSocket } from './hooks/useDashboardSocket';

const queryClient = new QueryClient();

function AppContent() {
  const location = useLocation();
  const isPublicRoute = location.pathname.startsWith('/p/');
  const tenantId = localStorage.getItem('tenantId') || '';

  // Initialize Real-time updates for dashboard
  useDashboardSocket(tenantId);

  if (isPublicRoute) {
    return (
      <Routes>
        <Route path="/p/:sessionId" element={<GuestPhoto />} />
      </Routes>
    );
  }

  return (
    <DashboardLayout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/events" element={<EventsPage />} />
        <Route path="/gallery" element={<div>Galeria em breve...</div>} />
        <Route path="/booths" element={<div>Cabines em breve...</div>} />
      </Routes>
    </DashboardLayout>
  );
}

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AppContent />
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
