import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTshirts, useUpdateTshirt, useAddTshirt } from '@/hooks/useTshirts';
import { useToast } from '@/hooks/useToast';
import { ToastContainer } from '@/components/ui/Toast';
import { Button } from '@/components/ui/Button';
import { NumberStepper } from '@/components/ui/NumberStepper';
import { LedgerHeader } from '@/components/ledger/LedgerHeader';
import { DictationBar } from '@/components/ai/DictationBar';
import { DictationSheet } from '@/components/ai/DictationSheet';

const TAILLE_ORDER = ['XS', 'S', 'M', 'L', 'XL', '2XL', 'Junior'];
const SEXE_ORDER = ['Homme', 'Femme', 'Junior', 'Mixte'];

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

function sortSexes(sexes: string[]) {
  return [...sexes].sort((a, b) => {
    const ai = SEXE_ORDER.indexOf(a);
    const bi = SEXE_ORDER.indexOf(b);
    if (ai === -1 && bi === -1) return a.localeCompare(b);
    if (ai === -1) return 1;
    if (bi === -1) return -1;
    return ai - bi;
  });
}

/** Zeros keep printing — the ledger shows the holes, not hides them. */
function qtyInk(q: number) {
  if (q === 0) return { color: 'rgba(40,30,22,.3)', fontWeight: 400 };
  if (q <= 3) return { color: 'oklch(0.55 0.16 28)', fontWeight: 600 };
  if (q <= 6) return { color: 'oklch(0.5 0.12 72)', fontWeight: 600 };
  return { color: '#281E16', fontWeight: 600 };
}

type Cell = { marque: string; sexe: string; taille: string; qty: number };

