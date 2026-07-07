module.exports = {
  preset: '@react-native/jest-preset',
  // The safe-area-context jest mock ships as TSX inside node_modules, so it
  // must be allowed through the transformer alongside the RN packages.
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-native|react-native-safe-area-context)/)',
  ],
};
