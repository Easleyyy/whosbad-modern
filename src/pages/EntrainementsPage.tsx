import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useEntrainements, useAddPlayer, useDeletePlayer, useSetPaiement, getPayStatus, cyclePayStatus } from '@/hooks/useEntrainements';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { LedgerHeader } from '@/components/ledger/LedgerHeader';
import { cn } from '@/lib/utils';

type PayStatus = 'pending' | 'paid' | 'unpaid';

const PAY_LABEL: Record<PayStatus, string> = { paid: 'payé', pending: 'en attente', unpaid: 'non payé' };
const PAY_COLOR: Record<PayStatus, string> = {
  paid: 'oklch(0.4 0.1 145)',
  pending: 'rgba(40,30,22,.45)',
  unpaid: 'oklch(0.55 0.16 28)',
};

interface AddPlayerSheetProps {
  groupe: string;
  onSave: (nom: string, commentaire?: string) => void;
  onClose: () => void;
  loading: boolean;
}

function AddPlayerSheet({ groupe, onSave, onClose, loading }: AddPlayerSheetProps) {
  const [nom, setNom] = useState('');
  const [commentaire, setCommentaire] = useState('');
  const fieldClass = 'w-full border-[1.5px] border-ink bg-transparent px-3 py-2.5 text-[13px] text-ink placeholder:text-ink-40 focus:outline-none';
  const labelClass = 'mb-1.5 block font-mono text-[9px] font-medium tracking-label text-ink-45';

  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="fixed inset-0 z-40" style={{ background: 'rgba(40,30,22,.35)' }} />
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[480px] lg:max-w-[560px] space-y-4 border-t-2 border-ink bg-paper px-5 pt-4 pb-safe">
        <h3 className="font-serif text-[22px] text-ink">Ajouter un joueur — {groupe}</h3>
        <div>
          <label className={labelClass}>Nom</label>
          <input value={nom} onChange={(e) => setNom(e.target.value)} placeholder="Prénom Nom" className={fieldClass} />
        </div>
        <div>
          <label className={labelClass}>Commentaire</label>
          <input value={commentaire} onChange={(e) => setCommentaire(e.target.value)} placeholder="Optionnel…" className={fieldClass} />
        </div>
        <div className="pb-3">
          <Button
            onClick={() => nom.trim() && onSave(nom.trim(), commentaire.trim() || undefined)}
            loading={loading} disabled={!nom.trim()} className="w-full"
          >
            Ajouter
          </Button>
        </div>
      </motion.div>
    </>
  );
}

interface PlayerRowProps {
  groupe: string;
  nom: string;
  commentaire?: string;
  serverPaiement?: PayStatus;
  onDelete: () => void;
}

function PlayerRow({ groupe, nom, commentaire, serverPaiement, onDelete }: PlayerRowProps) {
  const [status, setStatus] = useState<PayStatus>(() => getPayStatus(groupe, nom, serverPaiement));
  const { mutate: setPaiement } = useSetPaiement();

  const handleCycle = useCallback(() => {
    const next = cyclePayStatus(groupe, nom, status);
    setStatus(next);
    setPaiement({ groupe, nom, statut: next });
  }, [groupe, nom, status, setPaiement]);

  return (
    <div className="flex items-baseline gap-2.5 border-b border-dotted border-ink-dot py-2">
      <div className="min-w-0 flex-1">
        <p className="truncate text-[12.5px] font-medium text-ink">{nom}</p>
        {commentaire && <p className="truncate text-[10px] text-ink-55">{commentaire}</p>}
      </div>
      <button
        onClick={handleCycle}
        className="flex-shrink-0 border-b-[1.5px] font-mono text-[9px] font-semibold uppercase"
        style={{ color: PAY_COLOR[status], borderColor: PAY_COLOR[status] }}
      >
        {PAY_LABEL[status]}
      </button>
      <button
        onClick={() => { if (confirm(`Supprimer ${nom} ?`)) onDelete(); }}
        className="flex-shrink-0 font-mono text-[9px] tracking-label text-ink-45 hover:text-alert"
        aria-label="Supprimer"
      >
        SUPPR.
      </button>
    </div>
  );
}

export function EntrainementsPage() {
  const { data, isLoading } = useEntrainements();
  const { mutateAsync: addPlayer, isPending: adding } = useAddPlayer();
  const { mutate: deletePlayer } = useDeletePlayer();
  const { toasts, addToast, removeToast } = useToast();
  const [addCtx, setAddCtx] = useState<string | null>(null);
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set());

  const toggleGroup = (groupe: string) => {
    setOpenGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupe)) next.delete(groupe); else next.add(groupe);
      return next;
    });
  };

  if (isLoading) return <div className="flex h-full items-center justify-center text-[12px] text-ink-45">Chargement…</div>;
  if (!data) return null;

  const { groups, groupOrder } = data;

  return (
    <div className="mx-auto flex h-full w-full max-w-[480px] flex-col bg-paper lg:max-w-[680px]">
      <LedgerHeader title="Entraînements" />

      <div className="flex-1 overflow-y-auto no-scrollbar px-[22px] py-3.5">
        {groupOrder.map((groupe) => {
          const players = groups[groupe] ?? [];
          const paidCount = players.filter((p) => getPayStatus(groupe, p.nom, p.paiement as PayStatus | undefined) === 'paid').length;
          const isOpen = openGroups.has(groupe);

          return (
            <section key={groupe} className="mb-3 border-t-[1.5px] border-ink pt-1.5">
              <button onClick={() => toggleGroup(groupe)} className="flex w-full items-baseline justify-between py-1.5 text-left">
                <div>
                  <span className="font-serif text-[18px] text-ink">{groupe}</span>
                  <span className="ml-2 font-mono text-[10px] text-ink-45">{paidCount}/{players.length} payés</span>
                </div>
                <div className="flex items-center gap-3">
                  <span
                    onClick={(e) => { e.stopPropagation(); setAddCtx(groupe); }}
                    className="font-mono text-[9px] font-medium tracking-label text-ink-45 hover:text-ink"
                  >
                    + JOUEUR
                  </span>
                  <span className={cn('font-mono text-[10px] text-ink-45 transition-transform', isOpen && 'rotate-180')}>▾</span>
                </div>
              </button>

              <AnimatePresence>
                {isOpen && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }} className="overflow-hidden">
                    {players.length === 0 ? (
                      <p className="py-3 text-center text-[11px] text-ink-45">Aucun joueur</p>
                    ) : (
                      players.map((p) => (
                        <PlayerRow
                          key={p.nom}
                          groupe={groupe}
                          nom={p.nom}
                          commentaire={p.commentaire}
                          serverPaiement={p.paiement as PayStatus | undefined}
                          onDelete={() => deletePlayer({ groupe, nom: p.nom })}
                        />
                      ))
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </section>
          );
        })}
      </div>

      <AnimatePresence>
        {addCtx && (
          <AddPlayerSheet
            groupe={addCtx}
            loading={adding}
            onClose={() => setAddCtx(null)}
            onSave={async (nom, commentaire) => {
              try {
                await addPlayer({ groupe: addCtx, nom, commentaire });
                addToast(`${nom} ajouté`, 'success');
                setAddCtx(null);
              } catch { addToast('Erreur', 'error'); }
            }}
          />
        )}
      </AnimatePresence>

      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}
