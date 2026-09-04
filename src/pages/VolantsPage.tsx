import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { ArrowUpDown, Settings2, PackagePlus } from 'lucide-react';
import { useSalesData, useAchats, useDeleteSale, useUpdateSale } from '@/hooks/useSales';
import { EditSaleModal } from '@/components/sales/EditSaleModal';
import { useSalesStore } from '@/stores/salesStore';
import { useReferencesStore } from '@/stores/referencesStore';
import { useToast } from '@/hooks/useToast';
import { SaleCard } from '@/components/sales/SaleCard';
import { SaleCardSkeleton } from '@/components/ui/Skeleton';
import { SearchBar } from '@/components/sales/SearchBar';
import { FilterPills } from '@/components/sales/FilterPills';
import { DatePresetPills } from '@/components/sales/DatePresetPills';
import { StatsCards } from '@/components/stats/StatsCards';
import { AIAssistant } from '@/components/ai/AIAssistant';
import { ReferenceModal } from '@/components/volants/ReferenceModal';
import { StockModal } from '@/components/volants/StockModal';
import { FAB } from '@/components/layout/FAB';
import { ToastContainer } from '@/components/ui/Toast';
import { filterSales, getDateRange } from '@/lib/utils';
import { getColorHex, type Sale } from '@/types';

function parseTs(dateStr: string) {
  if (!dateStr) return 0;
  const [dd, mm, yy] = dateStr.split('/');
  return new Date(+yy, +mm - 1, +dd).getTime() || 0;
}

export function VolantsPage() {
  const { activeTab, filters, datePreset, setActiveTab, setFilters, setDatePreset } = useSalesStore();
  const { references } = useReferencesStore();
  const [aiOpen, setAiOpen] = useState(false);
  const [refModalOpen, setRefModalOpen] = useState(false);
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [sortAsc, setSortAsc] = useState(false);
  const [editSale, setEditSale] = useState<Sale | null>(null);
  const { data: sales = [], isLoading } = useSalesData();
  const { data: achats = {} } = useAchats();
  const { mutate: deleteSale } = useDeleteSale();
  const { mutateAsync: updateSale, isPending: updating } = useUpdateSale();
  const { toasts, addToast, addUndoToast, removeToast } = useToast();

  const undoTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  // Ensure active tab is still valid when references change
  useEffect(() => {
    if (references.length > 0 && !references.find((r) => r.name === activeTab)) {
      setActiveTab(references[0].name);
    }
  }, [references, activeTab, setActiveTab]);

  // PWA shortcut
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'nouvelle-vente') {
      setAiOpen(true);
      window.history.replaceState(null, '', '/');
    }
  }, []);

  const handleDelete = useCallback((sale: Sale) => {
    if (!sale._row) return;
    const toastId = `undo-${sale.id}`;

    addUndoToast(
      `${sale.acheteur} supprimé`,
      () => {
        const timer = undoTimers.current.get(toastId);
        if (timer) {
          clearTimeout(timer);
          undoTimers.current.delete(toastId);
        }
      }
    );

    const timer = setTimeout(() => {
      deleteSale({ rowIndex: sale._row! });
      undoTimers.current.delete(toastId);
    }, 5000);
    undoTimers.current.set(toastId, timer);
  }, [deleteSale, addUndoToast]);

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
        <div className="flex items-center justify-between mb-3">
          <h1 className="text-2xl font-bold text-white">Who's Bad</h1>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setStockModalOpen(true)}
              className="p-2 rounded-xl text-gray-400 hover:text-teal-400 hover:bg-teal-400/10 transition-colors"
              title="Réapprovisionner le stock"
            >
              <PackagePlus className="w-4.5 h-4.5 w-[18px] h-[18px]" />
            </button>
            <button
              onClick={() => setRefModalOpen(true)}
              className="p-2 rounded-xl text-gray-400 hover:text-primary-400 hover:bg-primary-600/10 transition-colors"
              title="Gérer les références"
            >
              <Settings2 className="w-[18px] h-[18px]" />
            </button>
          </div>
        </div>

        {/* Product tabs */}
        <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4">
          {references.map((ref) => {
            const isActive = activeTab === ref.name;
            const hex = getColorHex(ref.color);
            return (
              <button
                key={ref.id}
                onClick={() => setActiveTab(ref.name)}
                className={`flex-shrink-0 px-4 py-2 rounded-xl text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-surface-800 border border-white/15'
                    : 'text-gray-500 hover:text-gray-300'
                }`}
                style={isActive ? { color: hex } : undefined}
              >
                {ref.name}
              </button>
            );
          })}
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

      {/* List header */}
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
          Array.from({ length: 5 }).map((_, i) => <SaleCardSkeleton key={i} />)
        ) : filtered.length === 0 ? (
          <div className="flex items-center justify-center py-12 text-gray-500 text-sm">Aucune vente</div>
        ) : (
          filtered.map((sale, i) => (
            <SaleCard
              key={sale.id}
              sale={sale}
              index={i}
              onEdit={(s) => setEditSale(s)}
              onDelete={handleDelete}
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

      {/* Reference management modal */}
      <ReferenceModal isOpen={refModalOpen} onClose={() => setRefModalOpen(false)} />

      {/* Stock replenishment modal */}
      <StockModal
        isOpen={stockModalOpen}
        onClose={() => setStockModalOpen(false)}
        initialProduct={activeTab}
        onSuccess={(msg) => addToast(msg, 'success')}
        onError={(msg) => addToast(msg, 'error')}
      />

      {/* Toasts */}
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
