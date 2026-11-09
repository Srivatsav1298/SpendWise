import React, { useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api';
import type { ApprovalEntry } from '../api/types';
import { Button, Card, ErrorBanner, ErrorState, Loading, Money, Screen, StatusBadge, Text } from '../components';
import { ReceiptThumb } from '../components/ReceiptThumb';
import { errorMessage, useResource } from '../hooks/useResource';
import { formatDateOnly, formatDateTime } from '../lib/dates';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing } from '../theme';

const DECISION_LABEL: Record<string, string> = { APPROVED: 'Approved', REJECTED: 'Rejected', REIMBURSED: 'Reimbursed' };

function Timeline({ items }: { items: ApprovalEntry[] }) {
  return (
    <View style={styles.timeline}>
      {items.map((a) => {
        const rejected = a.decision === 'REJECTED';
        return (
          <View key={a.id} style={styles.tlRow}>
            <View style={[styles.dot, { backgroundColor: rejected ? colors.danger : colors.accent }]} />
            <View style={styles.flex}>
              <Text weight="600" color={rejected ? colors.danger : colors.text}>{DECISION_LABEL[a.decision] ?? a.decision}</Text>
              <Text variant="small" muted>{formatDateTime(a.createdAt)}</Text>
              {a.comment ? <Text variant="small" style={styles.comment}>{rejected ? 'Reason: ' : 'Comment: '}{a.comment}</Text> : null}
            </View>
          </View>
        );
      })}
    </View>
  );
}

export default function ExpenseDetailScreen({ route, navigation }: NativeStackScreenProps<RootStackParamList, 'ExpenseDetail'>) {
  const { id } = route.params;
  const res = useResource(() => api.expenses.get(id));
  const [busy, setBusy] = useState<'submit' | 'delete' | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);

  if (res.loading && !res.data) return <Screen edges={['left', 'right']}><Loading /></Screen>;
  if (!res.data) return <Screen edges={['left', 'right']}><ErrorState message={res.error ?? 'Expense not found'} onRetry={res.reload} /></Screen>;

  const e = res.data;
  const lastRejection = [...e.approvals].reverse().find((a) => a.decision === 'REJECTED');

  const submit = async () => {
    setBusy('submit'); setActionError(null);
    try { await api.expenses.submit(id); await res.reload(); } catch (err) { setActionError(errorMessage(err)); } finally { setBusy(null); }
  };
  const remove = () => {
    Alert.alert('Delete draft?', 'This cannot be undone.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive', onPress: async () => {
          setBusy('delete'); setActionError(null);
          try { await api.expenses.remove(id); navigation.goBack(); } catch (err) { setActionError(errorMessage(err)); setBusy(null); }
        },
      },
    ]);
  };

  return (
    <Screen edges={['left', 'right']} onRefresh={res.onRefresh} refreshing={res.refreshing}>
      <Card>
        <View style={styles.between}>
          <StatusBadge status={e.status} />
          <Text variant="small" muted>{formatDateOnly(e.expenseDate)}</Text>
        </View>
        <Text variant="title" style={styles.merchant}>{e.merchant}</Text>
        <Money value={e.amount} currency={e.currency} variant="display" />
        <View style={styles.meta}>
          <Text variant="small" muted>Category</Text><Text>{e.category}</Text>
          {e.description ? (<><Text variant="small" muted style={styles.gapTop}>Description</Text><Text>{e.description}</Text></>) : null}
          {e.submittedAt ? (<><Text variant="small" muted style={styles.gapTop}>Submitted</Text><Text>{formatDateTime(e.submittedAt)}</Text></>) : null}
        </View>
      </Card>

      {e.status === 'REJECTED' && lastRejection ? (
        <View style={styles.rejection} accessibilityRole="alert">
          <Text weight="700" color={colors.danger}>Rejected</Text>
          <Text color={colors.danger}>{lastRejection.comment ?? 'No reason was given.'}</Text>
        </View>
      ) : null}

      <Card>
        <Text variant="heading">Receipts</Text>
        {e.receipts.length === 0 ? <Text muted style={styles.gapTop}>No receipts attached.</Text> : (
          <View style={styles.thumbs}>{e.receipts.map((r) => <View key={r.id} style={styles.thumbCol}><ReceiptThumb receipt={r} /></View>)}</View>
        )}
      </Card>

      <Card>
        <Text variant="heading">Approval history</Text>
        {e.approvals.length === 0
          ? <Text muted style={styles.gapTop}>{e.status === 'SUBMITTED' ? 'Waiting for a reviewer.' : 'No decisions yet.'}</Text>
          : <Timeline items={e.approvals} />}
      </Card>

      <ErrorBanner message={actionError} />
      {e.status === 'DRAFT' ? (
        <>
          <Button label="Submit for approval" onPress={() => void submit()} loading={busy === 'submit'} disabled={busy !== null} />
          <Button label="Edit" variant="secondary" onPress={() => navigation.navigate('ExpenseForm', { id })} disabled={busy !== null} />
          <Button label="Delete draft" variant="danger" onPress={remove} loading={busy === 'delete'} disabled={busy !== null} />
        </>
      ) : null}
      {e.status === 'REJECTED' ? <Button label="Edit and resubmit" onPress={() => navigation.navigate('ExpenseForm', { id })} /> : null}
    </Screen>
  );
}

const styles = StyleSheet.create({
  between: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  merchant: { marginTop: spacing.sm },
  meta: { marginTop: spacing.sm },
  gapTop: { marginTop: spacing.xs },
  flex: { flex: 1 },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: spacing.sm },
  thumbCol: { gap: 4 },
  timeline: { marginTop: spacing.sm, gap: spacing.md },
  tlRow: { flexDirection: 'row', gap: spacing.sm },
  dot: { width: 10, height: 10, borderRadius: 5, marginTop: 7 },
  comment: { marginTop: 4 },
  rejection: { backgroundColor: colors.dangerSoft, borderRadius: 12, padding: spacing.md, gap: 4 },
});
