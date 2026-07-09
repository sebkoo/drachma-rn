module.exports = {
  preset: '@react-native/jest-preset',
  setupFiles: ['./jest.setup.js'],
  // These libraries ship untranspiled source (or TSX jest mocks) inside
  // node_modules, so they must be allowed through the transformer.
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|react-native-safe-area-context|@react-native-async-storage|@react-navigation|react-native-screens)/)',
  ],
};
