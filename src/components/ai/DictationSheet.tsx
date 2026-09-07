import { useEffect, useRef, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useAIChat, useStockUpdate, useAchats } from '@/hooks/useSales';
import { useModalGestures } from '@/hooks/useModalGestures';
import { useReferencesStore } from '@/stores/referencesStore';
import type { ProductReference } from '@/types';

// ─── Local parsers (unchanged from the previous AIAssistant) ──────────────────

/** Find the closest reference by name (case-insensitive, partial match) */
function findRef(text: string, refs: ProductReference[]): ProductReference | null {
  const q = text.toLowerCase().trim()
    .replace(/\b(en stock|boîtes?|boites?|cartons?|unités?|au stock)\b/gi, '')
    .trim();
  if (!q) return null;
  return (
    refs.find(r => r.name.toLowerCase() === q) ??
    refs.find(r => q.includes(r.name.toLowerCase())) ??
    refs.find(r => r.name.toLowerCase().includes(q)) ??
    refs.find(r => {
      const rw = r.name.toLowerCase().split(/\s+/);
      return q.split(/\s+/).filter(w => w.length > 1)
        .some(w => rw.some(x => x.startsWith(w) || w.startsWith(x)));
    }) ??
    null
  );
}

/** Detect "nouvelle référence Victor C1 à 24€" */
function parseAddRef(msg: string): { name: string; price: number } | null {
  const m = msg.match(
    /(?:nouvelle?\s+réf(?:érence)?|ajouter?\s+(?:une?\s+)?(?:réf(?:érence)?|boite?|volant))\s+(.+?)\s+(?:à|a|:)?\s*(\d+(?:[,\.]\d+)?)\s*€?/i
  );
  if (!m) return null;
  const price = parseFloat(m[2].replace(',', '.'));
  if (!m[1].trim() || isNaN(price) || price <= 0) return null;
  return { name: m[1].trim(), price };
}

/** Detect stock reception: "reçu 20 boites de NCS Pro", "j'ai reçu 15 Victor C1", "+12 Victor GM" */
function parseStockIn(msg: string, refs: ProductReference[]): { ref: ProductReference; qty: number } | null {
  const PATTERNS = [
    /(?:j'?\s*ai\s+)?(?:reçu?|réceptionné?|livraison|livré)\s+(\d+)\s+(?:boîtes?|boites?)?\s*(?:de\s+)?(.+?)(?:\s*$)/i,
    /(\d+)\s+(?:boîtes?|boites?)\s+(?:de\s+)?(.+?)\s+(?:reçues?|livrées?|arrivées?)/i,
    /ajouter?\s+(\d+)\s+(?:boîtes?|boites?)?\s*(?:de\s+)?(.+?)\s+(?:au\s+)?stock/i,
    /[+](\d+)\s+(?:boîtes?|boites?)?\s*(?:de\s+)?(.+)/i,
    /(\d+)\s+(?:boîtes?|boites?)\s+(?:de\s+)?(.+?)\s+(?:en\s+)?stock/i,
  ];
  for (const p of PATTERNS) {
    const m = msg.match(p);
    if (!m) continue;
    const qty = parseInt(m[1]);
    if (isNaN(qty) || qty <= 0) continue;
    const ref = findRef(m[2], refs);
    if (ref) return { ref, qty };
  }
  return null;
}

/** Detect stock query: "combien de NCS Pro", "stock Victor C1" */
function parseStockQuery(msg: string, refs: ProductReference[]): ProductReference | null {
  const PATTERNS = [
    /(?:combien|reste[- ]t[- ]il|quel\s+stock)\s+(?:de\s+)?(.+?)(?:\s*\?|\s+en\s+stock|$)/i,
    /stock\s+(?:de\s+)?(.+?)(?:\s*\?|$)/i,
    /(?:reste\s+(?:il|encore)?\s+(?:des?\s+)?)?(.+?)\s+(?:en\s+stock|restant)/i,
  ];
  for (const p of PATTERNS) {
    const m = msg.match(p);
    if (!m) continue;
    const ref = findRef(m[1], refs);
    if (ref) return ref;
  }
  return null;
}

/** Detect price query: "prix Victor GM", "quel est le prix de NCS Pro" */
function parsePriceQuery(msg: string, refs: ProductReference[]): ProductReference | null {
  const m = msg.match(/(?:prix|tarif|coûte?|vaut|combien|€)\s+(?:de\s+|du\s+|des?\s+)?(.+?)(?:\s*\?|$)/i)
    ?? msg.match(/(?:quel\s+(?:est\s+le\s+)?)?(?:prix|tarif)\s+(?:d[eu]?\s+)?(.+?)(?:\s*\?|$)/i);
  if (!m) return null;
  return findRef(m[1], refs);
}

/** Inject full catalogue into every backend message so it understands custom products */
function withContext(message: string, refs: ProductReference[]): string {
  const catalogue = refs.map(r => `• ${r.name} — ${r.price} €/boîte`).join('\n');
  return `[Catalogue produits disponibles:\n${catalogue}]\n\nDemande: ${message}`;
}

function mmss(sec: number) {
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}

type Turn = { from: 'user' | 'ai'; text: string };

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
}

