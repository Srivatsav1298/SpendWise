import React, { useState } from 'react';
import { ActivityIndicator, FlatList, ScrollView, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { api } from '../api';
import type { Expense, ExpenseStatus } from '../api/types';
import { Button, Card, Chip, EmptyState, ErrorState, Loading, Money, Screen, StatusBadge, Text } from '../components';
import { usePaged } from '../hooks/usePaged';
import { formatDateOnly } from '../lib/dates';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing } from '../theme';

const FILTERS: { label: string; value: ExpenseStatus | undefined }[] = [
  { label: 'All', value: undefined },
  { label: 'Draft', value: 'DRAFT' },
  { label: 'Submitted', value: 'SUBMITTED' },
  { label: 'Approved', value: 'APPROVED' },
  { label: 'Rejected', value: 'REJECTED' },
  { label: 'Reimbursed', value: 'REIMBURSED' },
];

export default function ExpensesScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const [status, setStatus] = useState<ExpenseStatus | undefined>(undefined);
  const list = usePaged<Expense>((page) => api.expenses.list(page, status), status ?? 'ALL');

  return (
    <Screen scroll={false} padded={false}>
      <View style={styles.header}>
        <Text variant="title">Expenses</Text>
        <Button label="New" onPress={() => nav.navigate('ExpenseForm')} style={styles.newBtn} />
      </View>
      <View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {FILTERS.map((f) => <Chip key={f.label} label={f.label} selected={f.value === status} onPress={() => setStatus(f.value)} />)}
        </ScrollView>
      </View>

      {list.loading && list.items.length === 0 ? <Loading /> : list.error && list.items.length === 0 ? (
        <ErrorState message={list.error} onRetry={list.reload} />
      ) : (
        <FlatList
          data={list.items}
          keyExtractor={(e) => e.id}
          contentContainerStyle={styles.list}
          refreshing={list.refreshing}
          onRefresh={list.onRefresh}
          onEndReached={() => void list.loadMore()}
          onEndReachedThreshold={0.4}
          ItemSeparatorComponent={() => <View style={{ height: spacing.xs }} />}
          ListEmptyComponent={
            <EmptyState
              icon="receipt-outline"
              title={status ? `No ${status.toLowerCase()} expenses` : 'No expenses yet'}
              message="Create an expense and attach a receipt to get reimbursed."
              actionLabel="New expense"
              onAction={() => nav.navigate('ExpenseForm')}
            />
          }
          ListFooterComponent={<>{
            list.loadingMore ? <ActivityIndicator style={styles.footer} color={colors.accent} />
              : list.moreError ? <View style={styles.footer}><Text variant="small" color={colors.danger}>{list.moreError}</Text><Button label="Retry" variant="ghost" onPress={() => void list.loadMore()} /></View>
              : null
          }</>}
          renderItem={({ item }) => (
            <Card onPress={() => nav.navigate('ExpenseDetail', { id: item.id })} accessibilityLabel={`${item.merchant}, ${item.status}`}>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <Text weight="600">{item.merchant}</Text>
                  <Text variant="small" muted>{item.category} · {formatDateOnly(item.expenseDate)}</Text>
                </View>
                <Money value={item.amount} currency={item.currency} />
              </View>
              <View style={styles.badgeRow}><StatusBadge status={item.status} /></View>
            </Card>
          )}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: spacing.md },
  newBtn: { minHeight: 40, paddingHorizontal: spacing.md },
  chips: { paddingHorizontal: spacing.md, gap: spacing.xs, paddingBottom: spacing.sm },
  list: { padding: spacing.md, paddingTop: spacing.xs, flexGrow: 1 },
  row: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.sm },
  flex: { flex: 1 },
  badgeRow: { marginTop: spacing.xs },
  footer: { padding: spacing.md, alignItems: 'center' },
});
