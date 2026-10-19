import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useModalGestures } from '@/hooks/useModalGestures';
import { useInventory } from '@/hooks/useInventory';
import { useMemberIndex } from '@/hooks/useMemberIndex';
import { useAddSale } from '@/hooks/useSales';
import { memberKey, normalizeMemberName } from '@/lib/memberNames';
import { isTeamName, searchMembers, sortMembers } from '@/lib/memberStats';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import type { Sale } from '@/types';

// Vendeur par défaut : 94 % des ventes sont saisies par la même personne ; modifiable ensuite dans l'éditeur.
const DEFAULT_VENDEUR = 'Dadou';

interface Props {
  options: { buyer?: string; produit?: string };
  onClose: () => void;
  /** The sale exists as soon as product and buyer are chosen; the editor takes over from here. */
  onCreated: (sale: Sale) => void;
}

export function NewSaleSheet({ options, onClose, onCreated }: Props) {
  const { items } = useInventory();
  const { index, addMember } = useMemberIndex();
  const { mutateAsync: addSale, isPending } = useAddSale();
  const { y, bind } = useModalGestures(true, onClose);

  const [produit, setProduit] = useState<string | null>(options.produit ?? null);
  const [buyer, setBuyer] = useState<string | null>(options.buyer ?? null);
  const [query, setQuery] = useState('');
  const [error, setError] = useState('');

  const suggestions = useMemo(() => {
    const people = index.filter((m) => !m.isTeam);
    if (!query.trim()) return sortMembers(people, 'recent').slice(0, 6);
    return searchMembers(index, query).slice(0, 6);
  }, [index, query]);

  const typedName = normalizeMemberName(query);
  // « lubiatto frederic » is the same person as « Frédéric LUBIATTO »: compare the words, not their order.
  const wordsOf = (k: string) => k.split(' ').filter(Boolean).sort().join(' ');
  const showNew = !!typedName && !index.some((m) => wordsOf(m.key) === wordsOf(memberKey(typedName)));

  const create = async (p: string, b: string, isNew: boolean) => {
    setError('');
    try {
      const price = items.find((i) => i.name === p)?.price ?? 0;
      const row = await addSale({ tab: p, acheteur: b, quantite: 1, paye: isTeamName(b) ? '-' : 'Non', vendeur: DEFAULT_VENDEUR });
      if (isNew) void addMember(b);
      onCreated({
        id: `${p}-${row}`, _row: row, date: format(new Date(), 'dd/MM/yyyy'), vendeur: DEFAULT_VENDEUR, acheteur: b,
        quantite: 1, paye: isTeamName(b) ? '-' : 'Non', mode_paiement: '', commentaire: '', produit: p, montant: price,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Création impossible');
    }
  };

  const pickProduit = (p: string) => { setProduit(p); if (buyer && !isPending) void create(p, buyer, false); };
  const pickBuyer = (b: string, isNew = false) => { setBuyer(b); if (produit && !isPending) void create(produit, b, isNew); };

  const labelClass = 'mb-1.5 block font-mono text-[10px] font-medium tracking-label text-ink-55';

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40" style={{ background: 'rgba(40,30,22,.35)' }} onClick={onClose} />
      <motion.div
        role="dialog" aria-label="Nouvelle vente"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }} style={{ y }}
        className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] max-w-[560px] flex-col border-t-2 border-ink bg-paper pb-safe"
      >
        <div className="flex-none px-5 pt-4 pb-3" {...bind()}>
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="font-mono text-[10px] font-medium tracking-label text-ink-55">AJOUT À LA MAIN</p>
              <p className="mt-0.5 font-serif text-[24px] leading-tight text-ink">Nouvelle vente</p>
            </div>
            <button onClick={onClose} className="min-h-[44px] px-1 font-mono text-[11px] font-medium tracking-kpi text-ink-55">FERMER</button>
          </div>
          <p className="mt-1 text-[12px] text-ink-55" aria-live="polite">
            {isPending ? 'Création de la vente…' : 'La vente est créée dès que le produit et l’adhérent sont choisis.'}
          </p>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-4">
          <div>
            <span className={labelClass}>PRODUIT</span>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {items.map((it) => (
                <button key={it.name} onClick={() => pickProduit(it.name)} aria-pressed={produit === it.name} disabled={isPending}
                  className={cn('min-h-[56px] border-[1.5px] px-3 py-2 text-left transition-colors',
                    produit === it.name ? 'border-ink bg-ink text-paper' : 'border-ink-rule text-ink hover:border-ink')}>
                  <span className="block text-[13.5px] font-semibold leading-tight">{it.name}</span>
                  <span className={cn('block font-mono text-[10.5px]', produit === it.name ? 'text-paper/80' : 'text-ink-55')}>
                    {it.price} € · reste {it.stock}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="ns-buyer" className={labelClass}>ADHÉRENT</label>
            {buyer ? (
              <div className="flex items-center justify-between gap-3 border-[1.5px] border-ink px-3 py-2.5">
                <span className="text-[14px] font-medium text-ink">{buyer}</span>
                <button onClick={() => setBuyer(null)} disabled={isPending} className="min-h-[44px] px-2 font-mono text-[11px] text-ink-55">CHANGER</button>
              </div>
            ) : (
              <>
                <input id="ns-buyer" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Chercher ou saisir Prénom NOM…" autoComplete="off"
                  className="w-full border-[1.5px] border-ink bg-transparent px-3 py-3 text-[14px] text-ink placeholder:text-ink-40 focus:outline-none" />
                <ul className="mt-2 border-t border-ink-hairline">
                  {!query.trim() && <li className="pt-2 font-mono text-[10px] tracking-label text-ink-55">DERNIERS ACHETEURS</li>}
                  {suggestions.map((m) => (
                    <li key={m.key}>
                      <button onClick={() => pickBuyer(m.name)} disabled={isPending}
                        className="flex min-h-[48px] w-full items-baseline justify-between gap-3 border-b border-dotted border-ink-dot py-2 text-left">
                        <span className="min-w-0 truncate text-[14px] font-medium text-ink">{m.name}{m.isTeam && <span className="ml-2 font-mono text-[10px] text-ink-55">ÉQUIPE</span>}</span>
                        <span className="flex-shrink-0 font-mono text-[11px] text-ink-55">{m.totalBoxes} boîte{m.totalBoxes !== 1 ? 's' : ''}</span>
                      </button>
                    </li>
                  ))}
                  {showNew && typedName && (
                    <li>
                      <button onClick={() => pickBuyer(typedName, true)} disabled={isPending}
                        className="min-h-[48px] w-full py-2 text-left text-[14px] font-semibold text-ink underline decoration-ink-hairline underline-offset-4">
                        + Nouvel adhérent : {typedName}
                      </button>
                    </li>
                  )}
                  {query.trim().length > 1 && !suggestions.length && !typedName && (
                    <li className="py-2 text-[12px] text-ink-55">Écris le prénom ET le nom pour créer un adhérent.</li>
                  )}
                </ul>
              </>
            )}
          </div>
          {error && <p role="alert" className="text-[13px] text-alert">{error}</p>}
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
