// Shared secret sent on every API call — see netlify/lib/auth.ts for what this does and does
// NOT protect against (it's baked into the public JS bundle, readable by anyone who opens
// DevTools; it stops opportunistic bots, not a targeted attacker). Harmless to send on GETs
// too: the backend only checks it on the routes that write.
const secret = import.meta.env.VITE_API_SECRET;

export const AUTH_HEADERS: Record<string, string> = secret ? { Authorization: `Bearer ${secret}` } : {};
