// Shared secret required on every write. The frontend is a public SPA — anyone who opens
// DevTools can read this secret out of the shipped JS bundle, so this is NOT real
// authentication: it stops opportunistic bots/scanners hitting the API blindly, nothing more.
// Real protection against a targeted attacker would need actual user accounts, which nobody
// has asked for at this club's scale. Reads (GET) stay open, exactly as before this migration.
export function requireAuth(req: Request): Response | null {
  const expected = process.env.API_SECRET;
  if (!expected) return null; // not configured (e.g. a fresh local checkout) — fail open like before, don't brick dev
  const got = req.headers.get('authorization');
  if (got === `Bearer ${expected}`) return null;
  return new Response(JSON.stringify({ success: false, error: 'Non autorisé' }), {
    status: 401,
    headers: { 'Content-Type': 'application/json' },
  });
}
