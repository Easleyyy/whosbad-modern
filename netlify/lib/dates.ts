// Every `date` column is read back via to_char(..., 'YYYY-MM-DD' or 'DD/MM/YYYY') — never the
// raw column — so callers always get a plain string, never a driver-specific Date object (pg
// and pglite don't necessarily agree on how a bare `date` column comes back). Storage is
// always ISO (what Postgres' `date` type parses unambiguously); the club-facing format
// everywhere else in the app is DD/MM/YYYY (see src/lib/utils.ts's date helpers).
export const todayISO = () => new Date().toLocaleDateString('en-CA'); // en-CA = YYYY-MM-DD

/** Accepts 'DD/MM/YYYY' (what the app and the old Sheets used everywhere) or an ISO date,
 *  falling back to today. Never throws — an unparsable value just becomes today's date,
 *  matching how the old Sheets-backed backend never validated dates either. */
export function toISODate(input: unknown): string {
  if (typeof input === 'string') {
    const dmy = input.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (dmy) {
      const [, d, m, y] = dmy;
      return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`;
    }
    if (/^\d{4}-\d{2}-\d{2}$/.test(input)) return input;
  }
  return todayISO();
}
