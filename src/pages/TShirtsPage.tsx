import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Plus, Shirt } from 'lucide-react';
import { useTshirts, useUpdateTshirt, useAddTshirt } from '@/hooks/useTshirts';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { cn } from '@/lib/utils';

const TAILLE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', 'Junior'];

function sortTailles(tailles: string[]) {
  return [...tailles].sort((a, b) => {
    const ai = TAILLE_ORDER.indexOf(a);
    const bi = TAILLE_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

function getQtyColor(qty: number) {
  if (qty === 0) return 'text-gray-500';
  if (qty <= 4) return 'text-danger-500';
  if (qty <= 10) return 'text-warning-600';
  return 'text-success-600';
}

interface EditModalProps {
  marque: string; sexe: string; taille: string; qty: number;
  onSave: (qty: number) => void; onClose: () => void; loading: boolean;
}

function EditModal({ marque, sexe, taille, qty, onSave, onClose, loading }: EditModalProps) {
  const [value, setValue] = useState(qty);
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-surface-900 rounded-t-3xl border-t border-white/10 p-6"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1.5rem)' }}>
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-5" />
        <h3 className="font-semibold text-white mb-1">{marque}</h3>
        <p className="text-sm text-gray-400 mb-6">{sexe} · {taille}</p>
        <div className="flex items-center justify-center gap-6 mb-8">
          <button onClick={() => setValue(Math.max(0, value - 1))}
            className="w-12 h-12 rounded-full bg-surface-800 border border-white/10 text-white text-xl font-bold flex items-center justify-center">−</button>
          <span className={cn('text-4xl font-bold tabular-nums', getQtyColor(value))}>{value}</span>
          <button onClick={() => setValue(value + 1)}
            className="w-12 h-12 rounded-full bg-surface-800 border border-white/10 text-white text-xl font-bold flex items-center justify-center">+</button>
        </div>
        <Button onClick={() => onSave(value)} loading={loading} className="w-full">Enregistrer</Button>
      </motion.div>
    </>
  );
}

interface AddModalProps {
  marque: string; onSave: (sexe: string, taille: string, qty: number) => void;
  onClose: () => void; loading: boolean;
}

function AddModal({ marque, onSave, onClose, loading }: AddModalProps) {
  const [sexe, setSexe] = useState('Homme');
  const [taille, setTaille] = useState('M');
  const [qty, setQty] = useState(0);
  return (
    <>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 bg-black/60 z-40 backdrop-blur-sm" onClick={onClose} />
      <motion.div initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed bottom-0 left-0 right-0 z-50 bg-surface-900 rounded-t-3xl border-t border-white/10 p-6 space-y-4"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1.5rem)' }}>
        <div className="w-10 h-1 bg-white/20 rounded-full mx-auto mb-1" />
        <h3 className="font-semibold text-white">Ajouter une ligne — {marque}</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">Sexe</label>
            <select value={sexe} onChange={e => setSexe(e.target.value)}
              className="w-full bg-surface-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-600/40">
              {['Homme', 'Femme', 'Junior'].map(s => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">Taille</label>
            <select value={taille} onChange={e => setTaille(e.target.value)}
              className="w-full bg-surface-800 border border-white/10 rounded-xl px-3 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-primary-600/40">
              {TAILLE_ORDER.map(t => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className="text-xs text-gray-400 uppercase tracking-wider mb-1 block">Quantité</label>
          <div className="flex items-center gap-4">
            <button onClick={() => setQty(Math.max(0, qty - 1))}
              className="w-10 h-10 rounded-full bg-surface-800 border border-white/10 text-white text-xl flex items-center justify-center">−</button>
            <span className="text-2xl font-bold text-white tabular-nums w-8 text-center">{qty}</span>
            <button onClick={() => setQty(qty + 1)}
              className="w-10 h-10 rounded-full bg-surface-800 border border-white/10 text-white text-xl flex items-center justify-center">+</button>
          </div>
        </div>
        <Button onClick={() => onSave(sexe, taille, qty)} loading={loading} className="w-full">Ajouter</Button>
      </motion.div>
    </>
  );
}

export function TShirtsPage() {
  const { data, isLoading } = useTshirts();
  const { mutateAsync: updateItem, isPending: updating } = useUpdateTshirt();
  const { mutateAsync: addItem, isPending: adding } = useAddTshirt();
  const { toasts, addToast, removeToast } = useToast();
  const [editCtx, setEditCtx] = useState<{ marque: string; sexe: string; taille: string; qty: number } | null>(null);
  const [addCtx, setAddCtx] = useState<string | null>(null);

  if (isLoading) return <div className="flex items-center justify-center h-full text-gray-500 text-sm">Chargement…</div>;
  if (!data) return null;

  const { marques, items } = data;

  return (
    <div className="flex flex-col h-full overflow-y-auto">
      <div className="px-4 pt-4 pb-2">
        <div className="flex items-center gap-2 mb-4">
          <Shirt className="w-5 h-5 text-purple-400" />
          <h1 className="text-2xl font-bold text-white">T-Shirts</h1>
        </div>
      </div>

      <div className="px-4 pb-24 space-y-4">
        {marques.map(marque => {
          const mi = items.filter((i: { marque: string; sexe: string; taille: string; quantite: number }) => i.marque === marque);
          const tailles = sortTailles([...new Set(mi.map((i: { taille: string }) => i.taille))]);
          const sexes = [...new Set(mi.map((i: { sexe: string }) => i.sexe))].sort();
          const total = mi.reduce((s: number, i: { quantite: number }) => s + i.quantite, 0);

          return (
            <motion.div key={marque} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}
              className="bg-surface-800/50 border border-white/8 rounded-2xl overflow-hidden">
              <div className="flex items-center justify-between px-4 py-3 border-b border-white/6">
                <div>
                  <p className="font-semibold text-white text-sm">{marque}</p>
                  <p className="text-xs text-gray-400">{total} en stock</p>
                </div>
                <button onClick={() => setAddCtx(marque)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-purple-600/20 text-purple-400 border border-purple-500/30 rounded-full text-xs font-medium">
                  <Plus className="w-3 h-3" /> Ligne
                </button>
              </div>

              {mi.length === 0 ? (
                <p className="px-4 py-6 text-sm text-gray-500 text-center">Aucun stock</p>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-white/6">
                        <th className="px-4 py-2 text-left text-gray-500 font-medium"></th>
                        {tailles.map((t: string) => <th key={t} className="px-3 py-2 text-center text-gray-500 font-medium">{t}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {(sexes as string[]).map(sexe => (
                        <tr key={sexe} className="border-b border-white/4 last:border-0">
                          <td className="px-4 py-2.5 text-gray-400 font-medium">{sexe}</td>
                          {tailles.map((taille: string) => {
                            const it = mi.find((i: { sexe: string; taille: string; quantite: number }) => i.sexe === sexe && i.taille === taille);
                            const qty = it?.quantite ?? 0;
                            return (
                              <td key={taille} className="px-3 py-2.5 text-center">
                                <button onClick={() => setEditCtx({ marque, sexe, taille, qty })}
                                  className={cn('font-bold text-sm hover:opacity-70 transition-opacity', getQtyColor(qty))}>
                                  {qty}
                                </button>
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {editCtx && (
          <EditModal
            {...editCtx}
            loading={updating}
            onClose={() => setEditCtx(null)}
            onSave={async (qty) => {
              try {
                await updateItem({ marque: editCtx.marque, sexe: editCtx.sexe, taille: editCtx.taille, nouvelle_quantite: qty });
                addToast(`${editCtx.marque} ${editCtx.sexe} ${editCtx.taille} → ${qty}`, 'success');
                setEditCtx(null);
              } catch { addToast('Erreur', 'error'); }
            }}
          />
        )}
        {addCtx && (
          <AddModal
            marque={addCtx}
            loading={adding}
            onClose={() => setAddCtx(null)}
            onSave={async (sexe, taille, qty) => {
              try {
                await addItem({ marque: addCtx, sexe, taille, quantite: qty });
                addToast(`Ajouté : ${addCtx} ${sexe} ${taille}`, 'success');
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
