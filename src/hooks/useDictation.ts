import { useEffect, useMemo, useRef, useState } from 'react';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useAIChat, useStockUpdate, useAchats, useAllSalesData } from '@/hooks/useSales';
import { useReferencesStore } from '@/stores/referencesStore';
import { salesApi } from '@/lib/api';
import type { ProductReference } from '@/types';

// ─── Local parsers ──────────────────────────────────────────────────────────
// These give instant, backend-independent recognition for the most common
// commands, across many phrasings, for ANY reference (default or custom).
// Anything they don't recognise falls through to the backend chatbot, which
// always receives the live catalogue too (see useAIChat / useStockUpdate).

/** Strip accents so "réçu"/"recu"/"reçu" etc. all match the same way. */
function foldAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

const FILLER_WORDS = /\b(en\s*stock|boites?|boîtes?|cartons?|unites?|unités?|au\s*stock|de\s*stock|dispo(?:nibles?)?|restant(?:es?|s)?|s'?il\s*(?:te|vous)\s*plait)\b/gi;

/** Find the closest reference by name (accent/case-insensitive, fuzzy partial match) */
function findRef(text: string, refs: ProductReference[]): ProductReference | null {
  const clean = (s: string) => foldAccents(s.toLowerCase()).replace(FILLER_WORDS, '').replace(/[?!.,]/g, '').trim();
  const q = clean(text);
  if (!q) return null;

  const byName = (pred: (name: string) => boolean) => refs.find((r) => pred(clean(r.name)));

  return (
    byName((name) => name === q) ??
    byName((name) => q.includes(name)) ??
    byName((name) => name.includes(q)) ??
    // Token overlap: pick the reference sharing the most whole/partial words with the query
    refs
      .map((r) => {
        const rw = clean(r.name).split(/\s+/).filter(Boolean);
        const qw = q.split(/\s+/).filter((w) => w.length > 1);
        const score = qw.filter((w) => rw.some((x) => x === w || x.startsWith(w) || w.startsWith(x))).length;
        return { r, score };
      })
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)[0]?.r ??
    null
  );
}

/** Detect "nouvelle référence Victor C1 à 24€" / "ajoute une réf X à 20 euros" */
function parseAddRef(msg: string): { name: string; price: number } | null {
  const m = msg.match(
    /(?:nouvelle?\s+réf(?:érence)?|cré[eé]\s+(?:une?\s+)?réf(?:érence)?|ajouter?\s+(?:une?\s+)?(?:réf(?:érence)?|boite?|volant))\s+(.+?)\s+(?:à|a|pour|:)?\s*(\d+(?:[,\.]\d+)?)\s*(?:€|euros?)?/i
  );
  if (!m) return null;
  const price = parseFloat(m[2].replace(',', '.'));
  if (!m[1].trim() || isNaN(price) || price <= 0) return null;
  return { name: m[1].trim(), price };
}

/** Detect stock reception, in many phrasings: "reçu 20 boites de NCS Pro", "on a reçu 15 Victor C1",
 *  "+12 Victor GM", "réassort de 30 CBX Red", "10 Victor PC viennent d'arriver", "rentré 8 CBX Blue" */
