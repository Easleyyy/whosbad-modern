import type { ProductReference } from '@/types';

/**
 * Injects the full, live catalogue into every message sent to the backend chatbot,
 * so it can recognise custom/dynamic references it has no built-in knowledge of —
 * whether the message is a sale, a stock update, or a plain query.
 */
export function withCatalogueContext(message: string, refs: ProductReference[]): string {
  const catalogue = refs.map((r) => `• ${r.name} — ${r.price} €/boîte`).join('\n');
  return `[Catalogue produits disponibles:\n${catalogue}]\n\nDemande: ${message}`;
}
