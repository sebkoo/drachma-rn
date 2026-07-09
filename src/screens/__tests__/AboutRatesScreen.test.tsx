/**
 * The hybrid bridge, end to end: a pair tapped in the web content posts a
 * message, and the native screen routes it into the converter seam + navigates.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {LinkScope} from '../../linking/LinkContext';
import AboutRatesScreen from '../AboutRatesScreen';

const mockNavigate = jest.fn();
jest.mock('@react-navigation/native', () => ({
  useNavigation: () => ({navigate: mockNavigate}),
}));

test('a pair tapped in the webview drives the native converter', async () => {
  const onConvert = jest.fn();

  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <LinkScope link={null} onConvert={onConvert}>
        <AboutRatesScreen />
      </LinkScope>,
    );
  });

  // The mocked WebView carries the onMessage prop; fire a bridge message.
  const webview = tree.root.find(
    node => typeof node.props.onMessage === 'function',
  );
  await ReactTestRenderer.act(async () => {
    webview.props.onMessage({
      nativeEvent: {
        data: JSON.stringify({type: 'convert', from: 'EUR', to: 'USD'}),
      },
    });
  });

  expect(onConvert).toHaveBeenCalledWith('EUR', 'USD');
  expect(mockNavigate).toHaveBeenCalledWith('Converter');

  // The surface is locked to its own bundled HTML: only about: loads pass.
  expect(webview.props.onShouldStartLoadWithRequest({url: 'about:blank'})).toBe(true);
  expect(
    webview.props.onShouldStartLoadWithRequest({url: 'https://evil.example'}),
  ).toBe(false);
});

test('a malformed message is ignored', async () => {
  const onConvert = jest.fn();
  mockNavigate.mockClear();

  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <LinkScope link={null} onConvert={onConvert}>
        <AboutRatesScreen />
      </LinkScope>,
    );
  });

  const webview = tree.root.find(
    node => typeof node.props.onMessage === 'function',
  );
  await ReactTestRenderer.act(async () => {
    webview.props.onMessage({nativeEvent: {data: 'garbage'}});
  });

  expect(onConvert).not.toHaveBeenCalled();
  expect(mockNavigate).not.toHaveBeenCalled();
});