export function DictationSheet({ isOpen, onClose, onSuccess, onError }: Props) {
  const [text, setText] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<number | null>(null);

  const { mutateAsync: sendChat, isPending: chatPending } = useAIChat();
  const { mutateAsync: updateStock, isPending: stockPending } = useStockUpdate();
  const { references, addReference } = useReferencesStore();
  const { data: achats = {} } = useAchats();
  const { y, bind } = useModalGestures(isOpen, onClose);
  const { isListening, transcript, isSupported, start, stop, reset } = useVoiceInput((final) => setText(final));

  const isPending = chatPending || stockPending;

  useEffect(() => {
    if (isListening) {
      setElapsed(0);
      timerRef.current = window.setInterval(() => setElapsed((s) => s + 1), 1000);
    } else if (timerRef.current) {
      window.clearInterval(timerRef.current);
      timerRef.current = null;
    }
    return () => { if (timerRef.current) window.clearInterval(timerRef.current); };
  }, [isListening]);

  const closeModal = () => {
    setText(''); reset(); setTurns([]); onClose();
  };

  const handleSend = async () => {
    const raw = (isListening ? transcript : text).trim();
    if (!raw) return;

    setTurns((t) => [...t, { from: 'user', text: raw }]);
    setText('');
    if (isListening) { stop(); reset(); }

    // ── 1. Add reference (local, no backend needed) ────────────────────────
    const newRef = parseAddRef(raw);
    if (newRef) {
      addReference({ name: newRef.name, price: newRef.price, color: 'purple' });
      onSuccess(`Référence « ${newRef.name} » ajoutée à ${newRef.price} € ✓`);
      closeModal();
      return;
    }

    // ── 2. Stock reception (local for speed & custom product support) ──────
    const stockIn = parseStockIn(raw, references);
    if (stockIn) {
      try {
        await updateStock({ product: stockIn.ref.name, qty: stockIn.qty });
        onSuccess(`+${stockIn.qty} boîte${stockIn.qty > 1 ? 's' : ''} de ${stockIn.ref.name} ✓`);
        closeModal();
      } catch {
        setTurns((t) => [...t, { from: 'ai', text: 'Erreur réseau — réessaie' }]);
        onError('Erreur réseau');
      }
      return;
    }

    // ── 3. Stock query (local, instant) ────────────────────────────────────
    const stockRef = parseStockQuery(raw, references);
    if (stockRef) {
      const inStock = achats[stockRef.name] ?? 0;
      onSuccess(`${stockRef.name} : ${inStock} boîte${inStock !== 1 ? 's' : ''} en stock`);
      closeModal();
      return;
    }

    // ── 4. Price query (local) ─────────────────────────────────────────────
    const priceRef = parsePriceQuery(raw, references);
    if (priceRef) {
      onSuccess(`${priceRef.name} : ${priceRef.price} € / boîte`);
      closeModal();
      return;
    }

    // ── 5. Backend — with full catalogue context ────────────────────────────
    try {
      const enriched = withContext(raw, references);
      const result = await sendChat(enriched);
      if (result.success) {
        const msg = result.message ?? (
          result.action === 'modifier'        ? 'Vente(s) mise(s) à jour ✓'      :
          result.action === 'vente'           ? 'Vente(s) ajoutée(s) ✓'          :
          result.action === 'square_payment'  ? 'Vente enregistrée · Square ✓'  :
          result.action === 'stock_update'    ? 'Stock mis à jour ✓'             :
          'Enregistré !'
        );
        onSuccess(msg);
        closeModal();
      } else {
        setTurns((t) => [...t, { from: 'ai', text: "Le chatbot n'a pas compris. Reformule ?" }]);
        onError('Le chatbot n\'a pas compris. Reformule ?');
      }
    } catch {
      setTurns((t) => [...t, { from: 'ai', text: 'Erreur réseau — réessaie' }]);
      onError('Erreur réseau');
    }
  };

  const displayValue = isListening ? transcript : text;

  return (
    <AnimatePresence>
      {isOpen && (
        <>
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40"
            style={{ background: 'rgba(40,30,22,.35)' }}
          />
          <motion.div
            initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
            transition={{ type: 'spring', damping: 30, stiffness: 300 }}
            style={{ y }}
            className="fixed inset-x-0 bottom-0 z-50 mx-auto flex max-h-[80%] max-w-[480px] flex-col gap-2.5 border-t-2 border-ink bg-paper px-5 pt-4 pb-safe"
          >
            <div {...bind()} className="flex touch-none items-baseline justify-between">
              <span className="font-serif text-[22px] text-ink">Dictée</span>
              <button onClick={onClose} className="font-mono text-[10px] font-medium tracking-kpi text-ink-45">
                FERMER
              </button>
            </div>

            {references.length > 0 && (
              <p className="text-[10px] leading-relaxed text-ink-45">
                {references.map((r) => `${r.name} · ${r.price} €`).join('  —  ')}
              </p>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar">
              {turns.map((t, i) => (
                <div key={i} className="flex gap-2.5 border-t border-ink-hairline py-2">
                  <span
                    className={`w-[34px] flex-none pt-0.5 font-mono text-[9px] font-medium tracking-wide ${t.from === 'user' ? 'text-ink-45' : 'text-alert'}`}
                  >
                    {t.from === 'user' ? 'MOI' : 'IA'}
                  </span>
                  <span className="text-[13px] leading-[1.45] text-ink">{t.text}</span>
                </div>
              ))}
            </div>

            {isListening ? (
              <button
                onClick={stop}
                className="mt-1 flex items-center gap-2.5 rounded-[14px] border-[1.5px] border-ink px-4 py-3.5"
              >
                <span className="h-2 w-2 animate-pulse rounded-full bg-alert" />
                <span className="flex-1 text-left text-[13px] text-ink-45">Écoute en cours…</span>
                <span className="font-mono text-[10px] font-medium text-ink-45">{mmss(elapsed)}</span>
              </button>
            ) : (
              <div className="mt-1 flex items-center gap-2.5 rounded-[14px] border-[1.5px] border-ink px-4 py-2.5">
                <input
                  value={displayValue}
                  onChange={(e) => setText(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleSend()}
                  placeholder="Écris ou dicte…"
                  className="min-w-0 flex-1 bg-transparent py-1 text-[13px] text-ink placeholder:text-ink-45 focus:outline-none"
                />
                {isSupported && (
                  <button onClick={start} aria-label="Dicter" className="flex-shrink-0 font-mono text-[13px] text-ink-45">
                    ◉
                  </button>
                )}
                <button
                  onClick={handleSend}
                  disabled={isPending || !displayValue.trim()}
                  aria-label="Envoyer"
                  className="flex-shrink-0 font-mono text-[13px] text-ink disabled:opacity-30"
                >
                  ↑
                </button>
              </div>
            )}
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
