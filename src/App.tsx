import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BottomNavigation } from '@/components/layout/BottomNavigation';
import { VolantsPage } from '@/pages/VolantsPage';
import { TShirtsPage, EntrainementsPage, SettingsPage } from '@/pages/OtherPages';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, staleTime: 30_000 } },
});

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="flex flex-col h-dvh bg-surface-900 overflow-hidden">
          {/* Main content */}
          <main className="flex-1 overflow-y-auto">
            <Routes>
              <Route path="/" element={<VolantsPage />} />
              <Route path="/tshirts" element={<TShirtsPage />} />
              <Route path="/entrainements" element={<EntrainementsPage />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </main>
          <BottomNavigation />
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
