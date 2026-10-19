// Only netlify/lib/testDb.ts imports a .sql file; esbuild's `text` loader turns it into a
// plain string at bundle time (see any esbuild command that touches testDb.ts).
declare module '*.sql' {
  const content: string;
  export default content;
}
