import React from 'react';
import { ActivityIndicator, Pressable, StyleSheet, type ViewStyle } from 'react-native';
import { colors, MIN_TOUCH, radius, spacing, type } from '../theme';
import { Text } from './Text';

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';
interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

const palette: Record<Variant, { bg: string; fg: string; border: string }> = {
  primary: { bg: colors.accent, fg: colors.accentText, border: colors.accent },
  secondary: { bg: colors.surface, fg: colors.text, border: colors.border },
  danger: { bg: colors.surface, fg: colors.danger, border: colors.danger },
  ghost: { bg: 'transparent', fg: colors.accent, border: 'transparent' },
};

export function Button({ label, onPress, variant = 'primary', loading, disabled, style }: Props) {
  const p = palette[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: !!inactive, busy: !!loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [styles.base, { backgroundColor: p.bg, borderColor: p.border }, inactive && styles.inactive, pressed && styles.pressed, style]}
    >
      {loading ? <ActivityIndicator color={p.fg} /> : <Text style={{ ...type.heading, color: p.fg }}>{label}</Text>}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: { minHeight: MIN_TOUCH, borderRadius: radius.md, borderWidth: 1, paddingHorizontal: spacing.md, alignItems: 'center', justifyContent: 'center', flexDirection: 'row' },
  inactive: { opacity: 0.5 },
  pressed: { opacity: 0.85 },
});
