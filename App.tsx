import React, {useEffect, useMemo, useState} from 'react';
import {
  Linking,
  Pressable,
  StatusBar,
  StyleSheet,
  Text,
  useColorScheme,
} from 'react-native';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {
  NavigationContainer,
  LinkingOptions,
  useNavigation,
} from '@react-navigation/native';
import {
  createNativeStackNavigator,
  NativeStackNavigationProp,
} from '@react-navigation/native-stack';
import {RatesProviderScope} from './src/di/RatesContext';
import {errorDemoProvider, offlineDemoProvider} from './src/di/demoProviders';
import {AlertsScope} from './src/alerts/AlertsContext';
import {startupTrace} from './src/perf/startupTrace';
import {ConvertLink, parseConvertLink} from './src/linking/parseLink';
import {LinkScope} from './src/linking/LinkContext';
import ConverterScreen from './src/screens/ConverterScreen';
import AlertsScreen from './src/screens/AlertsScreen';

export type RootStackParamList = {
  Converter: undefined;
  Alerts: undefined;
};

const Stack = createNativeStackNavigator<RootStackParamList>();

/** Header button to the alerts screen — a stable component (not defined during
 *  render) so react-navigation doesn't remount it each time. */
function AlertsHeaderButton(): React.JSX.Element {
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const tint = useColorScheme() === 'dark' ? '#8AB4F8' : '#1F3A5F';
  return (
    <Pressable
      onPress={() => navigation.navigate('Alerts')}
      accessibilityRole="button">
      <Text style={[styles.headerLink, {color: tint}]}>Alerts</Text>
    </Pressable>
  );
}

// Typed routes replace the hand-drilled screen switch: drachma://convert opens
// the converter, drachma://alerts opens alerts. The converter's from/to/amount
// and the ?demo= provider swap still flow through parseConvertLink below, since
// they change the composition root, not just the route.
const linking: LinkingOptions<RootStackParamList> = {
  prefixes: ['drachma://'],
  config: {
    screens: {
      Converter: 'convert',
      Alerts: 'alerts',
    },
  },
};

function App(): React.JSX.Element {
  const isDarkMode = useColorScheme() === 'dark';
  const [link, setLink] = useState<ConvertLink | null>(null);

  useEffect(() => {
    startupTrace.markFirstRender();
    // Render immediately and fold the initial URL in when it resolves — the
    // old `if (!ready) return null` traded a blank launch frame for the rare
    // case of briefly showing defaults before a ?demo= link applies.
    Linking.getInitialURL().then(url => {
      if (url) {
        setLink(parseConvertLink(url));
      }
    });
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

  return (
    <SafeAreaProvider>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      <RatesProviderScope provider={provider}>
        <AlertsScope>
          <LinkScope link={link}>
            <NavigationContainer linking={linking}>
              <Stack.Navigator>
                <Stack.Screen
                  name="Converter"
                  component={ConverterScreen}
                  options={{
                    title: 'Drachma',
                    headerRight: AlertsHeaderButton,
                  }}
                />
                <Stack.Screen
                  name="Alerts"
                  component={AlertsScreen}
                  options={{title: 'Rate alerts'}}
                />
              </Stack.Navigator>
            </NavigationContainer>
          </LinkScope>
        </AlertsScope>
      </RatesProviderScope>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  headerLink: {fontSize: 16},
});

export default App;
