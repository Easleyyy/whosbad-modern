import { useState, useMemo } from 'react';
import { ArrowUpDown } from 'lucide-react';
import { useSalesData, useAchats, useDeleteSale, useUpdateSale } from '@/hooks/useSales';
import { EditSaleModal } from '@/components/sales/EditSaleModal';
import { useSalesStore } from '@/stores/salesStore';
import { useToast } from '@/hooks/useToast';
import { SaleCard } from '@/components/sales/SaleCard';
import { SearchBar } from '@/components/sales/SearchBar';
import { FilterPills } from '@/components/sales/FilterPills';
import { DatePresetPills } from '@/components/sales/DatePresetPills';
import { StatsCards } from '@/components/stats/StatsCards';
import { AIAssistant } from '@/components/ai/AIAssistant';
import { FAB } from '@/components/layout/FAB';
import { ToastContainer } from '@/components/ui/Toast';
import { filterSales, getDateRange } from '@/lib/utils';
import { type ProductTab } from '@/types';

function parseTs(dateStr: string) {
  if (!dateStr) return 0;
  const [dd, mm, yy] = dateStr.split('/');
  return new Date(+yy, +mm - 1, +dd).getTime() || 0;
}

const TABS: ProductTab[] = ['Victor GM', 'Victor PC', 'CBX RED', 'CBX BLUE'];

const TAB_COLORS: Record<ProductTab, string> = {
  'Victor GM': 'text-warning-600',
  'Victor PC': 'text-teal-400',
  'CBX RED': 'text-danger-500',
  'CBX BLUE': 'text-blue-400',
};

export function VolantsPage() {
  const { activeTab, filters, datePreset, setActiveTab, setFilters, setDatePreset } = useSalesStore();
  const [aiOpen, setAiOpen] = useState(false);
  const [sortAsc, setSortAsc] = useState(false); // false = plus récent en premier
  const [editSale, setEditSale] = useState<import('@/types').Sale | null>(null);
  const { data: sales = [], isLoading } = useSalesData();
  const { data: achats = {} } = useAchats();
  const { mutate: deleteSale } = useDeleteSale();
  const { mutateAsync: updateSale, isPending: updating } = useUpdateSale();
  const { toasts, addToast, removeToast } = useToast();

  const dateRange = useMemo(() => getDateRange(datePreset), [datePreset]);

  const filtered = useMemo(() => {
    const base = filterSales(sales, filters.search ?? '', filters.status ?? 'all', dateRange.dateFrom, dateRange.dateTo);
    return [...base].sort((a, b) => {
      const diff = parseTs(a.date) - parseTs(b.date);
      return sortAsc ? diff : -diff;
    });
  }, [sales, filters, dateRange, sortAsc]);

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
      <div className="px-4 py-3 space-y-2.5">
        <SearchBar value={filters.search ?? ''} onChange={(v) => setFilters({ search: v })} />
        <DatePresetPills active={datePreset} onChange={setDatePreset} />
        <FilterPills
          active={(filters.status ?? 'all') as 'all' | 'paid' | 'pending' | 'dash'}
          onChange={(s) => setFilters({ status: s })}
          counts={counts}
        />
      </div>

      {/* Liste — en-tête avec compteur + tri */}
      <div className="flex items-center justify-between px-4 pb-1">
        <span className="text-xs text-gray-500">{filtered.length} vente{filtered.length !== 1 ? 's' : ''}</span>
        <button
          onClick={() => setSortAsc(v => !v)}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-white transition-colors"
        >
          <ArrowUpDown className="w-3.5 h-3.5" />
          {sortAsc ? 'Plus ancien' : 'Plus récent'}
        </button>
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
              onEdit={(s) => setEditSale(s)}
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

      {/* Edit modal */}
      {editSale && (
        <EditSaleModal
          sale={editSale}
          loading={updating}
          onClose={() => setEditSale(null)}
          onSave={async (body) => {
            try {
              await updateSale(body as Record<string, unknown>);
              addToast(`Mis à jour : ${editSale.acheteur}`, 'success');
              setEditSale(null);
            } catch { addToast('Erreur lors de la mise à jour', 'error'); }
          }}
        />
      )}

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
