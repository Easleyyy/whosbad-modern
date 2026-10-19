import { useState, useMemo, useRef, useCallback } from 'react';
import { useAllReassortLog } from '@/hooks/useSales';
import { useInventory } from '@/hooks/useInventory';
import { useSaleDeletion } from '@/hooks/useSaleDeletion';
import { useElementWidth } from '@/hooks/useLayout';
import { useSaleEditor } from '@/stores/saleEditorStore';
import { COVERAGE_WORD, formatCoverage, type CoverageStatus } from '@/lib/stockCoverage';
import { useSalesStore } from '@/stores/salesStore';
import { useToast } from '@/hooks/useToast';
import { SaleCard } from '@/components/sales/SaleCard';
import { ReassortCard } from '@/components/sales/ReassortCard';
import { SaleCardSkeleton } from '@/components/ui/Skeleton';
import { SearchBar } from '@/components/sales/SearchBar';
import { FilterPills } from '@/components/sales/FilterPills';
import { DatePresetPills } from '@/components/sales/DatePresetPills';
import { LedgerHeader } from '@/components/ledger/LedgerHeader';
import { ReferenceModal } from '@/components/volants/ReferenceModal';
import { StockModal } from '@/components/volants/StockModal';
import { ToastContainer } from '@/components/ui/Toast';
import { cn, filterSales, getDateRange } from '@/lib/utils';
import type { Sale, ReassortEntry } from '@/types';

function parseTs(dateStr: string) {
  if (!dateStr) return 0;
  const [dd, mm, yy] = dateStr.split('/');
  return new Date(+yy, +mm - 1, +dd).getTime() || 0;
}

type Movement =
  | { kind: 'vente'; date: string; sale: Sale }
  | { kind: 'reassort'; date: string; entry: ReassortEntry };

const COVERAGE_COLOR: Record<CoverageStatus, string> = {
  rupture: 'oklch(0.55 0.16 28)',
  proche: 'oklch(0.55 0.16 28)',
  prevoir: 'oklch(0.5 0.12 72)',
  ok: 'rgba(40,30,22,.6)',
  dormant: 'rgba(40,30,22,.6)',
};

/** Below this much room the registre is a single column (inventory above the movements). */
const TWO_COLUMNS_FROM = 720;

