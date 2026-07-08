/**
 * Parses user-typed amounts without guessing wrong on separators.
 * The old `replace(',', '.')` treated the FIRST comma as a decimal point,
 * so "1,234.56" became "1.234.56" → NaN. Rules, in order:
 *
 *   "1,234.56" (both separators)   → comma is grouping   → 1234.56
 *   "1,234" / "12,345,678" (3-digit groups) → grouping   → 1234 / 12345678
 *   "12,5" (comma, non-group shape) → decimal comma      → 12.5
 *   "1 000" (spaces)                → grouping           → 1000
 *
 * Anything else falls through to Number() and may be NaN — the caller
 * already treats NaN as "no result", never as zero.
 */
const GROUPED_THOUSANDS = /^\d{1,3}(,\d{3})+(\.\d+)?$/;

export function parseAmount(text: string): number {
  const trimmed = text.replace(/\s+/g, '');
  if (trimmed === '') {
    return NaN;
  }
  if (GROUPED_THOUSANDS.test(trimmed)) {
    return Number(trimmed.replace(/,/g, ''));
  }
  if (trimmed.includes(',') && !trimmed.includes('.')) {
    return Number(trimmed.replace(/,/g, '.'));
  }
  return Number(trimmed);
}
