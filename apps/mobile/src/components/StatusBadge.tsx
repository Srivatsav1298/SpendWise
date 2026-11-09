import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius, spacing } from '../theme';
import { Text } from './Text';

const MAP: Record<string, { label: string; fg: string; bg: string }> = {
  DRAFT: { label: 'Draft', fg: colors.textMuted, bg: colors.neutralSoft },
  SUBMITTED: { label: 'Submitted', fg: colors.info, bg: colors.infoSoft },
  APPROVED: { label: 'Approved', fg: colors.success, bg: colors.successSoft },
  REJECTED: { label: 'Rejected', fg: colors.danger, bg: colors.dangerSoft },
  REIMBURSED: { label: 'Reimbursed', fg: colors.accent, bg: colors.accentSoft },
  DECLINED: { label: 'Declined', fg: colors.danger, bg: colors.dangerSoft },
  ACTIVE: { label: 'Active', fg: colors.success, bg: colors.successSoft },
  FROZEN: { label: 'Frozen', fg: colors.info, bg: colors.infoSoft },
  FLAGGED: { label: 'Flagged', fg: colors.warning, bg: colors.warningSoft },
};

/** Always renders a text label; colour is never the only signal. */
export function StatusBadge({ status }: { status: string }) {
  const m = MAP[status] ?? { label: status, fg: colors.textMuted, bg: colors.neutralSoft };
  return (
    <View style={[styles.badge, { backgroundColor: m.bg }]} accessible accessibilityLabel={`Status: ${m.label}`}>
      <Text variant="caption" color={m.fg} weight="700">{m.label.toUpperCase()}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: { alignSelf: 'flex-start', paddingHorizontal: spacing.xs, paddingVertical: spacing.xxs, borderRadius: radius.pill },
});