export function VolantsPage() {
  const { activeTab, filters, datePreset, movementKind, setActiveTab, setFilters, setDatePreset, setMovementKind, resetFilters } = useSalesStore();
  const [refModalOpen, setRefModalOpen] = useState(false);
  const [stockModalOpen, setStockModalOpen] = useState(false);
  const [sortAsc, setSortAsc] = useState(false);
  const { items: models, sales, isLoading } = useInventory();
  const { data: reassortEntries = [] } = useAllReassortLog();
  const { toasts, addToast, removeToast } = useToast();
  const { openEditor, openNew } = useSaleEditor();
  const requestDelete = useSaleDeletion();
  const [pageRef, pageWidth] = useElementWidth<HTMLDivElement>();
  const wide = pageWidth >= TWO_COLUMNS_FROM;

  const [inventoryOpen, setInventoryOpen] = useState(false);
  const needsAttention = (m: (typeof models)[number]) => ['rupture', 'proche', 'prevoir'].includes(m.coverage.status);
  const watch = models.filter(needsAttention).length;
  // On a narrow page the full inventory would push the movements off-screen: show only what needs
  // attention (plus the model being filtered on) until the person asks for everything.
  const visibleModels = wide || inventoryOpen ? models : models.filter((m) => needsAttention(m) || m.name === activeTab);

  // Each headline figure narrows the ledger to the rows that make it up:
  // EN STOCK → restocks, VENDU → sales, IMPAYÉ → unpaid sales. Click again to clear.
  // The totals are global, so a click also drops the model/search/date filters.
  type KpiId = 'stock' | 'sold' | 'unpaid';

  const unfiltered = !activeTab && !filters.search && datePreset === 'all';
  const activeKpi: KpiId | null = !unfiltered
    ? null
    : movementKind === 'reassort' && (filters.status ?? 'all') === 'all'
      ? 'stock'
      : movementKind === 'vente' && filters.status === 'pending'
        ? 'unpaid'
        : movementKind === 'vente' && (filters.status ?? 'all') === 'all'
          ? 'sold'
          : null;

  const movementsRef = useRef<HTMLElement>(null);

  const toggleKpi = useCallback((id: KpiId) => {
    const clearing = activeKpi === id;
    resetFilters();
    setActiveTab(null);
    if (!clearing) {
      setMovementKind(id === 'stock' ? 'reassort' : 'vente');
      if (id === 'unpaid') setFilters({ status: 'pending' });
    }
    movementsRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  }, [activeKpi, resetFilters, setActiveTab, setMovementKind, setFilters]);

  const kpis = useMemo(() => {
    const stock = models.reduce((n, m) => n + m.stock, 0);
    const sold = sales.reduce((n, s) => n + s.quantite, 0);
    const unpaid = sales.filter((s) => s.paye === 'Non').length;
    const cash = sales.filter((s) => s.paye === 'Oui').reduce((n, s) => n + (s.montant ?? 0), 0);
    return [
      { label: 'EN STOCK', value: stock, onClick: () => toggleKpi('stock'), active: activeKpi === 'stock' },
      { label: 'VENDU', value: sold, onClick: () => toggleKpi('sold'), active: activeKpi === 'sold' },
      { label: 'IMPAYÉ', value: unpaid, alert: unpaid > 0, onClick: () => toggleKpi('unpaid'), active: activeKpi === 'unpaid' },
      { label: 'CAISSE', value: `${cash.toFixed(0)} €` },
    ];
  }, [models, sales, activeKpi, toggleKpi]);

  // ── Mouvements ───────────────────────────────────────────────────────
  const modelSales = useMemo(
    () => (activeTab ? sales.filter((s) => s.produit === activeTab) : sales),
    [sales, activeTab]
  );

  const modelReassort = useMemo(
    () => (activeTab ? reassortEntries.filter((r) => r.produit === activeTab) : reassortEntries),
    [reassortEntries, activeTab]
  );

  const dateRange = useMemo(() => getDateRange(datePreset), [datePreset]);

  const filteredSales = useMemo(
    () => filterSales(modelSales, filters.search ?? '', filters.status ?? 'all', dateRange.dateFrom, dateRange.dateTo),
    [modelSales, filters, dateRange]
  );

  // Réassort n'a pas de statut de paiement — masqué dès qu'un filtre de statut
  // autre que "Tous" est actif, plutôt que de l'ignorer silencieusement.
  const filteredReassort = useMemo(() => {
    if ((filters.status ?? 'all') !== 'all') return [];
    const fromTs = dateRange.dateFrom ? parseTs(dateRange.dateFrom) : 0;
    const toTs = dateRange.dateTo ? parseTs(dateRange.dateTo) + 86_400_000 - 1 : Infinity;
    const q = (filters.search ?? '').toLowerCase();
    return modelReassort.filter((r) => {
      if (dateRange.dateFrom || dateRange.dateTo) {
        const ts = parseTs(r.date);
        if (ts < fromTs || ts > toTs) return false;
      }
      return q ? r.produit.toLowerCase().includes(q) : true;
    });
  }, [modelReassort, filters, dateRange]);

  const movements = useMemo<Movement[]>(() => {
    const combined: Movement[] = [
      ...(movementKind === 'reassort' ? [] : filteredSales.map((sale): Movement => ({ kind: 'vente', date: sale.date, sale }))),
      ...(movementKind === 'vente' ? [] : filteredReassort.map((entry): Movement => ({ kind: 'reassort', date: entry.date, entry }))),
    ];
    return combined.sort((a, b) => {
      const diff = parseTs(a.date) - parseTs(b.date);
      return sortAsc ? diff : -diff;
    });
  }, [filteredSales, filteredReassort, sortAsc, movementKind]);

  const counts = useMemo(() => ({
    all: modelSales.length,
    paid: modelSales.filter((s) => s.paye === 'Oui').length,
    pending: modelSales.filter((s) => s.paye === 'Non').length,
    dash: modelSales.filter((s) => s.paye === '-').length,
  }), [modelSales]);

  return (
    <div ref={pageRef} className="mx-auto flex h-full w-full max-w-[1440px] flex-col bg-paper">
      <LedgerHeader
        title="Registre des volants"
        kpis={kpis}
        folio={sales.length ? `N° ${sales.length}` : undefined}
        actions={[
          { label: '+ VENTE', onClick: () => openNew({ produit: activeTab ?? undefined }) },
          { label: 'RÉASSORT', onClick: () => setStockModalOpen(true) },
          { label: 'RÉFÉRENCES', onClick: () => setRefModalOpen(true) },
        ]}
      />

      <div className={cn('flex min-h-0 flex-1 overflow-hidden', wide && 'px-[22px]')}>
        <div className={cn('flex min-h-0 min-w-0 flex-1 overflow-hidden', wide ? 'flex-row gap-10 pt-3' : 'flex-col')}>
          {/* Inventaire par modèle, avec le nombre de jours de stock estimés */}
          <section
            aria-label="Inventaire par modèle"
            className={cn(
              'flex-none',
              wide ? 'w-[300px] overflow-y-auto border-r-[1.5px] border-ink-rule pr-8' : 'px-[22px] pt-3 pb-1.5'
            )}
          >
            <div className="mb-1 flex items-baseline justify-between">
              <span className="font-mono text-[10px] font-medium tracking-label text-ink-55">INVENTAIRE PAR MODÈLE</span>
              {watch > 0 && <span className="font-mono text-[10px] font-semibold text-alert">{watch} À SURVEILLER</span>}
            </div>
            {(wide || inventoryOpen) && (
              <p className="mb-1.5 text-[10.5px] leading-snug text-ink-55">
                Jours de stock estimés d’après les ventes des 60 derniers jours.
              </p>
            )}
            {visibleModels.map((m) => {
              const on = activeTab === m.name;
              const c = m.coverage;
              return (
                <button
                  key={m.name}
                  onClick={() => setActiveTab(on ? null : m.name)}
                  aria-label={`${m.name}, ${m.stock} boîtes en stock, ${formatCoverage(c)}`}
                  aria-pressed={on}
                  className={cn('flex min-h-[40px] w-full items-baseline gap-2 py-[7px] text-left', on ? 'border-b border-ink bg-ink/[.05]' : 'border-b border-dotted border-ink-dot')}
                >
                  <span className="text-[12.5px] font-medium text-ink">{m.name}</span>
                  <span className="flex-1" />
                  <span className="font-mono text-[10.5px] font-medium" style={{ color: COVERAGE_COLOR[c.status] }}>
                    {COVERAGE_WORD[c.status]}
                  </span>
                  <span className="w-[52px] text-right font-mono text-[10.5px] text-ink-55">
                    {c.days === null || c.status === 'rupture' ? '' : formatCoverage(c)}
                  </span>
                  <span className="w-[34px] text-right font-mono text-[13px] font-semibold text-ink">{m.stock}</span>
                </button>
              );
            })}
            {!wide && (
              <button onClick={() => setInventoryOpen((v) => !v)} aria-expanded={inventoryOpen} className="min-h-[44px] font-mono text-[10.5px] font-medium tracking-label text-ink-55 hover:text-ink">
                {inventoryOpen ? 'RÉDUIRE L’INVENTAIRE ▴' : `TOUT L’INVENTAIRE (${models.length}) ▾`}
              </button>
            )}
          </section>

          {/* Mouvements */}
          <section ref={movementsRef} aria-label="Mouvements" className={cn('min-w-0 flex-1 overflow-y-auto no-scrollbar', wide ? '' : 'px-[22px] pt-2.5')}>
            <div className="mb-1.5 flex items-baseline justify-between">
              <span className="font-mono text-[10px] font-medium tracking-label text-ink-55">
                {activeKpi === 'stock' ? 'MOUVEMENTS · ENTRÉES EN STOCK' : activeKpi === 'sold' ? 'MOUVEMENTS · VENTES' : activeKpi === 'unpaid' ? 'MOUVEMENTS · VENTES IMPAYÉES' : 'MOUVEMENTS'}
              </span>
              <button
                onClick={() => setSortAsc((v) => !v)}
                className="min-h-[32px] font-mono text-[10px] font-medium tracking-label text-ink-55 hover:text-ink"
              >
                {sortAsc ? 'ANCIEN' : 'RÉCENT'}
              </button>
            </div>

            <div className={cn('pb-2', wide ? 'flex flex-wrap items-center gap-x-6 gap-y-2' : 'space-y-2')}>
              <div className={cn(wide && 'w-[220px] flex-shrink-0')}>
                <SearchBar value={filters.search ?? ''} onChange={(v) => setFilters({ search: v })} />
              </div>
              <DatePresetPills active={datePreset} onChange={setDatePreset} />
              <FilterPills
                active={(filters.status ?? 'all') as 'all' | 'paid' | 'pending' | 'dash'}
                onChange={(st) => {
                  setFilters({ status: st });
                  // Restocks have no payment status — leaving them "only" would show nothing.
                  if (st !== 'all' && movementKind === 'reassort') setMovementKind('all');
                }}
                counts={counts}
              />
            </div>

            {isLoading ? (
              Array.from({ length: 5 }).map((_, i) => <SaleCardSkeleton key={i} />)
            ) : movements.length === 0 ? (
              <p className="py-10 text-center text-[12px] text-ink-55">
                {filters.search || filters.status !== 'all' ? 'Aucun résultat' : 'Aucun mouvement'}
              </p>
            ) : (
              movements.map((m, i) =>
                m.kind === 'vente' ? (
                  <SaleCard key={m.sale.id} sale={m.sale} index={i} onEdit={openEditor} onDelete={requestDelete} />
                ) : (
                  <ReassortCard
                    key={`reassort-${m.entry.produit}-${m.entry._row}`}
                    entry={m.entry}
                    index={i}
                    onSuccess={(msg) => addToast(msg, 'success')}
                    onError={(msg) => addToast(msg, 'error')}
                  />
                )
              )
            )}
          </section>
        </div>
      </div>

      <ReferenceModal isOpen={refModalOpen} onClose={() => setRefModalOpen(false)} />

      <StockModal
        isOpen={stockModalOpen}
        onClose={() => setStockModalOpen(false)}
        initialProduct={activeTab}
        onSuccess={(msg) => addToast(msg, 'success')}
        onError={(msg) => addToast(msg, 'error')}
        onSlow={() => addToast('Réveil du serveur… patiente quelques secondes', 'info')}
      />

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
