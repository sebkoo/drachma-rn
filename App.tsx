import React, { useEffect, useMemo, useState } from 'react';
import { Linking, StatusBar, useColorScheme } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { RatesProviderScope } from './src/di/RatesContext';
import { errorDemoProvider, offlineDemoProvider } from './src/di/demoProviders';
import { ConvertLink, parseConvertLink } from './src/linking/parseLink';
import ConverterScreen from './src/screens/ConverterScreen';

function App(): React.JSX.Element | null {
  const isDarkMode = useColorScheme() === 'dark';
  const [link, setLink] = useState<ConvertLink | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    Linking.getInitialURL()
      .then(url => {
        if (url) {
          setLink(parseConvertLink(url));
        }
      })
      .finally(() => setReady(true));
    const subscription = Linking.addEventListener('url', event => {
      const parsed = parseConvertLink(event.url);
      if (parsed) {
        setLink(parsed);
      }
    });
    return () => subscription.remove();
  }, []);

  // The ?demo= hooks swap the provider at the composition root — the same
  // seam tests use, which is the point: every UI state is one URL away.
  const provider = useMemo(() => {
    if (link?.demo === 'offline') {
      return offlineDemoProvider();
    }
    if (link?.demo === 'error') {
      return errorDemoProvider();
    }
    return undefined;
  }, [link?.demo]);

  if (!ready) {
    return null; // don't flash defaults before the initial URL resolves
  }

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <RatesProviderScope provider={provider}>
        <ConverterScreen link={link} />
      </RatesProviderScope>
    </SafeAreaProvider>
  );
}

export default App;