export function TShirtsPage() {
  const { data, isLoading } = useTshirts();
  const { mutateAsync: updateItem, isPending: updating } = useUpdateTshirt();
  const { mutateAsync: addItem, isPending: adding } = useAddTshirt();
  const { toasts, addToast, removeToast } = useToast();
  const [edit, setEdit] = useState<Cell | null>(null);
  const [addCtx, setAddCtx] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);

  if (isLoading) return <div className="flex h-full items-center justify-center text-[12px] text-ink-45">Chargement…</div>;
  if (!data) return null;

  const { marques, items } = data;
  const total = items.reduce((n: number, i: { quantite: number }) => n + i.quantite, 0);

  return (
    <div className="mx-auto flex h-full w-full max-w-[480px] flex-col bg-paper lg:max-w-[1040px]">
      <LedgerHeader
        title="Registre des maillots"
        caption={`${total} pièces réparties sur ${marques.length} modèle${marques.length !== 1 ? 's' : ''}`}
      />

      <div className="flex-1 overflow-y-auto no-scrollbar px-[22px] py-3.5 lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-12 lg:gap-y-2">
        {marques.map((marque) => {
          const mi = items.filter((i: { marque: string }) => i.marque === marque);
          const tailles = sortTailles([...new Set(mi.map((i: { taille: string }) => i.taille))]);
          const sexes = sortSexes([...new Set(mi.map((i: { sexe: string }) => i.sexe))]);
          const mtotal = mi.reduce((n: number, i: { quantite: number }) => n + i.quantite, 0);

          return (
            <section key={marque} className="mb-4">
              <div className="mb-1.5 flex items-baseline justify-between">
                <h2 className="font-serif text-[20px] text-ink">{marque}</h2>
                <div className="flex items-baseline gap-3">
                  <span className="font-mono text-[10px] font-medium text-ink-45">{mtotal} PCS</span>
                  <button
                    onClick={() => setAddCtx(marque)}
                    className="font-mono text-[9px] font-medium tracking-label text-ink-45 hover:text-ink"
                  >
                    + LIGNE
                  </button>
                </div>
              </div>

              {mi.length === 0 ? (
                <p className="border-t-[1.5px] border-ink py-6 text-center text-[12px] text-ink-45">Aucun stock</p>
              ) : (
                <div className="grid border-t-[1.5px] border-ink" style={{ gridTemplateColumns: `58px repeat(${tailles.length}, 1fr)` }}>
                  <div className="border-b border-ink-rule" />
                  {tailles.map((t) => (
                    <div key={t} className="border-b border-ink-rule py-[5px] text-center font-mono text-[9.5px] font-medium text-ink-45">
                      {t}
                    </div>
                  ))}

                  {sexes.map((sexe) => (
                    <div key={sexe} className="contents">
                      <div className="border-b border-dotted border-ink-dot py-2 text-[11px] font-medium text-ink-55">
                        {sexe}
                      </div>
                      {tailles.map((taille) => {
                        const it = mi.find((i: { sexe: string; taille: string }) => i.sexe === sexe && i.taille === taille);
                        const qty = it?.quantite ?? 0;
                        return (
                          <button
                            key={taille}
                            onClick={() => setEdit({ marque, sexe, taille, qty })}
                            aria-label={`${marque}, ${sexe}, taille ${taille} : ${qty}`}
                            className="border-b border-dotted border-ink-dot py-2 text-center font-mono text-[13px]"
                            style={qtyInk(qty)}
                          >
                            {qty}
                          </button>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </section>
          );
        })}

        <p className="border-t border-ink-rule pt-2.5 text-[11px] leading-[1.5] text-ink-55 lg:col-span-2">
          Les zéros restent visibles : le registre montre les trous de stock au lieu de les cacher.
        </p>
      </div>

      <DictationBar onClick={() => setSheetOpen(true)} hint="« reçu 20 maillots femme M »" />

      <AnimatePresence>
        {edit && (
          <QuantitySheet
            cell={edit}
            loading={updating}
            onClose={() => setEdit(null)}
            onSave={async (qty) => {
              try {
                await updateItem({ marque: edit.marque, sexe: edit.sexe, taille: edit.taille, nouvelle_quantite: qty });
                addToast(`${edit.marque} ${edit.sexe} ${edit.taille} → ${qty}`, 'success');
                setEdit(null);
              } catch { addToast('Erreur', 'error'); }
            }}
          />
        )}
        {addCtx && (
          <AddLineSheet
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

      <DictationSheet
        isOpen={sheetOpen}
        onClose={() => setSheetOpen(false)}
        onSuccess={(m) => addToast(m, 'success')}
        onError={(m) => addToast(m, 'error')}
        onSlow={() => addToast('Réveil du serveur… patiente quelques secondes', 'info')}
      />
      <ToastContainer toasts={toasts} onRemove={removeToast} />
    </div>
  );
}

function QuantitySheet({
  cell,
  loading,
  onSave,
  onClose,
}: {
  cell: Cell;
  loading: boolean;
  onSave: (qty: number) => void;
  onClose: () => void;
}) {
  const [value, setValue] = useState(cell.qty);
  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="fixed inset-0 z-40" style={{ background: 'rgba(40,30,22,.35)' }}
      />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[480px] lg:max-w-[560px] border-t-2 border-ink bg-paper px-5 pt-4 pb-safe"
      >
        <h3 className="font-serif text-[22px] text-ink">{cell.marque}</h3>
        <p className="mb-6 font-mono text-[10px] font-medium tracking-kpi text-ink-45">
          {cell.sexe.toUpperCase()} · {cell.taille}
        </p>
        <div className="mb-7 flex items-center justify-center">
          <NumberStepper value={value} onChange={setValue} min={0} size="lg" />
        </div>
        <Button onClick={() => onSave(value)} loading={loading} className="w-full">Enregistrer</Button>
      </motion.div>
    </>
  );
}

function AddLineSheet({
  marque,
  loading,
  onSave,
  onClose,
}: {
  marque: string;
  loading: boolean;
  onSave: (sexe: string, taille: string, qty: number) => void;
  onClose: () => void;
}) {
  const [sexe, setSexe] = useState('Homme');
  const [taille, setTaille] = useState('M');
  const [qty, setQty] = useState(0);
  const fieldClass = 'w-full border-[1.5px] border-ink bg-transparent px-3 py-2.5 text-[13px] text-ink focus:outline-none appearance-none';
  const labelClass = 'mb-1.5 block font-mono text-[9px] font-medium tracking-label text-ink-45';

  return (
    <>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose} className="fixed inset-0 z-40" style={{ background: 'rgba(40,30,22,.35)' }}
      />
      <motion.div
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        className="fixed inset-x-0 bottom-0 z-50 mx-auto max-w-[480px] lg:max-w-[560px] space-y-4 border-t-2 border-ink bg-paper px-5 pt-4 pb-safe"
      >
        <h3 className="font-serif text-[22px] text-ink">Ajouter une ligne — {marque}</h3>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className={labelClass}>Sexe</label>
            <select value={sexe} onChange={(e) => setSexe(e.target.value)} className={fieldClass}>
              {['Homme', 'Femme', 'Junior'].map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div>
            <label className={labelClass}>Taille</label>
            <select value={taille} onChange={(e) => setTaille(e.target.value)} className={fieldClass}>
              {TAILLE_ORDER.map((t) => <option key={t}>{t}</option>)}
            </select>
          </div>
        </div>
        <div>
          <label className={labelClass}>Quantité</label>
          <NumberStepper value={qty} onChange={setQty} min={0} size="md" />
        </div>
        <div className="pb-3">
          <Button onClick={() => onSave(sexe, taille, qty)} loading={loading} className="w-full">Ajouter</Button>
        </div>
      </motion.div>
    </>
  );
}
