import React from 'react';
import { StyleSheet, TextInput, View, type TextInputProps } from 'react-native';
import { colors, hairline, MIN_TOUCH, radius, spacing, type } from '../theme';
import { Text } from './Text';

interface Props extends TextInputProps {
  label: string;
  error?: string;
  hint?: string;
}

export const Field = React.forwardRef<React.ComponentRef<typeof TextInput>, Props>(function Field({ label, error, hint, style, ...rest }, ref) {
  return (
    <View style={styles.wrap}>
      <Text variant="small" weight="600">{label}</Text>
      <TextInput
        ref={ref}
        accessibilityLabel={label}
        placeholderTextColor={colors.textMuted}
        {...rest}
        style={[styles.input, rest.multiline && styles.multiline, !!error && styles.inputError, style]}
      />
      {error ? <Text variant="small" color={colors.danger} accessibilityRole="alert">{error}</Text> : hint ? <Text variant="small" muted>{hint}</Text> : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { gap: spacing.xxs },
  input: {
    ...type.body, color: colors.text, backgroundColor: colors.surface, borderColor: colors.border, borderWidth: hairline,
    borderRadius: radius.md, minHeight: MIN_TOUCH, paddingHorizontal: spacing.sm,
  },
  multiline: { minHeight: 96, paddingTop: spacing.sm, textAlignVertical: 'top' },
  inputError: { borderColor: colors.danger },
});
