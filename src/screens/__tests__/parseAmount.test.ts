import {parseAmount} from '../parseAmount';

describe('parseAmount — separator-honest amount parsing', () => {
  it.each([
    ['100', 100],
    ['1234.56', 1234.56],
    ['1,234.56', 1234.56], // grouped thousands with decimal point
    ['1,234', 1234], // grouped thousands, no decimals
    ['12,345,678', 12345678],
    ['12,5', 12.5], // European decimal comma
    ['0,99', 0.99],
    ['1 000', 1000], // space grouping
    ['1 234,56', 1234.56], // space grouping + decimal comma
  ])('parses %s as %d', (text, expected) => {
    expect(parseAmount(text)).toBeCloseTo(expected);
  });

  it.each([[''], ['abc'], ['1.2.3'], ['1,2,3']])(
    'returns NaN for %s instead of a wrong number',
    text => {
      expect(Number.isNaN(parseAmount(text))).toBe(true);
    },
  );
});
