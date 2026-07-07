/**
 * The converter — Drachma's core loop, in React Native. Same rules as the
 * native iOS app: live keyless rates, and the data's provenance is always
 * on screen (ECB reference vs community/indicative).
 */
import React, {useCallback, useEffect, useMemo, useState} from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import {RatesSnapshot, convert, latestRates, sourceLabel} from '../api/rates';

const QUICK_PICKS = ['USD', 'EUR', 'KRW', 'JPY', 'GBP', 'VND'] as const;

export default function ConverterScreen(): React.JSX.Element {
  const dark = useColorScheme() === 'dark';
  const [amountText, setAmountText] = useState('100');
  const [from, setFrom] = useState('USD');
  const [to, setTo] = useState('KRW');
  const [snapshot, setSnapshot] = useState<RatesSnapshot | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setSnapshot(await latestRates(from, to));
    } catch {
      setError('Could not load rates — check your connection and retry.');
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const amount = Number(amountText.replace(',', '.'));
  const result = useMemo(() => {
    if (!snapshot || !Number.isFinite(amount)) {
      return null;
    }
    try {
      return convert(snapshot, amount, from, to);
    } catch {
      return null;
    }
  }, [snapshot, amount, from, to]);

  const swap = () => {
    setFrom(to);
    setTo(from);
  };

  const palette = dark ? darkPalette : lightPalette;

  return (
    <View style={[styles.screen, {backgroundColor: palette.background}]}>
      <Text style={[styles.title, {color: palette.text}]}>Drachma</Text>

      <TextInput
        style={[styles.amount, {color: palette.text, borderColor: palette.border}]}
        value={amountText}
        onChangeText={setAmountText}
        keyboardType="decimal-pad"
        accessibilityLabel="Amount"
      />

      <View style={styles.pairRow}>
        <CurrencyColumn
          label="From"
          selected={from}
          onSelect={setFrom}
          palette={palette}
        />
        <Pressable
          onPress={swap}
          accessibilityRole="button"
          accessibilityLabel="Swap currencies"
          style={styles.swap}>
          <Text style={[styles.swapGlyph, {color: palette.accent}]}>⇄</Text>
        </Pressable>
        <CurrencyColumn label="To" selected={to} onSelect={setTo} palette={palette} />
      </View>

      <View style={styles.resultBlock}>
        {loading && <ActivityIndicator />}
        {!loading && error && (
          <>
            <Text style={[styles.error, {color: palette.error}]}>{error}</Text>
            <Pressable onPress={refresh} accessibilityRole="button">
              <Text style={[styles.retry, {color: palette.accent}]}>Retry</Text>
            </Pressable>
          </>
        )}
        {!loading && !error && result !== null && snapshot && (
          <>
            <Text
              style={[styles.result, {color: palette.text}]}
              testID="converted-amount">
              {result.toLocaleString(undefined, {maximumFractionDigits: 2})} {to}
            </Text>
            {/* The provenance label is not decoration — it is the product's
                honesty rule. Every rate on screen says where it came from. */}
            <Text style={[styles.provenance, {color: palette.secondary}]}>
              {sourceLabel(snapshot)}
            </Text>
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
            style={[
              styles.pick,
              active && {backgroundColor: palette.accent},
            ]}>
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
}

const lightPalette: Palette = {
  background: '#FFFFFF',
  text: '#1A1A1A',
  secondary: '#6B7280',
  border: '#D1D5DB',
  accent: '#1F3A5F',
  onAccent: '#FFFFFF',
  error: '#B91C1C',
};

const darkPalette: Palette = {
  background: '#111418',
  text: '#F3F4F6',
  secondary: '#9CA3AF',
  border: '#374151',
  accent: '#8AB4F8',
  onAccent: '#111418',
  error: '#F87171',
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
  error: {fontSize: 15, textAlign: 'center'},
  retry: {fontSize: 15, fontWeight: '600'},
});
