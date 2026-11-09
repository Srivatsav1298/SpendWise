import React, { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { Button, ErrorBanner, Field, Screen, Text } from '../components';
import { errorMessage } from '../hooks/useResource';
import { validateNewPassword } from '../lib/validation';
import type { RootStackParamList } from '../navigation/types';

export default function ChangePasswordScreen({ navigation }: NativeStackScreenProps<RootStackParamList, 'ChangePassword'>) {
  const { changePassword } = useAuth();
  const [current, setCurrent] = useState('');
  const [next, setNext] = useState('');
  const [confirm, setConfirm] = useState('');
  const [errors, setErrors] = useState<{ current?: string; next?: string; confirm?: string }>({});
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    const e: typeof errors = {};
    if (!current) e.current = 'Enter your current password.';
    const pw = validateNewPassword(next);
    if (pw) e.next = pw;
    else if (next === current) e.next = 'Choose a password different from the current one.';
    if (confirm !== next) e.confirm = 'Passwords do not match.';
    setErrors(e); setError(null);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await changePassword(current, next);
      setDone(true); setCurrent(''); setNext(''); setConfirm('');
    } catch (err) { setError(errorMessage(err)); } finally { setBusy(false); }
  };

  return (
    <Screen edges={['left', 'right']}>
      <Field label="Current password" value={current} onChangeText={setCurrent} error={errors.current} secureTextEntry autoComplete="current-password" />
      <Field label="New password" value={next} onChangeText={setNext} error={errors.next} secureTextEntry autoComplete="new-password" hint="At least 10 characters, with a letter and a digit." />
      <Field label="Confirm new password" value={confirm} onChangeText={setConfirm} error={errors.confirm} secureTextEntry autoComplete="new-password" />
      <ErrorBanner message={error} />
      {done ? <Text accessibilityRole="alert">Password changed. Other devices have been signed out.</Text> : null}
      {done ? <Button label="Done" onPress={() => navigation.goBack()} /> : <Button label="Update password" onPress={() => void submit()} loading={busy} />}
    </Screen>
  );
}
