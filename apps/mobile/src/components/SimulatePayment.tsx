import React, { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { api } from '../api';
import type { Card as CardT, Transaction } from '../api/types';
import { CATEGORIES } from '../config';
import { errorMessage } from '../hooks/useResource';
import { isValidAmount, normaliseAmountInput } from '../lib/money';
import { colors, spacing } from '../theme';
import { Button } from './Button';
import { Chip } from './Chip';
import { ErrorBanner } from './ErrorState';
import { Field } from './Field';
import { Money } from './Money';
import { StatusBadge } from './StatusBadge';
import { Text } from './Text';

const newKey = () => `sw-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** Clearly-labelled simulation: POST /transactions/simulate against a simulated card. */
export function SimulatePayment({ card, onDone }: { card: CardT; onDone: () => void }) {
  const [amount, setAmount] = useState('');
  const [merchant, setMerchant] = useState('');
  const [category, setCategory] = useState<string>('Other');
  const [errors, setErrors] = useState<{ amount?: string; merchant?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Transaction | null>(null);
  const [busy, setBusy] = useState(false);
  // Reused across retries of the same attempt so a network retry can never double-charge; rotated after a response.
  const key = useRef(newKey());

  const run = async () => {
    const e: typeof errors = {};
    const amt = normaliseAmountInput(amount);
    if (!isValidAmount(amt)) e.amount = 'Enter a positive amount with at most 2 decimals.';
    if (merchant.trim().length < 2) e.merchant = 'Merchant must be at least 2 characters.';
    setErrors(e); setError(null); setResult(null);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      const tx = await api.transactions.simulate({ cardId: card.id, amount: amt, merchant: merchant.trim(), category }, key.current);
      key.current = newKey();
      setResult(tx);
      onDone();
    } catch (err) {
      setError(errorMessage(err));
      if (err instanceof Error && 'status' in err && (err as { status: number }).status !== 0) key.current = newKey();
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text variant="caption" color={colors.warning} weight="700">SIMULATION ONLY. NO REAL MONEY MOVES.</Text>
      <Field label={`Amount (${card.currency})`} value={amount} onChangeText={setAmount} error={errors.amount} keyboardType="decimal-pad" placeholder="0.00" />
      <Field label="Merchant" value={merchant} onChangeText={setMerchant} error={errors.merchant} maxLength={120} />
      <View style={styles.chips}>{CATEGORIES.map((c) => <Chip key={c} label={c} selected={c === category} onPress={() => setCategory(c)} />)}</View>
      <ErrorBanner message={error} />
      {result ? (
        <View style={styles.result} accessibilityRole="alert">
          <StatusBadge status={result.status} />
          <Money value={result.amount} currency={result.currency} />
          {result.status === 'DECLINED' && result.declineReason ? <Text variant="small" color={colors.danger}>Declined: {result.declineReason}</Text> : null}
          {result.flagged && result.flagReason ? <Text variant="small" color={colors.warning}>Flagged: {result.flagReason}</Text> : null}
        </View>
      ) : null}
      <Button label="Run simulated payment" variant="secondary" onPress={() => void run()} loading={busy} />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm, marginTop: spacing.sm },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  result: { gap: spacing.xxs },
});
