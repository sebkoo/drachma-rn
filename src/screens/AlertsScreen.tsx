/**
 * Rate alerts — the write surface. The engine (offline queue, idempotency,
 * optimistic projection) lives in src/alerts; this screen is a thin view over
 * the useAlerts ViewModel: add an alert, see it appear instantly with a
 * pending badge, watch it settle to synced, retry the ones that failed.
 */
import React, {useState} from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  useColorScheme,
} from 'react-native';
import {ProjectedAlert} from '../alerts/projection';
import {Direction} from '../alerts/types';
import {useAlerts} from '../alerts/useAlerts';

const CURRENCIES = ['USD', 'EUR', 'KRW', 'JPY', 'GBP', 'VND'] as const;

export default function AlertsScreen(): React.JSX.Element {
  const dark = useColorScheme() === 'dark';
  const palette = dark ? darkPalette : lightPalette;
  const vm = useAlerts();

  const [from, setFrom] = useState('USD');
  const [to, setTo] = useState('KRW');
  const [thresholdText, setThresholdText] = useState('1400');
  const [direction, setDirection] = useState<Direction>('above');

  const threshold = Number(thresholdText);
  const canAdd = from !== to && Number.isFinite(threshold) && threshold > 0;

  const add = () => {
    if (!canAdd) {
      return;
    }
    vm.create({from, to, threshold, direction});
  };

  return (
    <View style={[styles.screen, {backgroundColor: palette.background}]}>
      <View style={[styles.form, {borderColor: palette.border}]}>
        <View style={styles.pairRow}>
          <Picker label="From" value={from} onChange={setFrom} palette={palette} />
          <Picker label="To" value={to} onChange={setTo} palette={palette} />
        </View>

        <View style={styles.directionRow}>
          {(['above', 'below'] as const).map(option => {
            const active = direction === option;
            return (
              <Pressable
                key={option}
                onPress={() => setDirection(option)}
                accessibilityRole="button"
                accessibilityState={{selected: active}}
                style={[
                  styles.direction,
                  {borderColor: palette.border},
                  active && {backgroundColor: palette.accent},
                ]}>
                <Text style={{color: active ? palette.onAccent : palette.text}}>
                  {option === 'above' ? 'Rises above' : 'Falls below'}
                </Text>
              </Pressable>
            );
          })}
          <TextInput
            style={[styles.threshold, {color: palette.text, borderColor: palette.border}]}
            value={thresholdText}
            onChangeText={setThresholdText}
            keyboardType="decimal-pad"
            accessibilityLabel="Threshold"
          />
        </View>

        <Pressable
          onPress={add}
          disabled={!canAdd}
          accessibilityRole="button"
          testID="add-alert"
          style={[
            styles.add,
            {backgroundColor: canAdd ? palette.accent : palette.border},
          ]}>
          <Text style={[styles.addLabel, {color: palette.onAccent}]}>Add alert</Text>
        </Pressable>
      </View>

      {vm.hasUnsynced && (
        <Pressable onPress={vm.sync} accessibilityRole="button" style={styles.syncRow}>
          <Text style={[styles.syncText, {color: palette.secondary}]}>
            Syncing changes… tap to retry now
          </Text>
        </Pressable>
      )}

      <FlatList
        data={vm.alerts}
        keyExtractor={item => item.id}
        contentContainerStyle={styles.list}
        ListEmptyComponent={
          <Text style={[styles.empty, {color: palette.secondary}]}>
            No alerts yet. Add one above — it appears instantly, even offline.
          </Text>
        }
        renderItem={({item}) => (
          <AlertRow item={item} palette={palette} vm={vm} />
        )}
      />
    </View>
  );
}

function AlertRow(props: {
  item: ProjectedAlert;
  palette: Palette;
  vm: ReturnType<typeof useAlerts>;
}): React.JSX.Element {
  const {item, palette, vm} = props;
  const status = item.failed ? 'Failed' : item.pending ? 'Pending' : 'Synced';
  const statusColor = item.failed
    ? palette.error
    : item.pending
      ? palette.warning
      : palette.secondary;
  return (
    <View style={[styles.row, {borderColor: palette.border}]}>
      <View style={styles.rowMain}>
        <Text style={[styles.rowPair, {color: palette.text}]}>
          {item.from}/{item.to}
        </Text>
        <Text style={[styles.rowRule, {color: palette.secondary}]}>
          {item.direction === 'above' ? 'rises above' : 'falls below'} {item.threshold}
        </Text>
      </View>
      <Text style={[styles.status, {color: statusColor}]} accessibilityLabel={`Status ${status}`}>
        {status}
      </Text>
      {item.failed && item.opKey && (
        <Pressable
          onPress={() => vm.retry(item.opKey as string)}
          accessibilityRole="button"
          style={styles.rowAction}>
          <Text style={{color: palette.accent}}>Retry</Text>
        </Pressable>
      )}
      <Pressable
        onPress={() => vm.remove(item.id)}
        accessibilityRole="button"
        accessibilityLabel="Delete alert"
        style={styles.rowAction}>
        <Text style={{color: palette.error}}>Delete</Text>
      </Pressable>
    </View>
  );
}

function Picker(props: {
  label: string;
  value: string;
  onChange: (code: string) => void;
  palette: Palette;
}): React.JSX.Element {
  const {label, value, onChange, palette} = props;
  return (
    <View style={styles.picker}>
      <Text style={[styles.pickerLabel, {color: palette.secondary}]}>{label}</Text>
      <View style={styles.pickerRow}>
        {CURRENCIES.map(code => {
          const active = code === value;
          return (
            <Pressable
              key={code}
              onPress={() => onChange(code)}
              accessibilityRole="button"
              accessibilityState={{selected: active}}
              style={[styles.chip, active && {backgroundColor: palette.accent}]}>
              <Text
                style={[styles.chipText, {color: active ? palette.onAccent : palette.text}]}>
                {code}
              </Text>
            </Pressable>
          );
        })}
      </View>
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
  screen: {flex: 1, padding: 20, paddingTop: 16},
  form: {borderWidth: 1, borderRadius: 12, padding: 16, gap: 12},
  pairRow: {flexDirection: 'row', gap: 12},
  picker: {flex: 1, gap: 6},
  pickerLabel: {fontSize: 12, textTransform: 'uppercase'},
  pickerRow: {flexDirection: 'row', flexWrap: 'wrap', gap: 6},
  chip: {borderRadius: 8, paddingVertical: 6, paddingHorizontal: 10},
  chipText: {fontSize: 13},
  addLabel: {fontWeight: '600'},
  directionRow: {flexDirection: 'row', alignItems: 'center', gap: 8},
  direction: {borderWidth: 1, borderRadius: 8, paddingVertical: 8, paddingHorizontal: 10},
  threshold: {flex: 1, borderWidth: 1, borderRadius: 8, padding: 8, fontSize: 16},
  add: {borderRadius: 10, paddingVertical: 12, alignItems: 'center'},
  syncRow: {paddingVertical: 10},
  syncText: {fontSize: 13, fontStyle: 'italic'},
  list: {paddingTop: 8, gap: 8},
  empty: {textAlign: 'center', paddingTop: 32, fontSize: 14, lineHeight: 20},
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderRadius: 10,
    padding: 12,
    gap: 10,
  },
  rowMain: {flex: 1},
  rowPair: {fontSize: 16, fontWeight: '600'},
  rowRule: {fontSize: 13, marginTop: 2},
  status: {fontSize: 12, fontWeight: '600'},
  rowAction: {paddingHorizontal: 4, paddingVertical: 4},
});
