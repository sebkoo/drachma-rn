/**
 * The webview half of the hybrid. It renders bundled explainer HTML (no fetch,
 * so offline honesty holds) inside the native shell, and bridges back: a pair
 * tapped in the web content posts a message, which we route into the native
 * converter — the same seam a deep link uses. See docs/adr/0002.
 */
import React, {useCallback} from 'react';
import {useColorScheme} from 'react-native';
import {WebView, WebViewMessageEvent} from 'react-native-webview';
import {useNavigation} from '@react-navigation/native';
import {NativeStackNavigationProp} from '@react-navigation/native-stack';
import {useApplyConvert} from '../linking/LinkContext';
import {explainerHtml, parseBridgeMessage} from '../webview/ratesExplainer';
import type {RootStackParamList} from '../navigation/routes';

export default function AboutRatesScreen(): React.JSX.Element {
  const dark = useColorScheme() === 'dark';
  const applyConvert = useApplyConvert();
  const navigation =
    useNavigation<NativeStackNavigationProp<RootStackParamList>>();

  const onMessage = useCallback(
    (event: WebViewMessageEvent) => {
      const intent = parseBridgeMessage(event.nativeEvent.data);
      if (intent) {
        applyConvert(intent.from, intent.to);
        navigation.navigate('Converter');
      }
    },
    [applyConvert, navigation],
  );

  return (
    <WebView
      source={{html: explainerHtml(dark)}}
      onMessage={onMessage}
      javaScriptEnabled
      // Lock the surface down: allow only the initial about:blank load of our
      // bundled HTML and refuse every other navigation (a stray link or a
      // compromised page can't send the user to an external URL). Belt and
      // braces with the message validation in parseBridgeMessage.
      onShouldStartLoadWithRequest={request => request.url.startsWith('about:')}
      javaScriptCanOpenWindowsAutomatically={false}
    />
  );
}
