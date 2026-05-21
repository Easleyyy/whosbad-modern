import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Trash2, Calendar } from 'lucide-react';
import { useEntrainements, useAddPlayer, useDeletePlayer, getPayStatus, cyclePayStatus } from '@/hooks/useEntrainements';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

type PayStatus = 'pending' | 'paid' | 'unpaid';

const PAY_LABELS: Record<PayStatus, string> = { paid: 'Payé', pending: 'En attente', unpaid: 'Non payé' };
const PAY_STYLES: Record<PayStatus, string> = {
  paid: 'bg-success-100 text-success-600 border-success-600/30',
  pending: 'bg-warning-100 text-warning-600 border-warning-600/30',
  unpaid: 'bg-danger-100 text-danger-600 border-danger-600/30',
};

interface AddPlayerModalProps {
  groupe: string;
  onSave: (nom: string, commentaire?: string) => void;
  onClose: () => void;
  loading: boolean;
}

function AddPlayerModal({ groupe, onSave, onClose, loading }: AddPlayerModalProps) {
  const [nom, setNom] = useState('');
  const [commentaire, setCommentaire] = useState('');
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-surface-900 rounded-t-3xl border-t border-white/10 p-6 space-y-4"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1.5rem)' }}>
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-1" />
        <h3 className="font-semibold text-white">Ajouter un joueur — {groupe}</h3>
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">Nom</label>
          <input value={nom} onChange={e => setNom(e.target.value)} placeholder="Prénom Nom"
            className="w-full bg-surface-800 border border-white/10 rounded-xl px-4 py-3 text-white text-base placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-600/40" />
        </div>
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">Commentaire</label>
          <input value={commentaire} onChange={e => setCommentaire(e.target.value)} placeholder="Optionnel…"
            className="w-full bg-surface-800 border border-white/10 rounded-xl px-4 py-3 text-white text-base placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-primary-600/40" />
        </div>
        <Button onClick={() => nom.trim() && onSave(nom.trim(), commentaire.trim() || undefined)} loading={loading} className="w-full" disabled={!nom.trim()}>
          Ajouter
        </Button>
      </motion.div>
    </>
  );
}

interface PlayerRowProps {
  groupe: string;
  nom: string;
  commentaire?: string;
  onDelete: () => void;
}

function PlayerRow({ groupe, nom, commentaire, onDelete }: PlayerRowProps) {
  const [status, setStatus] = useState<PayStatus>(() => getPayStatus(groupe, nom));

  const handleCycle = useCallback(() => {
    const next = cyclePayStatus(groupe, nom);
    setStatus(next);
  }, [groupe, nom]);

  return (
    <div className="flex items-center gap-3 px-4 py-3 border-b border-white/4 last:border-0">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white">{nom}</p>
        {commentaire && <p className="text-xs text-gray-500 truncate">{commentaire}</p>}
      </div>
      <button onClick={handleCycle}
        className={cn('px-2.5 py-1 rounded-full text-xs font-medium border transition-all', PAY_STYLES[status])}>
        {PAY_LABELS[status]}
      </button>
      <button
        onClick={() => {
          if (confirm(`Supprimer ${nom} ?`)) onDelete();
        }}
        className="p-1.5 text-gray-500 hover:text-danger-500 transition-colors"
        aria-label="Supprimer">
        <Trash2 className="w-3.5 h-3.5" />
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
    setOpenGroups(prev => {
      const next = new Set(prev);
      if (next.has(groupe)) next.delete(groupe); else next.add(groupe);
      return next;
    });
  };

  if (isLoading) return <div className="flex items-center justify-center h-full text-gray-500 text-sm">Chargement…</div>;
  if (!data) return null;

  const { groups, groupOrder } = data;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 mb-4">
          <Calendar className="w-5 h-5 text-amber-400" />
          <h1 className="text-2xl font-bold text-white">Entraînements</h1>
        </div>
      </div>

      <div className="px-4 pb-24 space-y-3">
        {groupOrder.map(groupe => {
          const players = groups[groupe] ?? [];
          const paidCount = players.filter(p => getPayStatus(groupe, p.nom) === 'paid').length;
          const isOpen = openGroups.has(groupe);

          return (
            <motion.div key={groupe} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="bg-surface-800/50 border border-white/8 rounded-2xl overflow-hidden">
              <button onClick={() => toggleGroup(groupe)}
                className="w-full flex items-center justify-between px-4 py-3.5 text-left">
                <div>
                  <p className="font-semibold text-white text-sm">{groupe}</p>
                  <p className="text-xs text-gray-400">{paidCount}/{players.length} payés</p>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={e => { e.stopPropagation(); setAddCtx(groupe); }}
                    className="flex items-center gap-1 px-2.5 py-1 bg-amber-600/20 text-amber-400 border border-amber-500/30 rounded-full text-xs font-medium">
                    <Plus className="w-3 h-3" /> Joueur
                  </button>
                  <span className={cn('text-gray-400 text-xs transition-transform', isOpen && 'rotate-180')}>▾</span>
                </div>
              </button>

              <AnimatePresence>
                {isOpen && (
                  <motion.div initial={{ height: 0 }} animate={{ height: 'auto' }} exit={{ height: 0 }}
                    className="overflow-hidden border-t border-white/6">
                    {players.length === 0 ? (
                      <p className="px-4 py-4 text-sm text-gray-500 text-center">Aucun joueur</p>
                    ) : (
                      players.map(p => (
                        <PlayerRow
                          key={p.nom}
                          groupe={groupe}
                          nom={p.nom}
                          commentaire={p.commentaire}
                          onDelete={() => deletePlayer({ groupe, nom: p.nom })}
                        />
                      ))
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {addCtx && (
          <AddPlayerModal
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
