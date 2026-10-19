import crypto from 'crypto';
import { SquareClient, SquareEnvironment, WebhooksHelper } from 'square';

// Thin wrapper the route handler depends on instead of the Square SDK directly, so tests can
// inject a fake and never need real Square credentials (see netlify/lib/squareRoutes.ts).
export interface SquareGateway {
  createPaymentLink(amountCents: number, description: string): Promise<{ orderId: string; checkoutUrl: string }>;
  verifyWebhookSignature(rawBody: string, signature: string | null, url: string): Promise<boolean>;
}

/** Real Square, built lazily so a missing/placeholder token doesn't crash the whole function —
 *  every caller must check `isSquareConfigured()` first and fall back like the old backend did. */
export function isSquareConfigured(): boolean {
  const token = process.env.SQUARE_ACCESS_TOKEN;
  return !!token && !token.startsWith('REMPLACE');
}

export function realSquareGateway(): SquareGateway {
  const client = new SquareClient({
    token: process.env.SQUARE_ACCESS_TOKEN as string, // isSquareConfigured() already checked this by every caller's contract
    environment: process.env.SQUARE_ENV === 'production' ? SquareEnvironment.Production : SquareEnvironment.Sandbox,
  });
  return {
    async createPaymentLink(amountCents, description) {
      const response = await client.checkout.paymentLinks.create({
        idempotencyKey: crypto.randomUUID(),
        quickPay: {
          name: description,
          priceMoney: { amount: BigInt(amountCents), currency: 'EUR' },
          locationId: process.env.SQUARE_LOCATION_ID as string, // required Netlify env var — see DEPLOYMENT.md
        },
      });
      const link = response.paymentLink;
      if (!link?.orderId || !link.url) throw new Error('Square: réponse inattendue');
      return { orderId: link.orderId, checkoutUrl: link.url };
    },
    async verifyWebhookSignature(rawBody, signature, url) {
      const key = process.env.SQUARE_WEBHOOK_SIGNATURE_KEY;
      if (!key || key.startsWith('REMPLACE') || !signature) return true; // unconfigured — accept, like the old dev-mode behaviour
      return WebhooksHelper.verifySignature({ requestBody: rawBody, signatureHeader: signature, signatureKey: key, notificationUrl: url });
    },
  };
}
