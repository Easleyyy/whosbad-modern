/** Strip accents so "réçu"/"recu"/"reçu" etc. all match the same way. */
export function foldAccents(s: string): string {
  return s.normalize('NFD').replace(/[̀-ͯ]/g, '');
}

/** Lower-cased, accent-free, whitespace-collapsed form used for every fuzzy comparison. */
export function fold(s: string): string {
  return foldAccents(s).toLowerCase().replace(/[’`]/g, "'").replace(/\s+/g, ' ').trim();
}
