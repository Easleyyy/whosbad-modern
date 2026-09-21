import { useEffect, useMemo, useRef, useState } from 'react';
import { useVoiceInput } from '@/hooks/useVoiceInput';
import { useAIChat, useStockUpdate, useAchats, useAllSalesData, useReferences, useAddReference } from '@/hooks/useSales';
import { useMembers } from '@/hooks/useMembers';
import { useTshirtsLoader, useUpdateTshirt, useAddTshirt } from '@/hooks/useTshirts';
import { extractBuyers, memberKey, normalizeMemberName, parseAddMembers, parseRemoveMembers } from '@/lib/members';
import { fillTshirtIntent, isTshirtMessage, parseTshirtIntent, planTshirt, type TshirtIntent } from '@/lib/tshirtCommands';
import { foldAccents } from '@/lib/text';
import { COLOR_OPTIONS, type ChatResponse, type ProductReference } from '@/types';

// ─── Local parsers ──────────────────────────────────────────────────────────
// These give instant, backend-independent recognition for the most common
// commands, across many phrasings, for ANY reference (default or custom).
// Anything they don't recognise falls through to the backend chatbot, which
// always receives the live catalogue too (see useAIChat / useStockUpdate).

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

/** Detect "nouvelle référence Victor C1 à 24€", "ajoute une nouvelle réf NCS Pro 20 euros",
 *  "crée le volant Yonex AS50 à 25", "ajouter un modèle X". The price is optional — when it's
 *  missing the caller asks for it instead of dropping the command. */
