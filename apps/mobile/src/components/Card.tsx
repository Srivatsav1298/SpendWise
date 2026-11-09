import React from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { colors, hairline, radius, spacing } from '../theme';

interface Props { children: React.ReactNode; onPress?: () => void; style?: ViewStyle; accessibilityLabel?: string }

export function Card({ children, onPress, style, accessibilityLabel }: Props) {
  if (onPress) {
    return (
      <Pressable accessibilityRole="button" accessibilityLabel={accessibilityLabel} onPress={onPress} style={({ pressed }) => [styles.card, pressed && styles.pressed, style]}>
        {children}
      </Pressable>
    );
  }
  return <View style={[styles.card, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: hairline, borderRadius: radius.lg, padding: spacing.md },
  pressed: { backgroundColor: colors.bg },
});
