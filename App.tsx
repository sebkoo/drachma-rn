import React from 'react';
import { StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RatesProviderScope } from './src/di/RatesContext';
import ConverterScreen from './src/screens/ConverterScreen';

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <RatesProviderScope>
        <ConverterScreen />
      </RatesProviderScope>
    </SafeAreaProvider>
  );
}

export default App;
