import {parseConvertLink} from '../parseLink';

describe('parseConvertLink', () => {
  it('parses a full convert link and normalizes codes', () => {
    expect(parseConvertLink('drachma://convert?from=usd&to=vnd&amount=250')).toEqual({
      from: 'USD',
      to: 'VND',
      amount: '250',
    });
  });

  it('accepts decimal amounts with comma or dot', () => {
    expect(parseConvertLink('drachma://convert?amount=99.5')?.amount).toBe('99.5');
    expect(parseConvertLink('drachma://convert?amount=99,5')?.amount).toBe('99,5');
  });

  it('drops invalid currency codes and amounts instead of failing', () => {
    expect(parseConvertLink('drachma://convert?from=DOLLARS&to=eur&amount=abc')).toEqual({
      to: 'EUR',
    });
  });

  it('parses the demo hooks', () => {
    expect(parseConvertLink('drachma://convert?demo=offline')?.demo).toBe('offline');
    expect(parseConvertLink('drachma://convert?demo=error')?.demo).toBe('error');
    expect(parseConvertLink('drachma://convert?demo=nope')?.demo).toBeUndefined();
  });

  it('rejects other schemes and hosts', () => {
    expect(parseConvertLink('https://convert?from=USD')).toBeNull();
    expect(parseConvertLink('drachma://settings')).toBeNull();
  });
});