export function parseAddRef(msg: string): { name: string; price: number | null } | null {
  const KIND = String.raw`(?:r[ée]f(?:[ée]rences?)?|volants?|mod[èe]les?|produits?|bo[iî]te)`;
  const VERB = String.raw`(?:ajoute[rz]?|rajoute[rz]?|cr[ée]{1,2}[rz]?|enregistre[rz]?|rentre[rz]?)`;
  const head = msg.match(
    new RegExp(
      String.raw`(?:nouvel(?:le)?s?|nouveau)\s+${KIND}|${VERB}\s+(?:une?\s+|la\s+|le\s+)?(?:nouvel(?:le)?s?\s+|nouveau\s+)?${KIND}`,
      'i'
    )
  );
  if (!head || head.index === undefined) return null;

  let rest = msg
    .slice(head.index + head[0].length)
    .replace(/^\s*(?:de\s+volants?\b)?\s*[:\-–]?\s*/i, '')
    .replace(/\s+(?:au|dans\s+le)\s+catalogue\b/gi, '')
    .trim();
  if (!rest || /^(?:de|du|des|d['’])\b/i.test(rest)) return null; // "ajoute des boîtes de X" is a stock command

  const tail = rest.match(
    /^(.*?)(?:\s+(à|a|pour|au\s+prix\s+de|prix(?:\s+de)?|au\s+tarif\s+de|tarif|:|=|-)\s*|\s+)(\d+(?:[.,]\d+)?)\s*(€|eur(?:os?)?)?(?:\s*(?:la\s+bo[iî]te|\/\s*bo[iî]te|l['’]unit[ée]|pi[eè]ce|par\s+bo[iî]te))?\s*[.!]?\s*$/i
  );
  const clean = (n: string) => n.replace(/[«»"“”]/g, '').replace(/[.,;:!?]+$/g, '').trim();

  if (tail) {
    const name = clean(tail[1]);
    const price = parseFloat(tail[3].replace(',', '.'));
    // "à 24", "24 €" are unambiguous. A bare trailing number is only a price when the name has
    // several words already ("Victor C1 24") and it looks like one ("Babolat Team 2" is a name).
    const marked = !!tail[2] || !!tail[4];
    const plausibleBare = name.split(/\s+/).length >= 2 && price >= 5 && price <= 150;
    if (name && price > 0 && (marked || plausibleBare)) return { name, price };
  }
  rest = clean(rest);
  return rest ? { name: rest, price: null } : null;
}

/** First palette colour no reference uses yet, so new references stay distinguishable. */
function pickColor(refs: ProductReference[]): string {
  const used = new Set(refs.map((r) => r.color));
  return COLOR_OPTIONS.find((c) => !used.has(c.id))?.id ?? 'purple';
}

/** Detect stock reception, in many phrasings: "reçu 20 boites de NCS Pro", "on a reçu 15 Victor C1",
 *  "+12 Victor GM", "réassort de 30 CBX Red", "10 Victor PC viennent d'arriver", "rentré 8 CBX Blue".
 *  `ref` is null when the quantity/product pattern matched but the product name isn't a known
 *  reference yet — the caller can then offer to create it on the fly instead of silently dropping it. */
function parseStockIn(msg: string, refs: ProductReference[]): { ref: ProductReference | null; qty: number; name: string } | null {
  const PATTERNS = [
    /(?:on\s+a\s+|j'?\s*ai\s+)?(?:reçu?|réceptionn[ée]|rentr[ée]e?|livr[ée]e?|livraison)\s+(?:de\s+)?(\d+)\s+(?:boîtes?|boites?)?\s*(?:de\s+)?(.+?)(?:\s*$)/i,
    /(\d+)\s+(?:boîtes?|boites?)?\s*(?:de\s+)?(.+?)\s+(?:sont\s+arriv[ée]es?|viennent\s+d'arriver|reçues?|livrées?|arrivées?)/i,
    /(?:ajouter?|mettre?|rajouter?)\s+(\d+)\s+(?:boîtes?|boites?)?\s*(?:de\s+)?(.+?)\s+(?:au\s+|en\s+)?stock/i,
    /r[ée]assort\s+(?:de\s+)?(\d+)\s+(?:boîtes?|boites?)?\s*(?:de\s+)?(.+)/i,
    /[+](\d+)\s+(?:boîtes?|boites?)?\s*(?:de\s+)?(.+)/i,
    /(\d+)\s+(?:boîtes?|boites?)\s+(?:de\s+)?(.+?)\s+(?:en\s+)?stock/i,
    /stock\s+(.+?)\s*[+:]\s*(\d+)/i, // "stock Victor GM +20" (name then qty)
  ];
  let firstMatch: { ref: null; qty: number; name: string } | null = null;
  for (let i = 0; i < PATTERNS.length; i++) {
    const m = msg.match(PATTERNS[i]);
    if (!m) continue;
    // The last pattern captures name first, qty second — everything else is qty then name.
    const [qtyStr, nameStr] = i === PATTERNS.length - 1 ? [m[2], m[1]] : [m[1], m[2]];
    const qty = parseInt(qtyStr);
    if (isNaN(qty) || qty <= 0) continue;
    const ref = findRef(nameStr, refs);
    if (ref) return { ref, qty, name: ref.name };
    if (!firstMatch) firstMatch = { ref: null, qty, name: nameStr.trim() };
  }
  return firstMatch;
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
/** A named product was used (sale or stock-in) but isn't a known reference yet —
 *  we ask for its price, then either apply `qty` directly (stock-in) or replay
 *  `raw` through the backend once the reference exists (sale). */
type PendingUnknownRef = { raw: string; name: string; qty?: number; /** only create the reference, nothing to replay */ createOnly?: boolean };

export function useDictation({ onSuccess, onError, onDone, keepHistory, onSlow }: UseDictationOptions) {
  const [text, setText] = useState('');
  const [turns, setTurns] = useState<Turn[]>([]);
  const [elapsed, setElapsed] = useState(0);
  const [pendingUnknown, setPendingUnknown] = useState<PendingUnknownRef | null>(null);
  /** A maillot command missing its model/size/sex/quantity, waiting for the answer. */
  const [pendingTshirt, setPendingTshirt] = useState<TshirtIntent | null>(null);
  /** The backend asked something back ("Tu veux dire X ou Y ?") — the next message answers it. */
  const [followUp, setFollowUp] = useState<{ user: string; ai: string } | null>(null);
  const timerRef = useRef<number | null>(null);

  const { mutateAsync: sendChat, isPending: chatPending } = useAIChat();
  const { mutateAsync: updateStock, isPending: stockPending } = useStockUpdate();
  const { mutateAsync: addReference } = useAddReference();
  const { mutateAsync: updateTshirt, isPending: tshirtUpdating } = useUpdateTshirt();
  const { mutateAsync: addTshirt, isPending: tshirtAdding } = useAddTshirt();
  const loadTshirts = useTshirtsLoader();
  const { members, addMember, removeMember, isShared } = useMembers();
  const { data: references = [] as ProductReference[] } = useReferences();
  const { data: achats = {} } = useAchats();
  const { data: allSales = [] } = useAllSalesData();
  const { isListening, transcript, isSupported, start, stop, reset } = useVoiceInput((final) => setText(final));

  const isPending = chatPending || stockPending || tshirtUpdating || tshirtAdding;

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

  /** Asks a question and keeps the input open for the reply, instead of
   *  closing the sheet like succeed()/fail() do. */
  const ask = (msg: string) => {
    setTurns((t) => [...t, { from: 'ai', text: msg }]);
  };

  const describeChatResult = (result: { message?: string; action?: string }) =>
    result.message ?? (
      result.action === 'modifier'        ? 'Vente(s) mise(s) à jour ✓'      :
      result.action === 'vente'           ? 'Vente(s) ajoutée(s) ✓'          :
      result.action === 'square_payment'  ? 'Vente enregistrée · Square ✓'  :
      result.action === 'stock_update'    ? 'Stock mis à jour ✓'             :
      'Enregistré !'
    );

  const errMsg = (e: unknown) => (e instanceof Error ? e.message : 'Erreur réseau');

  /** Sends a message to the backend chatbot with the catalogue + adhérents directory attached. */
  const chat = (message: string, fu?: { user: string; ai: string } | null) =>
    sendChat({ message, members, followUp: fu ?? undefined });

  /** After a sale: anyone not yet in the directory joins it, so next time they're recognised. */
  const registerBuyers = (result: ChatResponse): string[] => {
    if (result.action !== 'vente' && result.action !== 'square_payment') return [];
    const fresh: string[] = [];
    for (const buyer of extractBuyers(result)) {
      const name = normalizeMemberName(buyer); // single first names can't be filed as "Prénom NOM"
      if (!name || members.some((m) => memberKey(m) === memberKey(name))) continue;
      void addMember(name); // the sale row already makes them known; this files them in the shared list too
      fresh.push(name);
    }
    return fresh;
  };

  const describeSale = (result: ChatResponse) => {
    const fresh = registerBuyers(result);
    const base = describeChatResult(result);
    return fresh.length ? `${base} · nouvel adhérent : ${fresh.join(', ')}` : base;
  };

  const applyTshirtPlan = async (intent: TshirtIntent, data: Awaited<ReturnType<typeof loadTshirts>>) => {
    const plan = planTshirt(intent, data);
    switch (plan.kind) {
      case 'ask':
        ask(plan.message);
        setPendingTshirt(plan.intent);
        return;
      case 'fail':
        fail(plan.message);
        return;
      case 'answer':
        succeed(plan.message);
        return;
      case 'write':
        if (plan.exists) {
          await updateTshirt({ marque: plan.marque, sexe: plan.sexe, taille: plan.taille, nouvelle_quantite: plan.to });
        } else {
          await addTshirt({ marque: plan.marque, sexe: plan.sexe, taille: plan.taille, quantite: plan.to });
        }
        succeed(plan.message);
        return;
    }
  };

  const handleSend = async () => {
    const raw = (isListening ? transcript : text).trim();
    if (!raw) return;

    setTurns((t) => [...t, { from: 'user', text: raw }]);
    setText('');
    if (isListening) { stop(); reset(); }

    const previousExchange = followUp;
    setFollowUp(null);

    // ── 0. Resolve a pending "je ne connais pas ce produit, quel prix ?" ───
    // Covers stock-in ("+15 NCS Pro"), sales ("2 NCS Pro pour David") and an
    // explicit "nouvelle référence X" typed without a price — instead of just
    // rejecting it, we ask for a price, create the reference, then either
    // apply the stock movement directly or replay the original sale.
    if (pendingUnknown) {
      const pending = pendingUnknown;
      setPendingUnknown(null);
      const priceMatch = raw.match(/^(\d+(?:[,.]\d+)?)\s*(?:€|euros?)?$/i);
      const price = priceMatch ? parseFloat(priceMatch[1].replace(',', '.')) : NaN;
      if (!isNaN(price) && price > 0) {
        try {
          await withWakeHint(() => addReference({ name: pending.name, price, color: pickColor(references) }));

          if (pending.createOnly) {
            succeed(`Référence « ${pending.name} » créée à ${price} € ✓`);
          } else if (pending.qty) {
            await withWakeHint(() => updateStock({ product: pending.name, qty: pending.qty! }));
            succeed(`Référence « ${pending.name} » créée à ${price} € — +${pending.qty} boîte${pending.qty > 1 ? 's' : ''} ✓`);
          } else {
            const chatResult = await withWakeHint(() => chat(pending.raw));
            if (chatResult.action === 'produit_inconnu') {
              fail(`Référence créée, mais je n'ai pas retrouvé « ${pending.name} » dans ta phrase — réessaie en la réécrivant`);
            } else if (chatResult.success) {
              succeed(`Référence « ${pending.name} » créée à ${price} € — ${describeSale(chatResult)}`);
            } else {
              fail("Référence créée, mais le chatbot n'a pas compris la suite. Reformule ?");
            }
          }
        } catch (e) {
          fail(errMsg(e));
        }
        return;
      }
      // Not a price → the user moved on; drop the pending question and
      // process this message normally instead of getting stuck.
    }

    // ── 0b. Resolve a pending maillot question ("quel modèle ?", "quelle taille ?"…) ──
    if (pendingTshirt) {
      const pending = pendingTshirt;
      setPendingTshirt(null);
      try {
        const data = await withWakeHint(() => loadTshirts());
        const filled = fillTshirtIntent(pending, raw, data.marques);
        if (filled) {
          await applyTshirtPlan(filled, data);
          return;
        }
      } catch (e) {
        fail(errMsg(e));
        return;
      }
      // Nothing usable in the reply → the user moved on; handle it as a fresh message.
    }

    // ── 1. Add adhérent(s) — "ajoute l'adhérent Lucas MARTIN" ───────────────
    const memberNames = parseAddMembers(raw);
    if (memberNames) {
      const toAdd: string[] = [];
      const already: string[] = [];
      const invalid: string[] = [];
      const seen = new Set(members.map(memberKey));
      for (const typed of memberNames) {
        const name = normalizeMemberName(typed);
        if (!name) { invalid.push(typed); continue; }
        const key = memberKey(name);
        if (seen.has(key)) {
          already.push(members.find((m) => memberKey(m) === key) ?? name);
          continue;
        }
        seen.add(key);
        toAdd.push(name);
      }
      const results = await Promise.all(toAdd.map((n) => addMember(n)));
      const offline = results.some((r) => !r.synced);
      const notes = [
        already.length ? `déjà dans la liste : ${already.join(', ')}` : '',
        invalid.length ? `il me manque le nom (Prénom NOM) : ${invalid.join(', ')}` : '',
        offline ? '⚠ serveur injoignable : gardé sur cet appareil, synchronisé dès que possible' : '',
      ].filter(Boolean);
      if (toAdd.length) {
        succeed(`${toAdd.join(', ')} ajouté${toAdd.length > 1 ? 's' : ''} aux adhérents ✓${notes.length ? ` · ${notes.join(' · ')}` : ''}`);
      } else if (already.length && !invalid.length) {
        succeed(already.length === 1 ? `${already[0]} est déjà dans la liste des adhérents` : `Déjà dans la liste : ${already.join(', ')}`);
      } else {
        fail(`Il me faut le prénom ET le nom pour ajouter un adhérent — ex : « Lucas MARTIN »${invalid.length ? ` (reçu : ${invalid.join(', ')})` : ''}`);
      }
      return;
    }

    // ── 1b. Remove adhérent(s) from the shared list — fixes a typo'd name ────
    const removeNames = parseRemoveMembers(raw);
    if (removeNames) {
      const removed: string[] = [];
      const notes: string[] = [];
      try {
        for (const typed of removeNames) {
          const known = members.find((m) => memberKey(m) === memberKey(normalizeMemberName(typed) ?? typed));
          if (!known) { notes.push(`« ${typed} » n'est pas dans la liste`); continue; }
          if (!isShared(known)) { notes.push(`${known} vient des ventes ou des entraînements, je ne peux pas le retirer d'ici`); continue; }
          await removeMember(known);
          removed.push(known);
        }
      } catch (e) {
        fail(errMsg(e));
        return;
      }
      const tail = notes.length ? ` · ${notes.join(' · ')}` : '';
      if (removed.length) succeed(`${removed.join(', ')} retiré${removed.length > 1 ? 's' : ''} de la liste des adhérents ✓${tail}`);
      else fail(notes.join(' · '));
      return;
    }

    // ── 2. Add reference — registers on the backend first (Stock row + sales
    //      tab) so the reference is actually usable, not just a local label ──
    const newRef = parseAddRef(raw);
    if (newRef) {
      const clash = references.find((r) => foldAccents(r.name).toLowerCase() === foldAccents(newRef.name).toLowerCase());
      if (clash) {
        fail(`« ${clash.name} » existe déjà (${clash.price} € / boîte)`);
        return;
      }
      if (newRef.price === null) {
        ask(`Quel est le prix de « ${newRef.name} » ? (ex: 20€)`);
        setPendingUnknown({ raw, name: newRef.name, createOnly: true });
        return;
      }
      try {
        await withWakeHint(() => addReference({ name: newRef.name, price: newRef.price!, color: pickColor(references) }));
        succeed(`Référence « ${newRef.name} » ajoutée à ${newRef.price} € ✓`);
      } catch (e) {
        fail(errMsg(e));
      }
      return;
    }

    // ── 3. Maillots / t-shirts — must come before stock-in: "reçu 20 maillots
    //      femme M" would otherwise be read as a volant delivery of a product
    //      called "maillots femme M" ──────────────────────────────────────────
    if (isTshirtMessage(raw)) {
      try {
        const data = await withWakeHint(() => loadTshirts());
        const intent = parseTshirtIntent(raw, data.marques);
        if (!intent) {
          fail('Ajouter ou fixer ? Écris « reçu 12 maillots … » pour ajouter, ou « mets … à 12 » pour fixer le stock');
          return;
        }
        await applyTshirtPlan(intent, data);
      } catch (e) {
        fail(errMsg(e));
      }
      return;
    }

    // ── 4. Stock reception (local for speed & custom product support) ──────
    const stockIn = parseStockIn(raw, references);
    if (stockIn) {
      if (!stockIn.ref) {
        ask(`Je ne connais pas encore « ${stockIn.name} ». Quel est son prix pour l'ajouter au catalogue ? (ex: 20€)`);
        setPendingUnknown({ raw, name: stockIn.name, qty: stockIn.qty });
        return;
      }
      try {
        await withWakeHint(() => updateStock({ product: stockIn.ref!.name, qty: stockIn.qty }));
        succeed(`+${stockIn.qty} boîte${stockIn.qty > 1 ? 's' : ''} de ${stockIn.ref.name} ✓`);
      } catch (e) {
        fail(errMsg(e));
      }
      return;
    }

    // ── 5. Stock query (local, instant) ────────────────────────────────────
    const stockRef = parseStockQuery(raw, references);
    if (stockRef) {
      const inStock = netStock[stockRef.name] ?? 0;
      succeed(`${stockRef.name} : ${inStock} boîte${inStock !== 1 ? 's' : ''} en stock`);
      return;
    }

    // ── 6. Price query (local) ─────────────────────────────────────────────
    const priceRef = parsePriceQuery(raw, references);
    if (priceRef) {
      succeed(`${priceRef.name} : ${priceRef.price} € / boîte`);
      return;
    }

    // ── 7. Backend — catalogue + adhérents directory attached automatically ─
    try {
      const result = await withWakeHint(() => chat(raw, previousExchange));
      if (result.action === 'produit_inconnu' && result.produit) {
        ask(result.message ?? `Je ne connais pas « ${result.produit} ». Quel est son prix ?`);
        setPendingUnknown({ raw, name: result.produit });
      } else if (result.action === 'conversation' && result.message?.includes('?')) {
        // The backend is asking something back ("Tu veux dire X ou Y ?") — keep the
        // conversation open and hand it this exchange with the next message.
        ask(result.message);
        setFollowUp({ user: raw, ai: result.message });
      } else if (result.success) {
        succeed(describeSale(result));
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
