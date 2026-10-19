import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { LedgerHeader } from '@/components/ledger/LedgerHeader';
import { SaleCardSkeleton } from '@/components/ui/Skeleton';
import { useMemberIndex } from '@/hooks/useMemberIndex';
import { useElementWidth } from '@/hooks/useLayout';
import { useSaleEditor } from '@/stores/saleEditorStore';
import { searchMembers, sortMembers, type MemberSort, type MemberSummary } from '@/lib/memberStats';
import { parseDMY } from '@/lib/stockCoverage';
import { cn, formatShortDate } from '@/lib/utils';
import type { Sale } from '@/types';

const TWO_PANES_FROM = 760;
const DAY = 86_400_000;

const CHIP: Record<Sale['paye'], { label: string; color: string }> = {
  Oui: { label: 'PAYÉ', color: 'oklch(0.4 0.1 145)' },
  Non: { label: 'ATTENTE', color: 'oklch(0.55 0.16 28)' },
  '-': { label: 'SOLDÉ', color: 'rgba(40,30,22,.6)' },
};

/** « aujourd'hui », « il y a 3 j », « il y a 2 mois » — un ordre de grandeur suffit. */
function since(dmy: string): string {
  const t = parseDMY(dmy);
  if (!t) return '—';
  const days = Math.floor((Date.now() - t) / DAY);
  if (days <= 0) return "aujourd'hui";
  if (days === 1) return 'hier';
  if (days < 45) return `il y a ${days} j`;
  if (days < 365) return `il y a ${Math.round(days / 30)} mois`;
  return `il y a ${(days / 365).toFixed(1).replace('.', ',')} an`;
}

const plural = (n: number, one: string, many: string) => `${n} ${n > 1 ? many : one}`;

