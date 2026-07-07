/**
 * Renders the full app with the rates API mocked — no network in tests.
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

jest.mock('../src/api/rates', () => {
  const actual = jest.requireActual('../src/api/rates');
  return {
    ...actual,
    latestRates: jest.fn(async () => ({
      base: 'USD',
      date: '2026-07-06',
      rates: {KRW: 1391.2, EUR: 0.876},
      source: 'ecb',
    })),
  };
});

test('renders the converter with a converted amount and provenance label', async () => {
  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(<App />);
  });

  const rendered = JSON.stringify(tree.toJSON());
  expect(rendered).toContain('KRW');
  // The product's honesty rule, asserted: provenance is on screen.
  expect(rendered).toContain('ECB reference · 2026-07-06');
});
