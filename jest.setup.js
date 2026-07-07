/* eslint-env jest */
// AsyncStorage is native; use the library's official in-memory jest mock.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest').default,
);
