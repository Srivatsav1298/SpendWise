import React from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius } from '../theme';

/** value is 0..1 (display only). The accompanying text carries the real numbers. */
export function ProgressBar({ value, warn }: { value: number; warn?: boolean }) {
  const pct = Math.round(Math.max(0, Math.min(1, value)) * 100);
  return (
    <View style={styles.track} accessibilityRole="progressbar" accessibilityValue={{ min: 0, max: 100, now: pct }}>
      <View style={[styles.fill, { width: `${pct}%`, backgroundColor: warn ? colors.warning : colors.accent }]} />
    </View>
  );
}

const styles = StyleSheet.create({
  track: { height: 8, borderRadius: radius.pill, backgroundColor: colors.neutralSoft, overflow: 'hidden' },
  fill: { height: 8, borderRadius: radius.pill },
});
