import {fallbackFormat, formatCurrency} from '../currencyFormatter';

describe('currency formatting', () => {
  it('falls back to the JS formatter when the native module is absent (Jest)', async () => {
    expect(await formatCurrency(1391.2, 'USD')).toBe('1,391.2 USD');
  });

  it('gives zero-decimal currencies zero decimals', () => {
    expect(fallbackFormat(151445.37, 'KRW')).toBe('151,445 KRW');
    expect(fallbackFormat(6575052.68, 'vnd')).toBe('6,575,053 VND');
  });

  it('keeps two decimals for decimal currencies', () => {
    expect(fallbackFormat(87.6123, 'EUR')).toBe('87.61 EUR');
  });
});
