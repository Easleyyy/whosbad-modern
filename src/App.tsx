import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect } from 'react';
import { BottomTabs } from '@/components/layout/BottomTabs';
import { Sidebar } from '@/components/layout/Sidebar';
import { VolantsPage } from '@/pages/VolantsPage';
import { TShirtsPage, EntrainementsPage, SettingsPage, PendingPage } from '@/pages/OtherPages';
import { useAllSalesData } from '@/hooks/useSales';
import { useNotifications } from '@/hooks/useNotifications';

const queryClient = new QueryClient({
  defaultOptions: { queries: { retry: 2, staleTime: 30_000 } },
});

function NotificationManager() {
  const { requestPermission, showPendingReminder } = useNotifications();
  const { data: allSales = [] } = useAllSalesData();

  useEffect(() => {
    let cancelled = false;
    requestPermission().then((granted) => {
      if (!granted || cancelled) return;
      const pending = allSales.filter(s => s.paye === 'Non');
      if (pending.length === 0) return;
      const amount = pending.reduce((sum, s) => sum + (s.montant ?? 0), 0);
      const timer = setTimeout(() => {
        if (!cancelled) showPendingReminder(pending.length, amount);
      }, 3000);
      return () => clearTimeout(timer);
    });
    return () => { cancelled = true; };
  // Only run once on mount
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return null;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <div className="flex overflow-hidden bg-paper" style={{ height: '100dvh' }}>
          <Sidebar />
          <div className="flex flex-1 flex-col overflow-hidden">
            <main className="flex-1 overflow-hidden">
              <Routes>
                <Route path="/" element={<VolantsPage />} />
                <Route path="/tshirts" element={<TShirtsPage />} />
                <Route path="/entrainements" element={<EntrainementsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/pending" element={<PendingPage />} />
              </Routes>
            </main>
            <BottomTabs />
          </div>
          <NotificationManager />
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
