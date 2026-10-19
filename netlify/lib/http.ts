// Response shaping shared by every route module — same JSON envelope the old Express backend
// and the two ad hoc Netlify Functions already used, so the frontend contract never moves.
export const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });

export const ok = (body: unknown) => json({ success: true, ...(body as object) });
export const fail = (error: string, status = 400) => json({ success: false, error }, status);

export async function readBody<T = Record<string, unknown>>(req: Request): Promise<T | null> {
  try {
    return (await req.json()) as T;
  } catch {
    return null;
  }
}
