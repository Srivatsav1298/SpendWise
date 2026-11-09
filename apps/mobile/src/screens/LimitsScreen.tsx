import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../api';
import type { Card as CardT } from '../api/types';
import { Button, Card, EmptyState, ErrorBanner, ErrorState, Loading, Money, ProgressBar, Screen, StatusBadge, Text } from '../components';
import { SimulatePayment } from '../components/SimulatePayment';
import { errorMessage, useResource } from '../hooks/useResource';
import { ratio } from '../lib/money';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing } from '../theme';

function Row({ label, value, currency }: { label: string; value: string | null; currency?: string }) {
  return (
    <View style={styles.row}>
      <Text variant="small" muted>{label}</Text>
      <Money value={value} currency={currency} variant="small" />
    </View>
  );
}

function CardPanel({ card, onChanged }: { card: CardT; onChanged: () => void }) {
  const [showSim, setShowSim] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const used = ratio(card.spentThisMonth, card.monthlyLimit);

  const freeze = () => {
    Alert.alert('Freeze this card?', 'Payments will be declined until finance unfreezes it. You cannot unfreeze it yourself.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Freeze', style: 'destructive', onPress: async () => {
          setBusy(true); setError(null);
          try { await api.cards.freeze(card.id); onChanged(); } catch (e) { setError(errorMessage(e)); } finally { setBusy(false); }
        },
      },
    ]);
  };

  return (
    <Card>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text weight="600">{card.label ?? 'Card'}</Text>
          <Text variant="small" muted>{card.maskedNumber}</Text>
        </View>
        <StatusBadge status={card.status} />
      </View>
      {card.simulated ? <Text variant="caption" muted style={styles.sim}>SIMULATED CARD</Text> : null}
      <View style={styles.block}>
        <ProgressBar value={used} warn={used >= 0.9} />
        <Row label="Spent this month" value={card.spentThisMonth} currency={card.currency} />
        <Row label="Monthly limit" value={card.monthlyLimit} currency={card.currency} />
        <Row label="Daily limit" value={card.dailyLimit} currency={card.currency} />
        {card.blockedCategories.length > 0 ? <Text variant="small" muted>Blocked categories: {card.blockedCategories.join(', ')}</Text> : null}
      </View>
      <ErrorBanner message={error} />
      <View style={styles.actions}>
        {card.status === 'ACTIVE' ? <Button label="Freeze card" variant="danger" onPress={freeze} loading={busy} /> : null}
        {card.status === 'FROZEN' ? <Text variant="small" muted>This card is frozen. Contact finance to unfreeze it.</Text> : null}
        <Button label={showSim ? 'Hide simulation' : 'Simulate card payment'} variant="ghost" onPress={() => setShowSim((s) => !s)} />
      </View>
      {showSim ? <SimulatePayment card={card} onDone={onChanged} /> : null}
    </Card>
  );
}

export default function LimitsScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const limits = useResource(() => api.limits());
  const cards = useResource(() => api.cards.list());
  const loading = (limits.loading && !limits.data) || (cards.loading && !cards.data);
  const error = !limits.data && !cards.data ? limits.error ?? cards.error : null;
  const reloadAll = async () => { await Promise.all([limits.reload(), cards.reload()]); };
  const refreshAll = async () => { await Promise.all([limits.onRefresh(), cards.onRefresh()]); };
  const quiet = () => { void limits.onRefresh(); void cards.onRefresh(); };

  const l = limits.data;
  const used = l ? ratio(l.spentThisMonth, l.monthlyLimit) : 0;

  return (
    <Screen onRefresh={refreshAll} refreshing={limits.refreshing || cards.refreshing}>
      <Text variant="title">Limits and cards</Text>
      {loading ? <Loading /> : error ? <ErrorState message={error} onRetry={reloadAll} /> : (
        <>
          <Card>
            <Text variant="heading">Monthly spending limit</Text>
            {l?.monthlyLimit ? (
              <View style={styles.block}>
                <ProgressBar value={used} warn={used >= 0.9} />
                <Row label="Used (cards + expense claims)" value={l.spentThisMonth} />
                <Row label="Remaining" value={l.remaining} />
                <Row label="Limit" value={l.monthlyLimit} />
              </View>
            ) : <Text muted style={styles.sim}>No monthly limit is set for you.</Text>}
          </Card>

          <Text variant="heading">Your cards</Text>
          {cards.data && cards.data.length > 0
            ? cards.data.map((c) => <CardPanel key={c.id} card={c} onChanged={quiet} />)
            : <Card><EmptyState icon="card-outline" title="No cards" message="You have no cards assigned. Ask your finance team to issue one." /></Card>}
          <Button label="View card transactions" variant="secondary" onPress={() => nav.navigate('Transactions')} />
          {cards.error && cards.data ? <Text variant="small" color={colors.danger}>{cards.error}</Text> : null}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  flex: { flex: 1 },
  block: { gap: spacing.xs, marginTop: spacing.sm },
  sim: { marginTop: spacing.xs },
  actions: { marginTop: spacing.sm, gap: spacing.xs },
});
