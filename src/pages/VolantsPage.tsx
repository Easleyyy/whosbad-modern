import { useState, useMemo, useRef, useCallback, useEffect } from 'react';
import { useAllSalesData, useAchats, useDeleteSale, useUpdateSale } from '@/hooks/useSales';
import { EditSaleModal } from '@/components/sales/EditSaleModal';
import { useSalesStore } from '@/stores/salesStore';
import { useReferencesStore } from '@/stores/referencesStore';
import { useToast } from '@/hooks/useToast';
import { SaleCard } from '@/components/sales/SaleCard';
import { SaleCardSkeleton } from '@/components/ui/Skeleton';
import { SearchBar } from '@/components/sales/SearchBar';
import { FilterPills } from '@/components/sales/FilterPills';
import { DatePresetPills } from '@/components/sales/DatePresetPills';
import { LedgerHeader } from '@/components/ledger/LedgerHeader';
import { DictationBar } from '@/components/ai/DictationBar';
import { DictationSheet } from '@/components/ai/DictationSheet';
import { ReferenceModal } from '@/components/volants/ReferenceModal';
import { StockModal } from '@/components/volants/StockModal';
import { ToastContainer } from '@/components/ui/Toast';
import { filterSales, getDateRange } from '@/lib/utils';
import type { Sale } from '@/types';

function parseTs(dateStr: string) {
  if (!dateStr) return 0;
  const [dd, mm, yy] = dateStr.split('/');
  return new Date(+yy, +mm - 1, +dd).getTime() || 0;
}

function stockState(qty: number) {
  if (qty === 0) return { word: 'rupture', color: 'rgba(40,30,22,.4)' };
  if (qty <= 8) return { word: 'à commander', color: 'oklch(0.55 0.16 28)' };
  return { word: 'ok', color: 'rgba(40,30,22,.45)' };
}

