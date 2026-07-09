import {explainerHtml, parseBridgeMessage} from '../ratesExplainer';

describe('parseBridgeMessage — the web→native bridge', () => {
  it('parses a valid convert message and uppercases the codes', () => {
    const data = JSON.stringify({type: 'convert', from: 'usd', to: 'jpy'});
    expect(parseBridgeMessage(data)).toEqual({from: 'USD', to: 'JPY'});
  });

  it.each([
    ['not json at all', 'not json'],
    ['wrong type', JSON.stringify({type: 'ping', from: 'USD', to: 'JPY'})],
    ['missing to', JSON.stringify({type: 'convert', from: 'USD'})],
    ['non-string codes', JSON.stringify({type: 'convert', from: 1, to: 2})],
    ['null', JSON.stringify(null)],
    // The trust-boundary cases: a hostile web payload must not ride through.
    ['path traversal', JSON.stringify({type: 'convert', from: 'usd/../evil', to: 'JPY'})],
    ['too long', JSON.stringify({type: 'convert', from: 'USDD', to: 'JPY'})],
    ['empty code', JSON.stringify({type: 'convert', from: '', to: 'JPY'})],
  ])('rejects %s', (_label, data) => {
    expect(parseBridgeMessage(data)).toBeNull();
  });
});

describe('explainerHtml', () => {
  it('bundles the content offline — no network, provenance rules on the page', () => {
    const html = explainerHtml(false);
    expect(html).toContain('ECB reference');
    expect(html).toContain('Community (indicative)');
    // The bridge call is wired into the page, not fetched.
    expect(html).toContain('ReactNativeWebView.postMessage');
    expect(html).not.toContain('http://');
    expect(html).not.toContain('https://');
  });

  it('themes to dark when asked', () => {
    expect(explainerHtml(true)).toContain('#111418');
  });
});
