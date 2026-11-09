import React, { useRef, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../auth/AuthContext';
import { Button, ErrorBanner, Field, Screen, Text } from '../components';
import { errorMessage } from '../hooks/useResource';
import { isEmail } from '../lib/validation';
import type { AuthStackParamList } from '../navigation/types';
import { colors, spacing } from '../theme';

export default function LoginScreen({ navigation }: NativeStackScreenProps<AuthStackParamList, 'Login'>) {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{ email?: string; password?: string }>({});
  const [serverError, setServerError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const pwRef = useRef<React.ComponentRef<typeof TextInput>>(null);

  const submit = async () => {
    const e: typeof errors = {};
    if (!isEmail(email)) e.email = 'Enter a valid email address.';
    if (!password) e.password = 'Enter your password.';
    setErrors(e);
    setServerError(null);
    if (Object.keys(e).length) return;
    setBusy(true);
    try {
      await signIn(email, password);
    } catch (err) {
      setServerError(errorMessage(err));
      setBusy(false);
    }
  };

  return (
    <Screen contentStyle={styles.content}>
      <View style={styles.brand}>
        <Text variant="display" color={colors.accent}>SpendWise</Text>
        <Text muted>Submit expenses and keep an eye on your spending.</Text>
      </View>
      <Field
        label="Email" value={email} onChangeText={setEmail} error={errors.email}
        autoCapitalize="none" autoCorrect={false} keyboardType="email-address" textContentType="username" autoComplete="email"
        returnKeyType="next" onSubmitEditing={() => pwRef.current?.focus()}
      />
      <Field
        ref={pwRef} label="Password" value={password} onChangeText={setPassword} error={errors.password}
        secureTextEntry textContentType="password" autoComplete="current-password" returnKeyType="go" onSubmitEditing={submit}
      />
      <ErrorBanner message={serverError} />
      <Button label="Sign in" onPress={submit} loading={busy} />
      <Button label="Forgot password?" variant="ghost" onPress={() => navigation.navigate('ForgotPassword', { email })} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { flexGrow: 1, justifyContent: 'center', padding: spacing.lg, gap: spacing.md },
  brand: { gap: spacing.xs, marginBottom: spacing.lg },
});
