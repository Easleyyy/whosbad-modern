// Thin, driver-agnostic Postgres interface every route module depends on — never `pg` or
// `DATABASE_URL` directly. Production gets a real `pg.Pool` (see `pgDb` below); tests get an
// in-process real Postgres via pglite (netlify/lib/testDb.ts), so business logic runs against
// genuine SQL (constraints, unique keys, foreign keys) without touching Neon.
export interface Db {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<T[]>;
  /** Runs `fn` inside a transaction; its queries must go through the `trx` handed to it. */
  transaction<T>(fn: (trx: Db) => Promise<T>): Promise<T>;
}

let pool: import('pg').Pool | undefined;

/** Lazily creates the shared connection pool — one per function instance, reused across
 *  invocations while the instance stays warm (standard Netlify Functions / pg pattern). */
function getPool(): import('pg').Pool {
  if (!pool) {
    // Imported lazily so this module (and everything that imports only the `Db` type) stays
    // usable in tests without pulling in `pg` or requiring DATABASE_URL to be set.
    const pgModule = require('pg') as typeof import('pg');
    const { Pool } = pgModule;
    // bigint ids (OID 20) come back as strings by default; the app (and pglite in the tests)
    // treat them as numbers. Ids here stay far below 2^53, so a plain Number() is exact.
    pgModule.types.setTypeParser(20, (v: string) => Number(v));
    const connectionString = process.env.DATABASE_URL;
    if (!connectionString) throw new Error('DATABASE_URL manquant');
    // No `ssl` option here on purpose: Neon connection strings carry `sslmode=require` (pg
    // reads it from the string itself), and forcing SSL here would break local dev, which runs
    // against a plain (non-TLS) local Postgres — see DEPLOYMENT.md.
    pool = new Pool({ connectionString, max: 3 });
  }
  return pool;
}

export const pgDb: Db = {
  async query(text, params) {
    const res = await getPool().query(text, params as unknown[]);
    return res.rows;
  },
  async transaction(fn) {
    const client = await getPool().connect();
    try {
      await client.query('BEGIN');
      const trx: Db = {
        query: async (text, params) => (await client.query(text, params as unknown[])).rows,
        transaction: () => { throw new Error('Transactions imbriquées non supportées'); },
      };
      const result = await fn(trx);
      await client.query('COMMIT');
      return result;
    } catch (e) {
      await client.query('ROLLBACK').catch(() => undefined);
      throw e;
    } finally {
      client.release();
    }
  },
};
