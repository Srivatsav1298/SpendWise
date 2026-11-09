import React, { useState } from 'react';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { api } from '../api';
import { Button, ErrorBanner, Field, Screen, Text } from '../components';
import { errorMessage } from '../hooks/useResource';
import { isEmail } from '../lib/validation';
import type { AuthStackParamList } from '../navigation/types';

export default function ForgotPasswordScreen({ route, navigation }: NativeStackScreenProps<AuthStackParamList, 'ForgotPassword'>) {
  const [email, setEmail] = useState(route.params?.email ?? '');
  const [error, setError] = useState<string | null>(null);
  const [fieldError, setFieldError] = useState<string | undefined>();
  const [sent, setSent] = useState(false);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (!isEmail(email)) { setFieldError('Enter a valid email address.'); return; }
    setFieldError(undefined);
    setBusy(true);
    try {
      await api.auth.forgotPassword(email);
      setSent(true);
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <Screen edges={['left', 'right']}>
      <Text muted>Enter your work email. If an account exists, we will send reset instructions.</Text>
      <Field label="Email" value={email} onChangeText={setEmail} error={fieldError} autoCapitalize="none" autoCorrect={false} keyboardType="email-address" autoComplete="email" returnKeyType="send" onSubmitEditing={submit} />
      <ErrorBanner message={error} />
      {sent ? <Text accessibilityRole="alert">If that address belongs to an account, reset instructions are on their way.</Text> : null}
      <Button label="Send reset instructions" onPress={submit} loading={busy} />
      <Button label="Back to sign in" variant="ghost" onPress={() => navigation.goBack()} />
    </Screen>
  );
}