export function VolantsPage() {
  const { activeTab, filters, datePreset, setActiveTab, setFilters, setDatePreset } = useSalesStore();
  const { references } = useReferencesStore();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [refModalOpen, setRefModalOpen] = useState(false);
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [sortAsc, setSortAsc] = useState(false);
  const [editSale, setEditSale] = useState<Sale | null>(null);
  const { data: sales = [], isLoading } = useAllSalesData();
  const { data: achats = {} } = useAchats();
  const { mutate: deleteSale } = useDeleteSale();
  const { mutateAsync: updateSale, isPending: updating } = useUpdateSale();
  const { toasts, addToast, addUndoToast, removeToast } = useToast();

  const undoTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    if (params.get('action') === 'nouvelle-vente') {
      setSheetOpen(true);
      window.history.replaceState(null, '', '/');
    }
  }, []);

  const handleDelete = useCallback((sale: Sale) => {
    if (!sale._row || !sale.produit) return;
    const tab = sale.produit;
    const rowIndex = sale._row;
    const toastId = `undo-${sale.id}`;
    addUndoToast(`${sale.acheteur} supprimé`, () => {
      const t = undoTimers.current.get(toastId);
      if (t) { clearTimeout(t); undoTimers.current.delete(toastId); }
    });
    const timer = setTimeout(() => {
      deleteSale({ rowIndex, tab });
      undoTimers.current.delete(toastId);
    }, 5000);
    undoTimers.current.set(toastId, timer);
  }, [deleteSale, addUndoToast]);

  // ── Inventaire par modèle ──────────────────────────────────────────────
  const models = useMemo(
    () => references.map((ref) => {
      const bought = achats[ref.name] ?? 0;
      const sold = sales.filter((s) => s.produit === ref.name).reduce((n, s) => n + s.quantite, 0);
      return { name: ref.name, stock: Math.max(0, bought - sold) };
    }),
    [references, achats, sales]
  );

  const kpis = useMemo(() => {
    const stock = models.reduce((n, m) => n + m.stock, 0);
    const sold = sales.reduce((n, s) => n + s.quantite, 0);
    const unpaid = sales.filter((s) => s.paye === 'Non').length;
    const cash = sales.filter((s) => s.paye === 'Oui').reduce((n, s) => n + (s.montant ?? 0), 0);
    return [
      { label: 'EN STOCK', value: stock },
      { label: 'VENDU', value: sold },
      { label: 'IMPAYÉ', value: unpaid, alert: unpaid > 0 },
      { label: 'CAISSE', value: `${cash.toFixed(0)} €` },
    ];
  }, [models, sales]);

  // ── Mouvements ───────────────────────────────────────────────────────
  const modelSales = useMemo(
    () => (activeTab ? sales.filter((s) => s.produit === activeTab) : sales),
    [sales, activeTab]
  );

  const dateRange = useMemo(() => getDateRange(datePreset), [datePreset]);

  const filtered = useMemo(() => {
    const base = filterSales(modelSales, filters.search ?? '', filters.status ?? 'all', dateRange.dateFrom, dateRange.dateTo);
    return [...base].sort((a, b) => {
      const diff = parseTs(a.date) - parseTs(b.date);
      return sortAsc ? diff : -diff;
    });
  }, [modelSales, filters, dateRange, sortAsc]);

  const counts = useMemo(() => ({
    all: modelSales.length,
    paid: modelSales.filter((s) => s.paye === 'Oui').length,
    pending: modelSales.filter((s) => s.paye === 'Non').length,
    dash: modelSales.filter((s) => s.paye === '-').length,
  }), [modelSales]);

  return (
    <div className="mx-auto flex h-full w-full max-w-[480px] flex-col bg-paper lg:max-w-[1040px]">
      <LedgerHeader
        title="Registre des volants"
        kpis={kpis}
        folio={sales.length ? `N° ${sales.length}` : undefined}
        actions={[
          { label: 'RÉASSORT', onClick: () => setStockModalOpen(true) },
          { label: 'RÉFÉRENCES', onClick: () => setRefModalOpen(true) },
        ]}
      />

      <div className="flex flex-1 flex-col overflow-hidden lg:flex-row lg:gap-10 lg:px-[22px] lg:pt-3">
        {/* Inventaire par modèle */}
        <section className="flex-none px-[22px] pt-3 pb-1.5 lg:w-[260px] lg:flex-shrink-0 lg:overflow-y-auto lg:border-r-[1.5px] lg:border-ink-rule lg:px-0 lg:pb-0 lg:pr-8 lg:pt-0">
          <div className="mb-1.5 font-mono text-[9px] font-medium tracking-label text-ink-45">
            INVENTAIRE PAR MODÈLE
          </div>
          {models.map((m) => {
            const state = stockState(m.stock);
            const on = activeTab === m.name;
            return (
              <button
                key={m.name}
                onClick={() => setActiveTab(on ? null : m.name)}
                aria-label={`${m.name}, ${m.stock} boîtes en stock`}
                aria-pressed={on}
                className={`flex w-full items-baseline gap-2 py-[5px] text-left ${on ? 'border-b border-ink bg-ink/[.05]' : 'border-b border-dotted border-ink-dot'}`}
              >
                <span className="text-[12px] font-medium text-ink">{m.name}</span>
                <span className="flex-1" />
                <span className="font-mono text-[10px] font-medium" style={{ color: state.color }}>
                  {state.word}
                </span>
                <span className="w-[34px] text-right font-mono text-[13px] font-semibold text-ink">{m.stock}</span>
              </button>
            );
          })}
        </section>

        {/* Mouvements */}
        <section className="flex-1 overflow-y-auto no-scrollbar px-[22px] pt-2.5 lg:px-0 lg:pt-0">
          <div className="mb-1.5 flex items-baseline justify-between">
            <span className="font-mono text-[9px] font-medium tracking-label text-ink-45">MOUVEMENTS</span>
            <button
              onClick={() => setSortAsc((v) => !v)}
              className="font-mono text-[9px] font-medium tracking-label text-ink-45 hover:text-ink"
            >
              {sortAsc ? 'ANCIEN' : 'RÉCENT'}
            </button>
          </div>

          <div className="space-y-2 pb-2 lg:flex lg:flex-wrap lg:items-center lg:gap-x-6 lg:gap-y-2 lg:space-y-0">
            <div className="lg:w-[220px] lg:flex-shrink-0">
              <SearchBar value={filters.search ?? ''} onChange={(v) => setFilters({ search: v })} />
            </div>
            <DatePresetPills active={datePreset} onChange={setDatePreset} />
            <FilterPills
              active={(filters.status ?? 'all') as 'all' | 'paid' | 'pending' | 'dash'}
              onChange={(s) => setFilters({ status: s })}
              counts={counts}
            />
          </div>

          {isLoading ? (
            Array.from({ length: 5 }).map((_, i) => <SaleCardSkeleton key={i} />)
          ) : filtered.length === 0 ? (
            <p className="py-10 text-center text-[12px] text-ink-45">
              {filters.search || filters.status !== 'all' ? 'Aucun résultat' : 'Aucun mouvement'}
            </p>
          ) : (
            filtered.map((sale, i) => (
              <SaleCard key={sale.id} sale={sale} index={i} onEdit={setEditSale} onDelete={handleDelete} />
            ))
          )}
        </section>
      </div>

      <DictationBar onClick={() => setSheetOpen(true)} />

      {editSale && (
        <EditSaleModal
          sale={editSale}
          loading={updating}
          onClose={() => setEditSale(null)}
          onSave={async (body) => {
            try {
              await updateSale(body as Record<string, unknown>);
              addToast(`Mis à jour · ${editSale.acheteur}`, 'success');
              setEditSale(null);
            } catch { addToast('Erreur lors de la mise à jour', 'error'); }
          }}
        />
      )}

      <DictationSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSuccess={(msg) => addToast(msg, 'success')}
        onError={(msg) => addToast(msg, 'error')}
      />

      <ReferenceModal isOpen={refModalOpen} onClose={() => setRefModalOpen(false)} />

      <StockModal
        isOpen={stockModalOpen}
        onClose={() => setStockModalOpen(false)}
        initialProduct={activeTab}
        onSuccess={(msg) => addToast(msg, 'success')}
        onError={(msg) => addToast(msg, 'error')}
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
