// apps/dashboard/src/App.tsx

import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { DashboardLayout } from './components/DashboardLayout';
import { Home } from './pages/Home';
import { EventsPage } from './pages/EventsPage';

const queryClient = new QueryClient();

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <DashboardLayout>
          <Routes>
            <Route path="/" element={<Home />} />
            <Route path="/events" element={<EventsPage />} />
            {/* Gallery and Booths would be implemented in next stages */}
            <Route path="/gallery" element={<div>Galeria em breve...</div>} />
            <Route path="/booths" element={<div>Cabines em breve...</div>} />
          </Routes>
        </DashboardLayout>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

export default App;
