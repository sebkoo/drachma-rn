/**
 * The converter — Drachma's core loop, in React Native. Pure view: all state
 * and behavior live in the useConverter ViewModel hook. Same rules as the
 * native iOS app: live keyless rates, provenance always on screen, and
 * offline staleness said out loud instead of hidden.
 */
import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import {sourceLabel} from '../api/rates';
import {ConvertLink} from '../linking/parseLink';
import {useConverter} from './useConverter';

const QUICK_PICKS = ['USD', 'EUR', 'KRW', 'JPY', 'GBP', 'VND'] as const;

export default function ConverterScreen(props: {
  link?: ConvertLink | null;
}): React.JSX.Element {
  const dark = useColorScheme() === 'dark';
  const vm = useConverter(props.link);
  const palette = dark ? darkPalette : lightPalette;

  return (
    <View style={[styles.screen, {backgroundColor: palette.background}]}>
      <Text style={[styles.title, {color: palette.text}]}>Drachma</Text>

      <TextInput
        style={[styles.amount, {color: palette.text, borderColor: palette.border}]}
        value={vm.amountText}
        onChangeText={vm.setAmountText}
        keyboardType="decimal-pad"
        accessibilityLabel="Amount"
      />

      <View style={styles.pairRow}>
        <CurrencyColumn
          label="From"
          selected={vm.from}
          onSelect={vm.setFrom}
          palette={palette}
        />
        <Pressable
          onPress={vm.swap}
          accessibilityRole="button"
          accessibilityLabel="Swap currencies"
          style={styles.swap}>
          <Text style={[styles.swapGlyph, {color: palette.accent}]}>⇄</Text>
        </Pressable>
        <CurrencyColumn
          label="To"
          selected={vm.to}
          onSelect={vm.setTo}
          palette={palette}
        />
      </View>

      <View style={styles.resultBlock}>
        {vm.loading && <ActivityIndicator />}
        {!vm.loading && vm.error && (
          <>
            <Text style={[styles.error, {color: palette.error}]}>{vm.error}</Text>
            <Pressable onPress={vm.refresh} accessibilityRole="button">
              <Text style={[styles.retry, {color: palette.accent}]}>Retry</Text>
            </Pressable>
          </>
        )}
        {!vm.loading && !vm.error && vm.formatted !== null && vm.snapshot && (
          <>
            <Text
              style={[styles.result, {color: palette.text}]}
              testID="converted-amount">
              {vm.formatted}
            </Text>
            {/* The provenance label is not decoration — it is the product's
                honesty rule. Every rate on screen says where it came from. */}
            <Text style={[styles.provenance, {color: palette.secondary}]}>
              {sourceLabel(vm.snapshot)}
            </Text>
            {vm.stale && (
              <Text style={[styles.stale, {color: palette.warning}]}>
                Offline — showing last good rates
              </Text>
            )}
          </>
        )}
      </View>
    </View>
  );
}

function CurrencyColumn(props: {
  label: string;
  selected: string;
  onSelect: (code: string) => void;
  palette: Palette;
}): React.JSX.Element {
  const {label, selected, onSelect, palette} = props;
  return (
    <View style={styles.column}>
      <Text style={[styles.columnLabel, {color: palette.secondary}]}>{label}</Text>
      {QUICK_PICKS.map(code => {
        const active = code === selected;
        return (
          <Pressable
            key={code}
            onPress={() => onSelect(code)}
            accessibilityRole="button"
            accessibilityState={{selected: active}}
            style={[styles.pick, active && {backgroundColor: palette.accent}]}>
            <Text style={{color: active ? palette.onAccent : palette.text}}>
              {code}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

interface Palette {
  background: string;
  text: string;
  secondary: string;
  border: string;
  accent: string;
  onAccent: string;
  error: string;
  warning: string;
}

const lightPalette: Palette = {
  background: '#FFFFFF',
  text: '#1A1A1A',
  secondary: '#6B7280',
  border: '#D1D5DB',
  accent: '#1F3A5F',
  onAccent: '#FFFFFF',
  error: '#B91C1C',
  warning: '#B45309',
};

const darkPalette: Palette = {
  background: '#111418',
  text: '#F3F4F6',
  secondary: '#9CA3AF',
  border: '#374151',
  accent: '#8AB4F8',
  onAccent: '#111418',
  error: '#F87171',
  warning: '#FBBF24',
};

const styles = StyleSheet.create({
  screen: {flex: 1, padding: 24, paddingTop: 72},
  title: {fontSize: 28, fontWeight: '700', marginBottom: 24},
  amount: {
    borderWidth: 1,
    borderRadius: 12,
    fontSize: 32,
    padding: 16,
    marginBottom: 24,
  },
  pairRow: {flexDirection: 'row', alignItems: 'center', gap: 12},
  column: {flex: 1, gap: 6},
  columnLabel: {fontSize: 13, textTransform: 'uppercase', marginBottom: 2},
  pick: {borderRadius: 8, paddingVertical: 8, paddingHorizontal: 12},
  swap: {padding: 8},
  swapGlyph: {fontSize: 24},
  resultBlock: {marginTop: 32, alignItems: 'center', gap: 8},
  result: {fontSize: 34, fontWeight: '600'},
  provenance: {fontSize: 13},
  stale: {fontSize: 13, fontWeight: '600'},
  error: {fontSize: 15, textAlign: 'center'},
  retry: {fontSize: 15, fontWeight: '600'},
});
