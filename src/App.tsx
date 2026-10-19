import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { BottomTabs } from '@/components/layout/BottomTabs';
import { Sidebar } from '@/components/layout/Sidebar';
import { ChatBar, ChatSide } from '@/components/ai/ChatDock';
import { SaleEditorHost } from '@/components/sales/SaleEditorHost';
import { AdherentsPage } from '@/pages/AdherentsPage';
import { ChatHomePage } from '@/pages/ChatHomePage';
import { VolantsPage } from '@/pages/VolantsPage';
import { TShirtsPage, EntrainementsPage, SettingsPage, PendingPage } from '@/pages/OtherPages';
import { useAllSalesData } from '@/hooks/useSales';
import { useNotifications } from '@/hooks/useNotifications';
import { initPwaUpdate, applyPwaUpdate } from '@/lib/pwaUpdate';

function UpdateBanner() {
  const [needRefresh, setNeedRefresh] = useState(false);

  useEffect(() => {
    initPwaUpdate(() => setNeedRefresh(true));
  }, []);

  if (!needRefresh) return null;

  return (
    <button
      onClick={applyPwaUpdate}
      className="fixed inset-x-0 top-0 z-[100] flex items-center justify-center gap-2 border-b-[1.5px] border-ink bg-ink px-4 py-2 font-mono text-[10px] font-medium tracking-label text-paper"
    >
      NOUVELLE VERSION DISPONIBLE — TOUCHER POUR ACTUALISER
    </button>
  );
}

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
          <UpdateBanner />
          <Sidebar />
          <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
            <main className="min-h-0 flex-1 overflow-hidden">
              <Routes>
                <Route path="/" element={<ChatHomePage />} />
                <Route path="/volants" element={<VolantsPage />} />
                <Route path="/tshirts" element={<TShirtsPage />} />
                <Route path="/adherents" element={<AdherentsPage />} />
                <Route path="/entrainements" element={<EntrainementsPage />} />
                <Route path="/settings" element={<SettingsPage />} />
                <Route path="/pending" element={<PendingPage />} />
              </Routes>
            </main>
            <ChatBar />
            <BottomTabs />
          </div>
          <ChatSide />
          <SaleEditorHost />
          <NotificationManager />
        </div>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
