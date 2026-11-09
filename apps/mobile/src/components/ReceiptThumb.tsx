import React, { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Image, Modal, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { downloadReceipt } from '../api/receiptFile';
import type { Receipt } from '../api/types';
import { colors, hairline, radius, spacing } from '../theme';
import { Button } from './Button';
import { Text } from './Text';

/** Authenticated receipt thumbnail: downloads with the bearer header to cache, tap to view full screen. */
export function ReceiptThumb({ receipt }: { receipt: Receipt }) {
  const [uri, setUri] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const isPdf = receipt.mimeType === 'application/pdf';

  const load = useCallback(async () => {
    setError(null);
    try { setUri(await downloadReceipt(receipt)); } catch (e) { setError(e instanceof Error ? e.message : 'Failed to load'); }
  }, [receipt]);

  useEffect(() => { if (!isPdf) void load(); }, [isPdf, load]);

  return (
    <>
      <Pressable
        style={styles.thumb}
        onPress={() => (error ? void load() : uri && setOpen(true))}
        accessibilityRole="button"
        accessibilityLabel={error ? `Retry loading receipt ${receipt.originalName}` : `Open receipt ${receipt.originalName}`}
      >
        {isPdf ? <Text variant="small" weight="700">PDF</Text>
          : uri ? <Image source={{ uri }} style={styles.img} resizeMode="cover" />
          : error ? <Text variant="caption" color={colors.danger} style={styles.center}>Tap to retry</Text>
          : <ActivityIndicator color={colors.accent} />}
      </Pressable>
      {isPdf ? <Text variant="caption" muted style={styles.pdfNote}>{receipt.originalName} (PDF preview is not available in the app)</Text> : null}
      <Modal visible={open} animationType="fade" onRequestClose={() => setOpen(false)}>
        <SafeAreaView style={styles.modal}>
          <View style={styles.modalBody}>{uri ? <Image source={{ uri }} style={styles.full} resizeMode="contain" accessibilityLabel={receipt.originalName} /> : null}</View>
          <Button label="Close" onPress={() => setOpen(false)} variant="secondary" style={styles.close} />
        </SafeAreaView>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  thumb: { width: 96, height: 96, borderRadius: radius.md, overflow: 'hidden', borderWidth: hairline, borderColor: colors.border, backgroundColor: colors.neutralSoft, alignItems: 'center', justifyContent: 'center' },
  img: { width: '100%', height: '100%' },
  center: { textAlign: 'center' },
  pdfNote: { maxWidth: 140 },
  modal: { flex: 1, backgroundColor: colors.text },
  modalBody: { flex: 1 },
  full: { flex: 1 },
  close: { margin: spacing.md },
});