function parseStockIn(msg: string, refs: ProductReference[]): { ref: ProductReference; qty: number } | null {
  const PATTERNS = [
    /(?:on\s+a\s+|j'?\s*ai\s+)?(?:reçu?|réceptionn[ée]|rentr[ée]e?|livr[ée]e?|livraison)\s+(?:de\s+)?(\d+)\s+(?:boîtes?|boites?)?\s*(?:de\s+)?(.+?)(?:\s*$)/i,
    /(\d+)\s+(?:boîtes?|boites?)?\s*(?:de\s+)?(.+?)\s+(?:sont\s+arriv[ée]es?|viennent\s+d'arriver|reçues?|livrées?|arrivées?)/i,
    /(?:ajouter?|mettre?|rajouter?)\s+(\d+)\s+(?:boîtes?|boites?)?\s*(?:de\s+)?(.+?)\s+(?:au\s+|en\s+)?stock/i,
    /r[ée]assort\s+(?:de\s+)?(\d+)\s+(?:boîtes?|boites?)?\s*(?:de\s+)?(.+)/i,
    /[+](\d+)\s+(?:boîtes?|boites?)?\s*(?:de\s+)?(.+)/i,
    /(\d+)\s+(?:boîtes?|boites?)\s+(?:de\s+)?(.+?)\s+(?:en\s+)?stock/i,
    /stock\s+(.+?)\s*[+:]\s*(\d+)/i, // "stock Victor GM +20" (name then qty)
  ];
  for (let i = 0; i < PATTERNS.length; i++) {
    const m = msg.match(PATTERNS[i]);
    if (!m) continue;
    // The last pattern captures name first, qty second — everything else is qty then name.
    const [qtyStr, nameStr] = i === PATTERNS.length - 1 ? [m[2], m[1]] : [m[1], m[2]];
    const qty = parseInt(qtyStr);
    if (isNaN(qty) || qty <= 0) continue;
    const ref = findRef(nameStr, refs);
    if (ref) return { ref, qty };
  }
  return null;
}

/** Detect stock query: "combien de NCS Pro", "stock Victor C1 ?", "il reste quoi en CBX Red",
 *  "y a-t-il du Victor GM", "j'ai encore combien de CBX Blue", "dispo pour Victor PC ?" */
function parseStockQuery(msg: string, refs: ProductReference[]): ProductReference | null {
  const PATTERNS = [
    /(?:combien|il\s+(?:me\s+)?reste[- ]t[- ]il|quel\s+stock|reste[- ]t[- ]il)\s+(?:de\s+|il\s+reste\s+de\s+)?(.+?)(?:\s*\?|\s+en\s+stock|\s+restant(?:es?|s)?|$)/i,
    /stock\s+(?:de\s+|du\s+)?(.+?)(?:\s*\?|$)/i,
    /(?:y\s*a[- ]t[- ]il|as[- ]tu|avez[- ]vous)\s+(?:encore\s+)?(?:du\s+|des?\s+|de\s+la\s+)?(.+?)(?:\s+en\s+stock)?(?:\s*\?|$)/i,
    /(.+?)\s+(?:il\s+en\s+reste\s+combien|en\s+stock|restant(?:es?|s)?)(?:\s*\?|$)/i,
  ];
  for (const p of PATTERNS) {
    const m = msg.match(p);
    if (!m) continue;
    const ref = findRef(m[1], refs);
    if (ref) return ref;
  }
  return null;
}

/** Detect price query: "prix Victor GM", "quel est le prix de NCS Pro", "ça coûte combien un CBX Red",
 *  "Victor PC c'est combien" */
function parsePriceQuery(msg: string, refs: ProductReference[]): ProductReference | null {
  const m =
    msg.match(/(?:quel\s+(?:est\s+le\s+)?)?(?:prix|tarif)\s+(?:d[eu]?\s+|des?\s+)?(.+?)(?:\s*\?|$)/i) ??
    msg.match(/(.+?)\s+(?:c'est\s+combien|coûte\s+combien|ça\s+coûte\s+combien)(?:\s*\?|$)/i) ??
    msg.match(/(?:combien\s+)?coûte\s+(?:un[e]?\s+|le\s+|la\s+)?(.+?)(?:\s*\?|$)/i) ??
    msg.match(/(?:prix|tarif|coûte?|vaut)\s+(?:de\s+|du\s+|des?\s+)?(.+?)(?:\s*\?|$)/i);
  if (!m) return null;
  return findRef(m[1], refs);
}

export function mmss(sec: number) {
  return `${String(Math.floor(sec / 60)).padStart(2, '0')}:${String(sec % 60).padStart(2, '0')}`;
}

export type Turn = { from: 'user' | 'ai'; text: string };

interface UseDictationOptions {
  onSuccess: (msg: string) => void;
  onError: (msg: string) => void;
  /** Called after a successful action completes — e.g. a sheet closes itself. */
  onDone?: () => void;
  /** If true, the transcript is never cleared automatically (full-page chat). */
  keepHistory?: boolean;
  /** Called once a backend call has been pending >3s — the free-tier backend can
   *  take up to ~50s to wake from sleep, so this lets the UI explain the wait
   *  instead of looking frozen. */
  onSlow?: () => void;
}

/**
 * Shared dictation/chat logic: local parsers for reference/stock/price commands,
 * voice input, and the backend fallback. Used by both the DictationSheet (quick
 * access from any registre page) and the full-page chat landing screen.
 */
export function useDictation({ onSuccess, onError, onDone, keepHistory, onSlow }: UseDictationOptions) {
  const [text, setText] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const timerRef = useRef<number | null>(null);

  const { mutateAsync: sendChat, isPending: chatPending } = useAIChat();
  const { mutateAsync: updateStock, isPending: stockPending } = useStockUpdate();
  const { references, addReference } = useReferencesStore();
  const { data: achats = {} } = useAchats();
  const { data: allSales = [] } = useAllSalesData();
  const { isListening, transcript, isSupported, start, stop, reset } = useVoiceInput((final) => setText(final));

  const isPending = chatPending || stockPending;

  // Net remaining stock (bought − sold), not the raw purchased total — matches
  // the "EN STOCK" figure shown in the ledger, so voice/text queries never lie.
  const netStock = useMemo(() => {
    const sold: Record<string, number> = {};
    for (const s of allSales) {
      if (!s.produit) continue;
      sold[s.produit] = (sold[s.produit] ?? 0) + s.quantite;
    }
    const result: Record<string, number> = {};
    for (const ref of references) {
      result[ref.name] = Math.max(0, (achats[ref.name] ?? 0) - (sold[ref.name] ?? 0));
    }
    return result;
  }, [achats, allSales, references]);

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

  /** Runs a backend call, firing onSlow if it's still pending after 3s (likely
   *  a Render cold start) so the UI can explain the wait instead of looking stuck. */
  const withWakeHint = async <T,>(fn: () => Promise<T>): Promise<T> => {
    const timer = window.setTimeout(() => onSlow?.(), 3000);
    try {
      return await fn();
    } finally {
      window.clearTimeout(timer);
    }
  };

  const finish = () => {
    setText('');
    reset();
    if (!keepHistory) setTurns([]);
    onDone?.();
  };

  const succeed = (msg: string) => {
    setTurns((t) => [...t, { from: 'ai', text: msg }]);
    onSuccess(msg);
    finish();
  };

  const fail = (msg: string) => {
    setTurns((t) => [...t, { from: 'ai', text: msg }]);
    onError(msg);
  };

  const handleSend = async () => {
    const raw = (isListening ? transcript : text).trim();
    if (!raw) return;

    setTurns((t) => [...t, { from: 'user', text: raw }]);
    setText('');
    if (isListening) { stop(); reset(); }

    // ── 1. Add reference — registers on the backend first (Stock row + sales
    //      tab) so the reference is actually usable, not just a local label ──
    const newRef = parseAddRef(raw);
    if (newRef) {
      try {
        const result = await withWakeHint(() => salesApi.addReference(newRef.name, newRef.price));
        if (!result.success) throw new Error(result.error ?? 'Erreur serveur');
        addReference({ name: newRef.name, price: newRef.price, color: 'purple' });
        succeed(`Référence « ${newRef.name} » ajoutée à ${newRef.price} € ✓`);
      } catch (e) {
        fail(e instanceof Error ? e.message : 'Erreur réseau');
      }
      return;
    }

    // ── 2. Stock reception (local for speed & custom product support) ──────
    const stockIn = parseStockIn(raw, references);
    if (stockIn) {
      try {
        await withWakeHint(() => updateStock({ product: stockIn.ref.name, qty: stockIn.qty }));
        succeed(`+${stockIn.qty} boîte${stockIn.qty > 1 ? 's' : ''} de ${stockIn.ref.name} ✓`);
      } catch (e) {
        fail(e instanceof Error ? e.message : 'Erreur réseau');
      }
      return;
    }

    // ── 3. Stock query (local, instant) ────────────────────────────────────
    const stockRef = parseStockQuery(raw, references);
    if (stockRef) {
      const inStock = netStock[stockRef.name] ?? 0;
      succeed(`${stockRef.name} : ${inStock} boîte${inStock !== 1 ? 's' : ''} en stock`);
      return;
    }

    // ── 4. Price query (local) ─────────────────────────────────────────────
    const priceRef = parsePriceQuery(raw, references);
    if (priceRef) {
      succeed(`${priceRef.name} : ${priceRef.price} € / boîte`);
      return;
    }

    // ── 5. Backend — useAIChat injects the full catalogue automatically ────
    try {
      const result = await withWakeHint(() => sendChat(raw));
      if (result.success) {
        const msg = result.message ?? (
          result.action === 'modifier'        ? 'Vente(s) mise(s) à jour ✓'      :
          result.action === 'vente'           ? 'Vente(s) ajoutée(s) ✓'          :
          result.action === 'square_payment'  ? 'Vente enregistrée · Square ✓'  :
          result.action === 'stock_update'    ? 'Stock mis à jour ✓'             :
          'Enregistré !'
        );
        succeed(msg);
      } else {
        fail("Le chatbot n'a pas compris. Reformule ?");
      }
    } catch {
      fail('Erreur réseau — réessaie');
    }
  };

  const displayValue = isListening ? transcript : text;

  return {
    text, setText, turns, elapsed, isPending, displayValue,
    isListening, transcript, isSupported, start, stop,
    handleSend, references,
  };
}
