/**
 * Locale-correct currency formatting through the custom Swift native module
 * (NumberFormatter knows KRW/JPY/VND take zero decimals and which symbol to
 * use — Hermes's partial Intl doesn't). Falls back to a small JS formatter
 * where the module isn't present: Android (for now) and Jest.
 */
import {NativeModules} from 'react-native';

interface CurrencyFormatterModule {
  format(amount: number, currencyCode: string): Promise<string>;
}

const native: CurrencyFormatterModule | undefined =
  NativeModules.CurrencyFormatter;

export async function formatCurrency(
  amount: number,
  code: string,
): Promise<string> {
  if (native?.format) {
    try {
      return await native.format(amount, code);
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
