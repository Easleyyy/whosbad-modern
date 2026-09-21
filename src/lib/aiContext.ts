import type { ProductReference } from '@/types';

export interface ChatContext {
  refs: ProductReference[];
  /** Known adhérents, "Prénom NOM". */
  members?: string[];
  /** Previous exchange, when the user is answering a question the chatbot just asked. */
  followUp?: { user: string; ai: string };
}

/**
 * Injects the full, live catalogue and adhérents directory into every message sent
 * to the backend chatbot, so it can recognise custom/dynamic references and people
 * it has no built-in knowledge of — whether the message is a sale, a stock update,
 * or a plain query.
 */
export function withChatContext(message: string, { refs, members = [], followUp }: ChatContext): string {
  const parts: string[] = [];

  if (refs.length) {
    parts.push(`[Catalogue produits disponibles:\n${refs.map((r) => `• ${r.name} — ${r.price} €/boîte`).join('\n')}]`);
  }
  if (members.length) {
    parts.push(
      `[Adhérents connus (format « Prénom NOM ») — sers-toi de cette liste pour retrouver un prénom ou une abréviation. ` +
      `Si l'acheteur n'y figure PAS, c'est un nouvel adhérent : enregistre quand même la vente avec le nom fourni ` +
      `au format « Prénom NOM » (prénom en minuscules sauf initiale, NOM en majuscules), sans refuser ni demander de confirmation:\n${members.join(', ')}]`
    );
  }
  if (followUp) {
    parts.push(`[Échange précédent — l'utilisateur répond à ta question:\nUtilisateur : ${followUp.user}\nToi : ${followUp.ai}]`);
  }
  parts.push(`Demande: ${message}`);
  return parts.join('\n\n');
}
