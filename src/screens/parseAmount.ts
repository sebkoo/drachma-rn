/**
 * Parses user-typed amounts with stated, testable separator rules — because
 * when the number is money, a wrong parse is worse than no parse.
 *
 *   Both separators present → the LAST one is the decimal mark:
 *     "1,234.56" → 1234.56 · "1.234,56" → 1234.56
 *   Comma only → 3-digit groups are grouping, anything else is a decimal comma:
 *     "1,234" → 1234 · "12,5" → 12.5
 *   Dot only → a plain decimal (the decimal-pad convention):
 *     "1.234" → 1.234 — deliberately NOT read as a thousand
 *   Spaces are grouping: "1 234,56" → 1234.56
 *
 * Everything ambiguous or malformed returns NaN — the caller treats NaN as
 * "no result", never as zero and never as a guess.
 */
const GROUPED_BY_COMMAS = /^-?\d{1,3}(,\d{3})+$/;

export function parseAmount(text: string): number {
  const trimmed = text.replace(/\s+/g, '');
  if (trimmed === '') {
    return NaN;
  }
  const lastComma = trimmed.lastIndexOf(',');
  const lastDot = trimmed.lastIndexOf('.');
  let normalized: string;
  if (lastComma >= 0 && lastDot >= 0) {
    normalized =
      lastDot > lastComma
        ? trimmed.replace(/,/g, '') // "1,234.56"
        : trimmed.replace(/\./g, '').replace(',', '.'); // "1.234,56"
  } else if (lastComma >= 0) {
    normalized = GROUPED_BY_COMMAS.test(trimmed)
      ? trimmed.replace(/,/g, '') // "1,234" / "-12,345,678"
      : trimmed.replace(/,/g, '.'); // "12,5"
  } else {
    normalized = trimmed;
  }
  return Number(normalized);
}