export function AdherentsPage() {
  const navigate = useNavigate();
  const { index, isLoading } = useMemberIndex();
  const [pageRef, width] = useElementWidth<HTMLDivElement>();
  const twoPanes = width >= TWO_PANES_FROM;

  const [query, setQuery] = useState('');
  const [sort, setSort] = useState<MemberSort>('recent');
  const [teams, setTeams] = useState(false);
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const people = useMemo(() => index.filter((m) => !m.isTeam), [index]);
  const teamList = useMemo(() => index.filter((m) => m.isTeam), [index]);
  const list = useMemo(() => sortMembers(searchMembers(teams ? teamList : people, query), query.trim() ? 'alpha' : sort), [people, teamList, teams, query, sort]);
  const selected = useMemo(() => index.find((m) => m.key === selectedKey) ?? null, [index, selectedKey]);

  const buyers = people.filter((m) => m.salesCount > 0).length;

  const listPane = (
    <div className={cn('flex min-h-0 flex-col', twoPanes ? 'w-[340px] flex-none border-r-[1.5px] border-ink-rule pr-6' : 'flex-1 px-[22px]')}>
      <div className="flex-none space-y-2.5 pb-2 pt-3">
        <label htmlFor="adh-search" className="sr-only">Chercher un adhérent</label>
        <input
          id="adh-search"
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Chercher un nom…"
          autoComplete="off"
          className="w-full border-[1.5px] border-ink bg-transparent px-3 py-3 text-[14px] text-ink placeholder:text-ink-40 focus:outline-none"
        />
        <div className="flex items-center justify-between gap-3">
          <div className="flex gap-4 font-mono text-[11px]">
            {([[false, `Adhérents ${people.length}`], [true, `Équipes ${teamList.length}`]] as const).map(([isTeams, label]) => (
              <button key={label} onClick={() => setTeams(isTeams)} aria-pressed={teams === isTeams}
                className={cn('min-h-[36px] pb-0.5', teams === isTeams ? 'border-b-[1.5px] border-ink font-semibold text-ink' : 'text-ink-55')}>
                {label}
              </button>
            ))}
          </div>
          {!query.trim() && (
            <select
              aria-label="Trier"
              value={sort}
              onChange={(e) => setSort(e.target.value as MemberSort)}
              className="min-h-[36px] appearance-none bg-transparent font-mono text-[10px] font-medium tracking-label text-ink-55"
            >
              <option value="recent">RÉCENTS ▾</option>
              <option value="alpha">A → Z ▾</option>
              <option value="boxes">+ DE BOÎTES ▾</option>
            </select>
          )}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar">
        {isLoading ? (
          Array.from({ length: 6 }).map((_, i) => <SaleCardSkeleton key={i} />)
        ) : list.length === 0 ? (
          <p className="py-10 text-center text-[12px] text-ink-55">
            {query.trim() ? 'Aucun résultat — pour l’ajouter, dis « ajoute l’adhérent Prénom NOM » à l’assistant.' : 'Personne ici pour l’instant.'}
          </p>
        ) : (
          list.map((m) => (
            <button
              key={m.key}
              onClick={() => setSelectedKey(m.key)}
              aria-current={selectedKey === m.key}
              className={cn(
                'block min-h-[52px] w-full border-b border-dotted border-ink-dot py-2 text-left',
                selectedKey === m.key && twoPanes && 'bg-ink/[.05]'
              )}
            >
              <span className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate text-[13.5px] font-medium text-ink">{m.name}</span>
                <span className="flex-shrink-0 font-mono text-[12px] font-semibold text-ink">{m.totalBoxes}</span>
              </span>
              <span className="flex items-baseline justify-between gap-3 font-mono text-[10.5px] text-ink-55">
                <span>{m.salesCount ? `dernier achat ${since(m.lastDate)}` : 'aucun achat'}</span>
                {m.unpaidCount > 0 && <span className="font-semibold text-alert">{plural(m.unpaidCount, 'impayé', 'impayés')} · {m.unpaidAmount.toFixed(0)} €</span>}
              </span>
            </button>
          ))
        )}
      </div>
    </div>
  );

  return (
    <div ref={pageRef} className="relative mx-auto flex h-full w-full max-w-[1200px] flex-col bg-paper">
      <LedgerHeader
        title="Adhérents"
        caption={`${people.length} adhérents · ${buyers} ont déjà acheté`}
        actions={[{ label: 'GROUPES D’ENTRAÎNEMENT ›', onClick: () => navigate('/entrainements') }]}
      />

      <div className={cn('flex min-h-0 flex-1 overflow-hidden', twoPanes && 'gap-8 px-[22px]')}>
        {listPane}
        {twoPanes && (
          <div className="min-w-0 flex-1 overflow-y-auto no-scrollbar pt-3">
            {selected ? <MemberFiche member={selected} /> : (
              <p className="pt-16 text-center text-[13px] text-ink-55">Choisis un adhérent pour voir ses achats.</p>
            )}
          </div>
        )}
      </div>

      {/* Une seule colonne : la fiche recouvre la liste, avec un retour */}
      {!twoPanes && selected && (
        <div className="absolute inset-0 z-30 overflow-y-auto bg-paper px-[22px] pb-6 pt-3">
          <button onClick={() => setSelectedKey(null)} className="mb-2 min-h-[44px] font-mono text-[11px] font-medium tracking-label text-ink-55">
            ‹ RETOUR À LA LISTE
          </button>
          <MemberFiche member={selected} />
        </div>
      )}
    </div>
  );
}

