import React from 'react';
import { KeyboardAvoidingView, Platform, RefreshControl, ScrollView, StyleSheet, View, type ViewStyle } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';
import { colors, spacing } from '../theme';

interface Props {
  children: React.ReactNode;
  /** Wrap content in a ScrollView (default true). Set false when the child is a FlatList. */
  scroll?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  edges?: Edge[];
  padded?: boolean;
  contentStyle?: ViewStyle;
}

/** Safe-area + keyboard-avoiding page container on the warm neutral background. */
export function Screen({ children, scroll = true, onRefresh, refreshing = false, edges = ['top', 'left', 'right'], padded = true, contentStyle }: Props) {
  const inner = scroll ? (
    <ScrollView
      style={styles.flex}
      contentContainerStyle={[padded && styles.padded, contentStyle]}
      keyboardShouldPersistTaps="handled"
      refreshControl={onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.accent} colors={[colors.accent]} /> : undefined}
    >
      {children}
    </ScrollView>
  ) : (
    <View style={[styles.flex, padded && styles.paddedH, contentStyle]}>{children}</View>
  );
  return (
    <SafeAreaView style={styles.root} edges={edges}>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        {inner}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  flex: { flex: 1 },
  padded: { padding: spacing.md, paddingBottom: spacing.xl, gap: spacing.md },
  paddedH: { paddingHorizontal: spacing.md },
});
