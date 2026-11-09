import React from 'react';
import { Pressable, StyleSheet } from 'react-native';
import { colors, hairline, radius, spacing } from '../theme';
import { Text } from './Text';

export function Chip({ label, selected, onPress }: { label: string; selected?: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: !!selected }}
      accessibilityLabel={label}
      style={[styles.chip, selected && styles.selected]}
    >
      <Text variant="small" weight="600" color={selected ? colors.accentText : colors.text}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    minHeight: 40, paddingHorizontal: spacing.sm, justifyContent: 'center', borderRadius: radius.pill,
    borderWidth: hairline, borderColor: colors.border, backgroundColor: colors.surface,
  },
  selected: { backgroundColor: colors.accent, borderColor: colors.accent },
});