function MemberFiche({ member: m }: { member: MemberSummary }) {
  const { openEditor, openNew } = useSaleEditor();
  const [all, setAll] = useState(false);
  const shown = all ? m.sales : m.sales.slice(0, 8);
  const maxProduct = Math.max(1, ...Object.values(m.byProduct));
  const products = Object.entries(m.byProduct).sort((a, b) => b[1] - a[1]);

  return (
    <article aria-label={`Fiche de ${m.name}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-serif text-[30px] leading-tight text-ink">{m.name}</h2>
          <p className="mt-1 flex flex-wrap gap-x-3 font-mono text-[10.5px] tracking-label text-ink-55">
            {m.isTeam && <span>ÉQUIPE / GROUPE</span>}
            {m.groups.map((g) => <span key={g}>{g.toUpperCase()}</span>)}
          </p>
        </div>
        <button
          onClick={() => openNew({ buyer: m.name })}
          className="min-h-[44px] border-[1.5px] border-ink bg-ink px-4 text-[13px] font-semibold text-paper hover:-translate-y-px"
        >
          + Nouvelle vente
        </button>
      </div>

      <dl className="mt-4 grid grid-cols-2 gap-x-6 gap-y-3 border-y border-ink-rule py-3 sm:grid-cols-4">
        <Stat label="BOÎTES ACHETÉES" value={String(m.totalBoxes)} />
        <Stat label="ACHATS" value={String(m.salesCount)} />
        <Stat label="À PAYER" value={m.unpaidAmount > 0 ? `${m.unpaidAmount.toFixed(0)} €` : '—'} alert={m.unpaidAmount > 0} sub={m.unpaidCount > 0 ? plural(m.unpaidCount, 'vente', 'ventes') : undefined} />
        <Stat label="DERNIER ACHAT" value={m.salesCount ? since(m.lastDate) : '—'} small />
      </dl>

      {m.variants.length > 1 && (
        <p className="mt-2 text-[11.5px] text-ink-55">Écrit de {m.variants.length} façons ({m.variants.join(' · ')}) — regroupées ici.</p>
      )}

      {products.length > 0 && (
        <section className="mt-5" aria-label="Par modèle">
          <h3 className="mb-1.5 font-mono text-[10px] font-medium tracking-label text-ink-55">PAR MODÈLE</h3>
          {products.map(([name, n]) => (
            <div key={name} className="flex items-center gap-3 border-b border-dotted border-ink-dot py-1.5">
              <span className="w-[104px] flex-shrink-0 truncate text-[12.5px] text-ink">{name}</span>
              <span className="h-[6px] flex-1 bg-ink/10"><span className="block h-full bg-ink" style={{ width: `${(n / maxProduct) * 100}%` }} /></span>
              <span className="w-8 text-right font-mono text-[12.5px] font-semibold text-ink">{n}</span>
            </div>
          ))}
        </section>
      )}

      <section className="mt-5" aria-label="Derniers achats">
        <h3 className="mb-1.5 font-mono text-[10px] font-medium tracking-label text-ink-55">DERNIERS ACHATS</h3>
        {m.sales.length === 0 ? (
          <p className="py-4 text-[12.5px] text-ink-55">Aucun achat enregistré.</p>
        ) : (
          shown.map((s) => {
            const chip = CHIP[s.paye] ?? CHIP['-'];
            return (
              <button key={s.id} onClick={() => openEditor(s)} className="flex min-h-[44px] w-full items-baseline gap-3 border-b border-ink-hairline py-2 text-left">
                <span className="w-11 flex-shrink-0 font-mono text-[10.5px] text-ink-55">{formatShortDate(s.date)}</span>
                <span className="min-w-0 flex-1 truncate text-[13px] text-ink">{s.quantite} × {s.produit}</span>
                <span className="flex-shrink-0 border-b-[1.5px] font-mono text-[10px] font-semibold" style={{ color: chip.color, borderColor: chip.color }}>{chip.label}</span>
              </button>
            );
          })
        )}
        {m.sales.length > 8 && (
          <button onClick={() => setAll((v) => !v)} className="mt-1 min-h-[44px] font-mono text-[11px] font-medium tracking-label text-ink-55 hover:text-ink">
            {all ? 'VOIR MOINS' : `VOIR LES ${m.sales.length} ACHATS`}
          </button>
        )}
      </section>
    </article>
  );
}

function Stat({ label, value, sub, alert, small }: { label: string; value: string; sub?: string; alert?: boolean; small?: boolean }) {
  return (
    <div>
      <dt className="font-mono text-[9.5px] font-medium tracking-kpi text-ink-55">{label}</dt>
      <dd className={cn('stat-value font-serif leading-none', small ? 'mt-1 text-[19px]' : 'text-[30px]', alert ? 'text-alert' : 'text-ink')}>{value}</dd>
      {sub && <p className="mt-0.5 font-mono text-[10px] text-ink-55">{sub}</p>}
    </div>
  );
}
