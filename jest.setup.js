/* eslint-env jest */
// AsyncStorage is native; use the library's official in-memory jest mock.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest').default,
);

// WebView is a native component; render it as a plain host element in tests so
// its props (source, onMessage) are inspectable without a real web engine.
jest.mock('react-native-webview', () => {
  const React = require('react');
  const WebView = props => React.createElement('RNCWebView', props);
  return {__esModule: true, WebView, default: WebView};
});
