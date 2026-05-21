import { useState, useMemo } from 'react';
import { useSalesData, useAchats, useDeleteSale } from '@/hooks/useSales';
import { useSalesStore } from '@/stores/salesStore';
import { useToast } from '@/hooks/useToast';
import { SaleCard } from '@/components/sales/SaleCard';
import { SearchBar } from '@/components/sales/SearchBar';
import { FilterPills } from '@/components/sales/FilterPills';
import { StatsCards } from '@/components/stats/StatsCards';
import { AIAssistant } from '@/components/ai/AIAssistant';
import { FAB } from '@/components/layout/FAB';
import { ToastContainer } from '@/components/ui/Toast';
import { filterSales } from '@/lib/utils';
import { type ProductTab } from '@/types';

const TABS: ProductTab[] = ['Victor GM', 'Victor PC', 'CBX RED', 'CBX BLUE'];

const TAB_COLORS: Record<ProductTab, string> = {
  'Victor GM': 'text-warning-600',
  'Victor PC': 'text-teal-400',
  'CBX RED': 'text-danger-500',
  'CBX BLUE': 'text-blue-400',
};

export function VolantsPage() {
  const { activeTab, filters, setActiveTab, setFilters, showAIModal: _showAIModal, setShowAIModal: _setShowAIModal } = useSalesStore();
  const [aiOpen, setAiOpen] = useState(false);
  const { data: sales = [], isLoading } = useSalesData();
  const { data: achats = {} } = useAchats();
  const { mutate: deleteSale } = useDeleteSale();
  const { toasts, addToast, removeToast } = useToast();

  const filtered = useMemo(
    () => filterSales(sales, filters.search ?? '', filters.status ?? 'all'),
    [sales, filters]
  );

  const counts = useMemo(() => ({
    all: sales.length,
    paid: sales.filter((s) => s.paye === 'Oui').length,
    pending: sales.filter((s) => s.paye === 'Non').length,
    dash: sales.filter((s) => s.paye === '-').length,
  }), [sales]);

  const stockTotal = achats[activeTab] ?? 0;
  const soldTotal = sales.reduce((sum, s) => sum + s.quantite, 0);

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-4 pt-4 pb-2">
        <h1 className="text-2xl font-bold text-white mb-3">Who's Bad</h1>

        {/* Product tabs */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4">
          {TABS.map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                activeTab === tab
                  ? `bg-surface-800 ${TAB_COLORS[tab]} border border-white/15`
                  : 'text-gray-500'
              }`}
            >
              {tab}
            </button>
          ))}
        </div>

        {/* Stats */}
        <StatsCards sales={sales} stockTotal={stockTotal} soldTotal={soldTotal} />
      </div>

      {/* Filters */}
      <div className="px-4 py-3 space-y-3">
        <SearchBar value={filters.search ?? ''} onChange={(v) => setFilters({ search: v })} />
        <FilterPills
          active={(filters.status ?? 'all') as 'all' | 'paid' | 'pending' | 'dash'}
          onChange={(s) => setFilters({ status: s })}
          counts={counts}
        />
      </div>

      {/* Sales list */}
      <div className="flex-1 overflow-y-auto px-4 pb-4 space-y-2">
        {isLoading ? (
          <div className="flex items-center justify-center py-12 text-gray-500 text-sm">Chargement…</div>
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-gray-500 text-sm">Aucune vente</div>
        ) : (
          filtered.map((sale, i) => (
            <SaleCard
              key={sale.id}
              sale={sale}
              index={i}
              onDelete={(s) => {
                if (s._row) {
                  deleteSale({ rowIndex: s._row });
                  addToast(`Supprimé : ${s.acheteur}`, 'success');
                }
              }}
            />
          ))
        )}
      </div>

      {/* FAB */}
      <FAB onClick={() => setAiOpen(true)} />

      {/* AI Modal */}
      <AIAssistant
        isOpen={aiOpen}
        onClose={() => setAiOpen(false)}
        onSuccess={(msg) => addToast(msg, 'success')}
        onError={(msg) => addToast(msg, 'error')}
      />

      {/* Toasts */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
