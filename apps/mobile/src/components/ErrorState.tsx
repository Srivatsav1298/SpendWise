import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';
import { Button } from './Button';
import { Text } from './Text';

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <View style={styles.wrap} accessibilityRole="alert">
      <Ionicons name="alert-circle-outline" size={40} color={colors.danger} />
      <Text variant="heading" style={styles.center}>Something went wrong</Text>
      <Text muted style={styles.center}>{message}</Text>
      {onRetry ? <Button label="Try again" onPress={onRetry} variant="secondary" /> : null}
    </View>
  );
}

/** Compact inline banner for form-level / non-blocking errors. */
export function ErrorBanner({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <View style={styles.banner} accessibilityRole="alert">
      <Text variant="small" color={colors.danger}>{message}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.sm, padding: spacing.xl },
  center: { textAlign: 'center' },
  banner: { backgroundColor: colors.dangerSoft, borderRadius: 8, padding: spacing.sm },
});
