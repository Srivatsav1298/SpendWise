import React from 'react';
import { ActivityIndicator, FlatList, StyleSheet, View } from 'react-native';
import { api } from '../api';
import type { Transaction } from '../api/types';
import { Button, Card, EmptyState, ErrorState, Loading, Money, Screen, StatusBadge, Text } from '../components';
import { usePaged } from '../hooks/usePaged';
import { formatDateTime } from '../lib/dates';
import { colors, spacing } from '../theme';

export function TransactionRow({ t }: { t: Transaction }) {
  return (
    <Card>
      <View style={styles.row}>
        <View style={styles.flex}>
          <Text weight="600">{t.merchant}</Text>
          <Text variant="small" muted>{t.category} · {formatDateTime(t.occurredAt)}</Text>
        </View>
        <Money value={t.amount} currency={t.currency} color={t.status === 'DECLINED' ? colors.textMuted : undefined} />
      </View>
      <View style={styles.badges}>
        {t.status === 'DECLINED' ? <StatusBadge status="DECLINED" /> : <StatusBadge status="APPROVED" />}
        {t.flagged ? <StatusBadge status="FLAGGED" /> : null}
        {t.simulated ? <Text variant="caption" muted>SIMULATED</Text> : null}
      </View>
      {t.status === 'DECLINED' && t.declineReason ? <Text variant="small" color={colors.danger} style={styles.reason}>Declined: {t.declineReason}</Text> : null}
      {t.flagged && t.flagReason ? <Text variant="small" color={colors.warning} style={styles.reason}>Flagged: {t.flagReason}</Text> : null}
    </Card>
  );
}

export default function TransactionsScreen() {
  const list = usePaged<Transaction>((page) => api.transactions.list(page), 'tx');
  return (
    <Screen scroll={false} padded={false} edges={['left', 'right']}>
      {list.loading && list.items.length === 0 ? <Loading /> : list.error && list.items.length === 0 ? (
        <ErrorState message={list.error} onRetry={list.reload} />
      ) : (
        <FlatList
          data={list.items}
          keyExtractor={(t) => t.id}
          contentContainerStyle={styles.list}
          refreshing={list.refreshing}
          onRefresh={list.onRefresh}
          onEndReached={() => void list.loadMore()}
          onEndReachedThreshold={0.4}
          ItemSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
          ListEmptyComponent={<EmptyState icon="card-outline" title="No transactions yet" message="Card payments will appear here." />}
          ListFooterComponent={<>{
            list.loadingMore ? <ActivityIndicator style={styles.footer} color={colors.accent} />
              : list.moreError ? <View style={styles.footer}><Text variant="small" color={colors.danger}>{list.moreError}</Text><Button label="Retry" variant="ghost" onPress={() => void list.loadMore()} /></View>
              : null
          }</>}
          renderItem={({ item }) => <TransactionRow t={item} />}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  list: { padding: spacing.md, flexGrow: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  flex: { flex: 1 },
  badges: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, marginTop: spacing.xs },
  reason: { marginTop: spacing.xxs },
  footer: { padding: spacing.md, alignItems: 'center' },
});
