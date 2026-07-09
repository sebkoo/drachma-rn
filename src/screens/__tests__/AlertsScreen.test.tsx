/**
 * The write path, end to end through the view: add an alert, and it appears
 * immediately (optimistic) and then settles to synced after the flush — with
 * the real WriteQueue + MockAlertsService injected through AlertsScope.
 */
import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import {AlertsScope} from '../../alerts/AlertsContext';
import {MockAlertsService} from '../../alerts/alertsService';
import {InMemoryQueueStore} from '../../alerts/queueStore';
import {WriteQueue} from '../../alerts/writeQueue';
import AlertsScreen from '../AlertsScreen';

jest.mock('react-native-safe-area-context', () =>
  require('react-native-safe-area-context/jest/mock').default,
);

/** Walk only the children (never props — a FlatList's props are circular). */
function collectText(node: unknown): string {
  if (node == null) {
    return '';
  }
  if (typeof node === 'string') {
    return node;
  }
  if (Array.isArray(node)) {
    return node.map(collectText).join(' ');
  }
  return collectText((node as {children?: unknown}).children);
}

function textOf(tree: ReactTestRenderer.ReactTestRenderer): string {
  return collectText(tree.toJSON());
}

test('adds an alert optimistically and settles it to synced', async () => {
  const queue = new WriteQueue(new MockAlertsService(), new InMemoryQueueStore(), {
    sleep: async () => {},
  });

  let tree!: ReactTestRenderer.ReactTestRenderer;
  await ReactTestRenderer.act(async () => {
    tree = ReactTestRenderer.create(
      <AlertsScope queue={queue}>
        <AlertsScreen />
      </AlertsScope>,
    );
  });

  // Tap "Add alert".
  const addButton = tree.root.find(
    node => node.props.testID === 'add-alert',
  );

  await ReactTestRenderer.act(async () => {
    addButton.props.onPress();
  });

  const rendered = textOf(tree);
  expect(rendered).toContain('USD');
  expect(rendered).toContain('KRW');
  expect(rendered).toContain('Synced'); // flush ran and confirmed it
  expect(queue.confirmedAlerts()).toHaveLength(1);
});
