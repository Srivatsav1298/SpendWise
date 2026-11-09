import React, { useEffect, useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api';
import type { Expense } from '../api/types';
import { useAuth } from '../auth/AuthContext';
import { Button, Chip, ErrorBanner, ErrorState, Field, Loading, Screen, Text } from '../components';
import { ReceiptPicker, type PendingReceipt } from '../components/ReceiptPicker';
import { CATEGORIES } from '../config';
import { errorMessage } from '../hooks/useResource';
import { daysAgoISO, todayISO } from '../lib/dates';
import { toExpensePayload, validateExpenseForm, type ExpenseFormErrors, type ExpenseFormValues } from '../lib/validation';
import type { RootStackParamList } from '../navigation/types';
import { colors, spacing } from '../theme';

type Props = NativeStackScreenProps<RootStackParamList, 'ExpenseForm'>;
const MAX_RECEIPTS = 5;

export default function ExpenseFormScreen({ route, navigation }: Props) {
  const editId = route.params?.id;
  const { currency } = useAuth();
  const [values, setValues] = useState<ExpenseFormValues>({ amount: '', expenseDate: todayISO(), category: '', merchant: '', description: '' });
  const [errors, setErrors] = useState<ExpenseFormErrors>({});
  const [pending, setPending] = useState<PendingReceipt[]>([]);
  const [existing, setExisting] = useState<Expense['receipts']>([]);
  const [draftId, setDraftId] = useState<string | undefined>(editId);
  const [loading, setLoading] = useState(!!editId);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'draft' | 'submit' | null>(null);
  const [loadTick, setLoadTick] = useState(0);
  const [wasRejected, setWasRejected] = useState(false);

  useEffect(() => {
    if (!editId) return;
    let cancelled = false;
    setLoading(true); setLoadError(null);
    api.expenses.get(editId).then((e) => {
      if (cancelled) return;
      if (e.status !== 'DRAFT' && e.status !== 'REJECTED') { setLoadError(`A ${e.status.toLowerCase()} expense can no longer be edited.`); return; }
      setValues({ amount: e.amount, expenseDate: e.expenseDate.slice(0, 10), category: e.category, merchant: e.merchant, description: e.description ?? '' });
      setExisting(e.receipts);
      setWasRejected(e.status === 'REJECTED');
    }).catch((err) => { if (!cancelled) setLoadError(errorMessage(err)); })
      .finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [editId, loadTick]);

  const categories = useMemo<string[]>(
    () => (values.category && !(CATEGORIES as readonly string[]).includes(values.category) ? [...CATEGORIES, values.category] : [...CATEGORIES]),
    [values.category],
  );
  const set = <K extends keyof ExpenseFormValues>(k: K, v: ExpenseFormValues[K]) => setValues((p) => ({ ...p, [k]: v }));

  const persist = async (submitAfter: boolean) => {
    const errs = validateExpenseForm(values, todayISO(), categories);
    setErrors(errs);
    setServerError(null);
    if (Object.keys(errs).length) return;
    setBusy(submitAfter ? 'submit' : 'draft');
    let id = draftId;
    try {
      if (!id) {
        const created = await api.expenses.create({ ...toExpensePayload(values), currency, submit: false });
        id = created.id;
        setDraftId(id);
      } else {
        await api.expenses.update(id, toExpensePayload(values, true));
      }
      let queue = pending;
      for (const r of pending) {
        try {
          await api.expenses.uploadReceipt(id, r);
        } catch (e) {
          throw new Error(`Receipt "${r.name}" could not be uploaded: ${errorMessage(e)}`);
        }
        queue = queue.filter((q) => q.uri !== r.uri);
        setPending(queue);
      }
      if (submitAfter) await api.expenses.submit(id);
      if (editId) navigation.goBack(); else navigation.replace('ExpenseDetail', { id });
    } catch (e) {
      const saved = id && !editId ? 'Saved as a draft. ' : id ? 'Changes saved as a draft. ' : '';
      setServerError(`${saved}${errorMessage(e)}`);
    } finally {
      setBusy(null);
    }
  };

  if (loading) return <Screen edges={['left', 'right']}><Loading /></Screen>;
  if (loadError) return <Screen edges={['left', 'right']}><ErrorState message={loadError} onRetry={() => setLoadTick((t) => t + 1)} /></Screen>;

  const quickDates: [string, string][] = [['Today', todayISO()], ['Yesterday', daysAgoISO(1)]];

  return (
    <Screen edges={['left', 'right']}>
      {wasRejected ? <Text muted>This expense was rejected. Update it and resubmit for another review.</Text> : null}
      <Field
        label={`Amount (${currency})`} value={values.amount} onChangeText={(v) => set('amount', v)} error={errors.amount}
        keyboardType="decimal-pad" placeholder="0.00"
      />
      <View style={styles.gap}>
        <Field label="Date" value={values.expenseDate} onChangeText={(v) => set('expenseDate', v)} error={errors.expenseDate} placeholder="YYYY-MM-DD" autoCapitalize="none" autoCorrect={false} keyboardType="numbers-and-punctuation" maxLength={10} />
        <View style={styles.chips}>
          {quickDates.map(([label, iso]) => <Chip key={label} label={label} selected={values.expenseDate === iso} onPress={() => set('expenseDate', iso)} />)}
        </View>
      </View>
      <View style={styles.gap}>
        <Text variant="small" weight="600">Category</Text>
        <View style={styles.chips}>
          {categories.map((c) => <Chip key={c} label={c} selected={values.category === c} onPress={() => set('category', c)} />)}
        </View>
        {errors.category ? <Text variant="small" color={colors.danger} accessibilityRole="alert">{errors.category}</Text> : null}
      </View>
      <Field label="Merchant" value={values.merchant} onChangeText={(v) => set('merchant', v)} error={errors.merchant} maxLength={120} />
      <Field label="Description (optional)" value={values.description} onChangeText={(v) => set('description', v)} error={errors.description} multiline maxLength={1000} />

      <View style={styles.gap}>
        <Text variant="heading">Receipts</Text>
        <Text variant="small" muted>
          Larger expenses (over 500.00 by default) need a receipt before they can be submitted. JPEG, PNG or WebP, up to 5 MB each.
          {existing.length > 0 ? ` ${existing.length} already attached.` : ''}
        </Text>
        <ReceiptPicker
          pending={pending}
          maxMore={MAX_RECEIPTS - existing.length}
          onAdd={(r) => setPending((p) => [...p, r])}
          onRemove={(uri) => setPending((p) => p.filter((x) => x.uri !== uri))}
        />
      </View>

      <ErrorBanner message={serverError} />
      <Button label={wasRejected || editId ? 'Save as draft' : 'Save draft'} variant="secondary" onPress={() => void persist(false)} loading={busy === 'draft'} disabled={busy !== null} />
      <Button label={wasRejected ? 'Save and resubmit' : 'Submit for approval'} onPress={() => void persist(true)} loading={busy === 'submit'} disabled={busy !== null} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  gap: { gap: spacing.xs },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
});
