import React from 'react';
import { StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../api';
import { useAuth } from '../auth/AuthContext';
import { Button, Card, EmptyState, ErrorState, Loading, Money, ProgressBar, Screen, StatusBadge, Text } from '../components';
import { useResource } from '../hooks/useResource';
import { formatDateTime } from '../lib/dates';
import { ratio } from '../lib/money';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing } from '../theme';

export default function HomeScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { me } = useAuth();
  const dash = useResource(() => api.dashboard());
  const limits = useResource(() => api.limits());

  const loading = (dash.loading && !dash.data) || (limits.loading && !limits.data);
  const error = !dash.data && !limits.data ? dash.error ?? limits.error : null;
  const refresh = async () => { await Promise.all([dash.onRefresh(), limits.onRefresh()]); };
  const retry = async () => { await Promise.all([dash.reload(), limits.reload()]); };

  const d = dash.data;
  const l = limits.data;
  const used = l ? ratio(l.spentThisMonth, l.monthlyLimit) : 0;

  return (
    <Screen onRefresh={refresh} refreshing={dash.refreshing || limits.refreshing}>
      <View>
        <Text muted>Hello{me ? `, ${me.firstName}` : ''}</Text>
        <Text variant="title">Your spending</Text>
      </View>
      <Button label="New expense" onPress={() => nav.navigate('ExpenseForm')} />

      {loading ? <Loading /> : error ? <ErrorState message={error} onRetry={retry} /> : (
        <>
          <Card>
            <Text variant="small" muted>Card spend this month</Text>
            <Money value={d?.monthSpend ?? l?.spentThisMonth ?? null} variant="display" />
          </Card>

          <Card>
            <Text variant="heading">Monthly limit</Text>
            {l?.monthlyLimit ? (
              <View style={styles.gap}>
                <ProgressBar value={used} warn={used >= 0.9} />
                <View style={styles.row}>
                  <Text variant="small" muted>Used (cards + expense claims)</Text>
                  <Money value={l.spentThisMonth} variant="small" />
                </View>
                <View style={styles.row}>
                  <Text variant="small" muted>Remaining</Text>
                  <Money value={l.remaining} variant="small" />
                </View>
                <View style={styles.row}>
                  <Text variant="small" muted>Limit</Text>
                  <Money value={l.monthlyLimit} variant="small" />
                </View>
              </View>
            ) : (
              <Text muted>No monthly limit is set for you.</Text>
            )}
          </Card>

          <Card>
            <View style={styles.row}>
              <View>
                <Text variant="small" muted>Awaiting approval</Text>
                <Text variant="title">{d?.pendingApprovals.count ?? 0}</Text>
              </View>
              <Money value={d?.pendingApprovals.amount ?? '0.00'} />
            </View>
          </Card>

          <View style={styles.row}>
            <Text variant="heading">Recent card transactions</Text>
            <Button label="See all" variant="ghost" onPress={() => nav.navigate('Transactions')} />
          </View>
          {d && d.recentTransactions.length > 0 ? (
            <Card style={styles.list}>
              {d.recentTransactions.slice(0, 5).map((t, i) => (
                <View key={t.id} style={[styles.txRow, i > 0 && styles.divider]}>
                  <View style={styles.flex}>
                    <Text weight="600">{t.merchant}</Text>
                    <Text variant="small" muted>{t.category} · {formatDateTime(t.occurredAt)}</Text>
                    {t.status !== 'APPROVED' ? <StatusBadge status={t.status} /> : null}
                  </View>
                  <Money value={t.amount} color={t.status === 'DECLINED' ? colors.textMuted : undefined} />
                </View>
              ))}
            </Card>
          ) : (
            <Card><EmptyState icon="card-outline" title="No transactions yet" message="Card payments will appear here." /></Card>
          )}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { gap: spacing.xs, marginTop: spacing.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  flex: { flex: 1, gap: 2, paddingRight: spacing.sm },
  list: { paddingVertical: 0 },
  txRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing.sm },
  divider: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.border },
});
