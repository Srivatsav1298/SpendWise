import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { colors, spacing } from '../theme';

export function Loading() {
  return (
    <View style={styles.wrap} accessibilityLabel="Loading" accessibilityRole="progressbar">
      <ActivityIndicator size="large" color={colors.accent} />
    </View>
  );
}
const styles = StyleSheet.create({ wrap: { padding: spacing.xl, alignItems: 'center', justifyContent: 'center' } });
