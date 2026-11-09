import React from 'react';
import { StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { colors, spacing } from '../theme';
import { Button } from './Button';
import { Text } from './Text';

interface Props { title: string; message?: string; icon?: keyof typeof Ionicons.glyphMap; actionLabel?: string; onAction?: () => void }

export function EmptyState({ title, message, icon = 'file-tray-outline', actionLabel, onAction }: Props) {
  return (
    <View style={styles.wrap}>
      <Ionicons name={icon} size={40} color={colors.textMuted} />
      <Text variant="heading" style={styles.center}>{title}</Text>
      {message ? <Text muted style={styles.center}>{message}</Text> : null}
      {actionLabel && onAction ? <Button label={actionLabel} onPress={onAction} variant="secondary" /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: spacing.sm, padding: spacing.xl },
  center: { textAlign: 'center' },
});
