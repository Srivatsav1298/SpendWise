import React, { useEffect, useState } from 'react';
import { Alert, StyleSheet, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { Button, Card, ErrorBanner, Field, Screen, Text } from '../components';
import { errorMessage } from '../hooks/useResource';
import type { RootStackParamList } from '../navigation/types';
import { spacing } from '../theme';

const ROLE_LABEL: Record<string, string> = { EMPLOYEE: 'Employee', MANAGER: 'Manager', FINANCE_MANAGER: 'Finance manager', ORG_ADMIN: 'Organisation admin' };

export default function ProfileScreen() {
  const nav = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { me, updateName, signOut, reloadMe } = useAuth();
  const [first, setFirst] = useState(me?.firstName ?? '');
  const [last, setLast] = useState(me?.lastName ?? '');
  const [errors, setErrors] = useState<{ first?: string; last?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => { if (me) { setFirst(me.firstName); setLast(me.lastName); } }, [me]);
  if (!me) return null;

  const dirty = first.trim() !== me.firstName || last.trim() !== me.lastName;

  const save = async () => {
    const e: typeof errors = {};
    if (!first.trim()) e.first = 'First name is required.'; else if (first.trim().length > 80) e.first = 'At most 80 characters.';
    if (!last.trim()) e.last = 'Last name is required.'; else if (last.trim().length > 80) e.last = 'At most 80 characters.';
    setErrors(e); setError(null); setSaved(false);
    if (Object.keys(e).length) return;
    setBusy(true);
    try { await updateName(first.trim(), last.trim()); setSaved(true); } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };

  const confirmSignOut = () => Alert.alert('Sign out?', undefined, [
    { text: 'Cancel', style: 'cancel' },
    { text: 'Sign out', style: 'destructive', onPress: () => void signOut() },
  ]);

  const refresh = async () => { setRefreshing(true); try { await reloadMe(); } catch { /* keep cached profile */ } finally { setRefreshing(false); } };

  return (
    <Screen onRefresh={refresh} refreshing={refreshing}>
      <Text variant="title">Profile</Text>
      <Card>
        <Text variant="small" muted>Organisation</Text>
        <Text weight="600">{me.organisation?.name ?? '–'}</Text>
        <Text variant="small" muted style={styles.gap}>Role</Text>
        <Text weight="600">{ROLE_LABEL[me.role] ?? me.role}</Text>
        <Text variant="small" muted style={styles.gap}>Email</Text>
        <Text weight="600">{me.email}</Text>
        <Text variant="small" muted style={styles.gap}>Currency</Text>
        <Text weight="600">{me.organisation?.baseCurrency ?? '–'}</Text>
      </Card>

      <Card>
        <View style={styles.form}>
          <Text variant="heading">Your name</Text>
          <Field label="First name" value={first} onChangeText={(v) => { setFirst(v); setSaved(false); }} error={errors.first} autoCapitalize="words" maxLength={80} />
          <Field label="Last name" value={last} onChangeText={(v) => { setLast(v); setSaved(false); }} error={errors.last} autoCapitalize="words" maxLength={80} />
          <ErrorBanner message={error} />
          {saved ? <Text variant="small" accessibilityRole="alert">Name updated.</Text> : null}
          <Button label="Save name" onPress={() => void save()} loading={busy} disabled={!dirty} />
        </View>
      </Card>

      <Button label="Change password" variant="secondary" onPress={() => nav.navigate('ChangePassword')} />
      <Button label="Sign out" variant="danger" onPress={confirmSignOut} />
    </Screen>
  );
}

const styles = StyleSheet.create({ gap: { marginTop: spacing.xs }, form: { gap: spacing.sm } });
