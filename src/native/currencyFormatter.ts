/**
 * Locale-correct currency formatting through the CurrencyFormatter TurboModule
 * (NumberFormatter on iOS, java.util.Currency on Android — both know KRW/JPY/
 * VND take zero decimals and which symbol to use, where Hermes's partial Intl
 * doesn't). The module is resolved through the codegen spec; where it's absent
 * — Jest, or any platform before its native side lands — we fall back to a
 * small JS formatter instead of throwing.
 */
import CurrencyFormatter from './NativeCurrencyFormatter';

export async function formatCurrency(
  amount: number,
  code: string,
): Promise<string> {
  if (CurrencyFormatter) {
    try {
      return await CurrencyFormatter.format(amount, code);
    } catch {
      // fall through to the JS fallback
    }
  }
  return fallbackFormat(amount, code);
}

/** ISO 4217 zero-decimal currencies among our quick picks + common ones. */
const ZERO_DECIMAL = new Set(['KRW', 'JPY', 'VND', 'CLP', 'ISK']);

export function fallbackFormat(amount: number, code: string): string {
  const upper = code.toUpperCase();
  const digits = ZERO_DECIMAL.has(upper) ? 0 : 2;
  return `${amount.toLocaleString(undefined, {
    maximumFractionDigits: digits,
  })} ${upper}`;
}
