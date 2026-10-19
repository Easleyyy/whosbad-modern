import { useCallback, useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { NumberStepper } from '@/components/ui/NumberStepper';
import { cn } from '@/lib/utils';
import { useModalGestures } from '@/hooks/useModalGestures';
import type { Sale, PaymentStatus, PaymentMode } from '@/types';

const PAYMENT_MODES_CURRENT: PaymentMode[] = ['Square', 'Site internet', 'Lien de paiement', 'Virement'];
const PAYMENT_MODES_LEGACY: PaymentMode[] = ['Espèces', 'Chèque', 'CB', 'Assoconnect', 'PayPal', 'Wero', 'Autre'];
const PAYE_LABEL: Record<PaymentStatus, string> = { Oui: 'Payé', Non: 'En attente', '-': 'Soldé' };

export interface SaleFields {
  date: string;
  new_acheteur: string;
  vendeur: string;
  quantite: number;
  paye: PaymentStatus;
  mode_paiement: string;
  commentaire: string;
}

type Status = 'idle' | 'saving' | 'saved' | 'error' | 'invalid';

/** DD/MM/YYYY and a day that exists (no 31/02). */
export function isValidDMY(s: string): boolean {
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (!m) return false;
  const [d, mo, y] = [+m[1], +m[2], +m[3]];
  const t = new Date(y, mo - 1, d);
  return t.getFullYear() === y && t.getMonth() === mo - 1 && t.getDate() === d;
}

const TEXT_DELAY_MS = 700;

interface Props {
  sale: Sale;
  /** Applies a partial edit; rejects when the server refuses (the editor then offers to retry). */
  onChange: (patch: Partial<SaleFields>) => Promise<unknown>;
  onDelete: (sale: Sale) => void;
  onClose: () => void;
}

/**
 * Editing a sale saves by itself: status, payment mode and quantity apply the moment they change,
 * text fields a moment after typing stops (and on leaving the field). There is no Enregistrer
 * button — what you see is what is stored, and the header says so.
 */
export function EditSaleModal({ sale, onChange, onDelete, onClose }: Props) {
  const [fields, setFields] = useState<SaleFields>({
    date: sale.date,
    new_acheteur: sale.acheteur,
    vendeur: sale.vendeur,
    quantite: sale.quantite,
    paye: sale.paye,
    mode_paiement: sale.mode_paiement,
    commentaire: sale.commentaire ?? '',
  });
  const [status, setStatus] = useState<Status>('idle');
  const [invalid, setInvalid] = useState<{ date?: boolean; new_acheteur?: boolean }>({});
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const pending = useRef<Partial<SaleFields>>({});
  const timer = useRef<ReturnType<typeof setTimeout>>();
  const chain = useRef<Promise<void>>(Promise.resolve());
  const latestOnChange = useRef(onChange);
  latestOnChange.current = onChange;

  /** Sends whatever is waiting, one request at a time and in order. */
  const flush = useCallback((): Promise<void> => {
    clearTimeout(timer.current);
    const patch = pending.current;
    pending.current = {};
    if (!Object.keys(patch).length) return chain.current;
    chain.current = chain.current.then(async () => {
      setStatus('saving');
      try {
        await latestOnChange.current(patch);
        setStatus((s) => (s === 'saving' ? 'saved' : s));
      } catch {
        pending.current = { ...patch, ...pending.current }; // keep it for the retry
        setStatus('error');
      }
    });
    return chain.current;
  }, []);

  const edit = useCallback(<K extends keyof SaleFields>(key: K, value: SaleFields[K], delay = 0) => {
    setFields((f) => ({ ...f, [key]: value }));

    // An unreadable date or an empty name is never sent — the field says so instead of silently failing.
    if (key === 'date' || key === 'new_acheteur') {
      const ok = key === 'date' ? isValidDMY(String(value)) : String(value).trim().length > 0;
      setInvalid((i) => ({ ...i, [key]: !ok }));
      if (!ok) { setStatus('invalid'); return; }
      setStatus((s) => (s === 'invalid' ? 'idle' : s));
    }

    pending.current = { ...pending.current, [key]: key === 'new_acheteur' ? String(value).trim() : value };
    clearTimeout(timer.current);
    if (delay === 0) void flush();
    else timer.current = setTimeout(() => void flush(), delay);
  }, [flush]);

  // Closing (button, swipe, Escape, back) must not lose what's still waiting to be sent.
  const close = useCallback(async () => { await flush(); onClose(); }, [flush, onClose]);
  const { y, bind } = useModalGestures(true, close);
  useEffect(() => () => { void flush(); }, [flush]);

  const fieldClass = 'w-full border-[1.5px] border-ink bg-transparent px-3 py-3 text-[14px] text-ink placeholder:text-ink-40 focus:outline-none';
  const labelClass = 'mb-1.5 block font-mono text-[10px] font-medium tracking-label text-ink-55';
  const chip = (on: boolean) => cn(
    'min-h-[44px] border-[1.5px] px-3.5 text-[13px] transition-colors',
    on ? 'border-ink bg-ink font-semibold text-paper' : 'border-ink-rule text-ink hover:border-ink'
  );

  const statusText: Record<Status, { text: string; cls: string }> = {
    idle: { text: 'ENREGISTREMENT AUTOMATIQUE', cls: 'text-ink-55' },
    saving: { text: 'ENREGISTREMENT…', cls: 'text-ink-55' },
    saved: { text: 'ENREGISTRÉ ✓', cls: 'text-ok' },
    error: { text: 'ÉCHEC · TOUCHER POUR RÉESSAYER', cls: 'text-alert' },
    invalid: { text: 'CHAMP INVALIDE · NON ENREGISTRÉ', cls: 'text-alert' },
  };
  const st = statusText[status];

  return (
    <AnimatePresence>
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        className="fixed inset-0 z-40" style={{ background: 'rgba(40,30,22,.35)' }} onClick={close} />

      <motion.div
        role="dialog" aria-label="Modifier la vente"
        initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
        transition={{ type: 'spring', damping: 30, stiffness: 300 }}
        style={{ y }}
        className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[92dvh] max-w-[560px] flex-col border-t-2 border-ink bg-paper pb-safe"
      >
        <div className="flex-none px-5 pt-4 pb-3" {...bind()}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <p className="font-mono text-[10px] font-medium tracking-label text-ink-55">
                {sale.quantite} × {sale.produit}
              </p>
              <p className="mt-0.5 truncate font-serif text-[24px] leading-tight text-ink">{fields.new_acheteur || '—'}</p>
            </div>
            <button onClick={close} className="min-h-[44px] flex-shrink-0 px-1 font-mono text-[11px] font-medium tracking-kpi text-ink-55">
              FERMER
            </button>
          </div>
          <button
            type="button"
            onClick={() => status === 'error' && void flush()}
            disabled={status !== 'error'}
            aria-live="polite"
            className={cn('mt-1 font-mono text-[10px] font-semibold tracking-label', st.cls)}
          >
            {st.text}
          </button>
        </div>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-5 pb-4">
          <div>
            <span className={labelClass}>STATUT</span>
            <div className="flex gap-2">
              {(['Oui', 'Non', '-'] as PaymentStatus[]).map((s) => (
                <button key={s} onClick={() => edit('paye', s)} aria-pressed={fields.paye === s} className={cn(chip(fields.paye === s), 'flex-1')}>
                  {PAYE_LABEL[s]}
                </button>
              ))}
            </div>
          </div>

          <div>
            <span className={labelClass}>MODE DE PAIEMENT{fields.paye === 'Oui' && !fields.mode_paiement ? ' · À PRÉCISER' : ''}</span>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_MODES_CURRENT.map((m) => (
                <button key={m} onClick={() => edit('mode_paiement', fields.mode_paiement === m ? '' : m)} aria-pressed={fields.mode_paiement === m} className={chip(fields.mode_paiement === m)}>
                  {m}
                </button>
              ))}
              <select
                aria-label="Ancien mode de paiement"
                value={PAYMENT_MODES_LEGACY.includes(fields.mode_paiement as PaymentMode) ? fields.mode_paiement : ''}
                onChange={(e) => edit('mode_paiement', e.target.value)}
                className={cn(chip(PAYMENT_MODES_LEGACY.includes(fields.mode_paiement as PaymentMode)), 'appearance-none bg-transparent pr-3')}
              >
                <option value="">Ancien mode…</option>
                {PAYMENT_MODES_LEGACY.map((m) => <option key={m} value={m}>{m}</option>)}
              </select>
            </div>
          </div>

          <div>
            <span className={labelClass}>QUANTITÉ</span>
            <NumberStepper value={fields.quantite} onChange={(n) => edit('quantite', n)} min={1} size="md" />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="ed-acheteur" className={labelClass}>ACHETEUR</label>
              <input id="ed-acheteur" value={fields.new_acheteur} onChange={(e) => edit('new_acheteur', e.target.value, TEXT_DELAY_MS)} onBlur={() => void flush()}
                aria-invalid={invalid.new_acheteur} className={cn(fieldClass, invalid.new_acheteur && 'border-alert')} />
              {invalid.new_acheteur && <p className="mt-1 text-[11px] text-alert">Le nom ne peut pas être vide</p>}
            </div>
            <div>
              <label htmlFor="ed-date" className={labelClass}>DATE</label>
              <input id="ed-date" value={fields.date} onChange={(e) => edit('date', e.target.value, TEXT_DELAY_MS)} onBlur={() => void flush()}
                placeholder="JJ/MM/AAAA" inputMode="numeric" aria-invalid={invalid.date} className={cn(fieldClass, invalid.date && 'border-alert')} />
              {invalid.date && <p className="mt-1 text-[11px] text-alert">Format JJ/MM/AAAA, jour existant</p>}
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label htmlFor="ed-vendeur" className={labelClass}>VENDEUR</label>
              <input id="ed-vendeur" value={fields.vendeur} onChange={(e) => edit('vendeur', e.target.value, TEXT_DELAY_MS)} onBlur={() => void flush()} className={fieldClass} />
            </div>
            <div>
              <label htmlFor="ed-com" className={labelClass}>COMMENTAIRE</label>
              <input id="ed-com" value={fields.commentaire} onChange={(e) => edit('commentaire', e.target.value, TEXT_DELAY_MS)} onBlur={() => void flush()} placeholder="Optionnel…" className={fieldClass} />
            </div>
          </div>

          <div className="pt-1">
            {confirmingDelete ? (
              <div className="flex flex-wrap items-center justify-center gap-4 font-mono text-[11px] tracking-label">
                <span className="text-ink-55">Supprimer cette vente ?</span>
                <button onClick={() => onDelete(sale)} className="min-h-[44px] font-semibold text-alert">OUI, SUPPRIMER</button>
                <button onClick={() => setConfirmingDelete(false)} className="min-h-[44px] text-ink-55">ANNULER</button>
              </div>
            ) : (
              <button onClick={() => setConfirmingDelete(true)} className="min-h-[44px] w-full text-center font-mono text-[11px] font-medium tracking-label text-ink-55 hover:text-alert">
                SUPPRIMER CETTE VENTE
              </button>
            )}
          </div>
        </div>
      </motion.div>
    </AnimatePresence>
  );
}
