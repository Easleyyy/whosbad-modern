// Test-only: a real Postgres (pglite, WASM, in-process) implementing the same `Db` interface
// as production. Route modules are tested against this — real constraints, real transactions,
// no mocking of SQL semantics — never against Neon. See netlify/lib/db.ts for the production
// implementation and the `Db` contract.
import { PGlite } from '@electric-sql/pglite';
// esbuild's `text` loader (see netlify/lib/sql.d.ts + any esbuild invocation touching this
// file) inlines this as a string constant at bundle time — reading it from disk at runtime
// would break once this module is bundled (its real location is flattened away).
import schema from './schema.sql';
import type { Db } from './db';

export async function makeTestDb(): Promise<Db> {
  const pg = new PGlite();
  await pg.exec(schema);

  const wrap = (run: typeof pg.query): Db => ({
    query: async (text, params) => (await run.call(pg, text, params as unknown[])).rows as Record<string, unknown>[] as never,
    transaction: (fn) => pg.transaction((tx) => fn(wrap(tx.query.bind(tx)))),
  });
  return wrap(pg.query.bind(pg));
}
