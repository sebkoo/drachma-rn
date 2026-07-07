/**
 * The converter's ViewModel — a custom hook, which is MVVM's natural shape in
 * React Native: all state and behavior live here (testable with a fake
 * provider); the screen renders it and nothing else.
 */
import {useCallback, useEffect, useMemo, useState} from 'react';
import {RatesSnapshot, convert} from '../api/rates';
import {useRatesProvider} from '../di/RatesContext';

export interface ConverterState {
  amountText: string;
  setAmountText: (text: string) => void;
  from: string;
  to: string;
  setFrom: (code: string) => void;
  setTo: (code: string) => void;
  swap: () => void;
  refresh: () => void;
  snapshot: RatesSnapshot | null;
  /** True when showing the offline last-good snapshot. */
  stale: boolean;
  loading: boolean;
  error: string | null;
  result: number | null;
}

export function useConverter(): ConverterState {
  const provider = useRatesProvider();
  const [amountText, setAmountText] = useState('100');
  const [from, setFrom] = useState('USD');
  const [to, setTo] = useState('KRW');
  const [snapshot, setSnapshot] = useState<RatesSnapshot | null>(null);
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const outcome = await provider.latest(from, to);
      setSnapshot(outcome.snapshot);
      setStale(outcome.stale);
    } catch {
      setError('Could not load rates — check your connection and retry.');
    } finally {
      setLoading(false);
    }
  }, [provider, from, to]);

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

  const swap = useCallback(() => {
    setFrom(to);
    setTo(from);
  }, [from, to]);

  return {
    amountText, setAmountText,
    from, to, setFrom, setTo,
    swap, refresh,
    snapshot, stale, loading, error, result,
  };
}
