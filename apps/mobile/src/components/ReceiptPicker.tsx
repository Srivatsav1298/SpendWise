import React, { useState } from 'react';
import { Alert, Image, Linking, Pressable, StyleSheet, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { colors, hairline, radius, spacing } from '../theme';
import { ALLOWED_RECEIPT_TYPES, MAX_RECEIPT_BYTES } from '../lib/validation';
import { Button } from './Button';
import { ErrorBanner } from './ErrorState';
import { Text } from './Text';

export interface PendingReceipt { uri: string; name: string; mimeType: string; size?: number }

const EXT_TYPES: Record<string, string> = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', pdf: 'application/pdf' };

function toPending(a: ImagePicker.ImagePickerAsset): PendingReceipt {
  const ext = (a.fileName ?? a.uri).split('.').pop()?.toLowerCase().split('?')[0] ?? '';
  const mimeType = a.mimeType ?? EXT_TYPES[ext] ?? 'image/jpeg';
  const name = a.fileName ?? `receipt-${Date.now()}.${ext && EXT_TYPES[ext] ? ext : 'jpg'}`;
  return { uri: a.uri, name, mimeType, size: a.fileSize };
}

async function ensurePermission(kind: 'camera' | 'library'): Promise<string | null> {
  const req = kind === 'camera' ? ImagePicker.requestCameraPermissionsAsync : ImagePicker.requestMediaLibraryPermissionsAsync;
  const res = await req();
  if (res.granted) return null;
  const what = kind === 'camera' ? 'the camera' : 'your photo library';
  if (!res.canAskAgain) {
    Alert.alert(`Allow access to ${what}`, `SpendWise needs ${what} to attach receipts. You can enable it in Settings.`, [
      { text: 'Not now', style: 'cancel' },
      { text: 'Open Settings', onPress: () => void Linking.openSettings() },
    ]);
  }
  return `Permission to use ${what} was denied. Enable it in your device settings to attach receipts.`;
}

interface Props { pending: PendingReceipt[]; maxMore: number; onAdd(r: PendingReceipt): void; onRemove(uri: string): void }

/** Camera or gallery capture with permission handling. Files are uploaded by the form after the draft exists. */
export function ReceiptPicker({ pending, maxMore, onAdd, onRemove }: Props) {
  const [error, setError] = useState<string | null>(null);

  const pick = async (kind: 'camera' | 'library') => {
    setError(null);
    if (pending.length >= maxMore) { setError(`At most 5 receipts per expense.`); return; }
    try {
      const denied = await ensurePermission(kind);
      if (denied) { setError(denied); return; }
      const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], quality: 0.7, allowsEditing: false };
      const res = kind === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
      if (res.canceled || res.assets.length === 0) return;
      const r = toPending(res.assets[0]);
      if (!ALLOWED_RECEIPT_TYPES.includes(r.mimeType)) { setError('Unsupported file type. Use a JPEG, PNG or WebP image.'); return; }
      if (r.size !== undefined && r.size > MAX_RECEIPT_BYTES) { setError('That image is larger than 5 MB. Try a smaller photo.'); return; }
      onAdd(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not open the picker.');
    }
  };

  return (
    <View style={styles.wrap}>
      <View style={styles.row}>
        <Button label="Take photo" variant="secondary" style={styles.flex} onPress={() => void pick('camera')} />
        <Button label="Choose from gallery" variant="secondary" style={styles.flex} onPress={() => void pick('library')} />
      </View>
      <ErrorBanner message={error} />
      {pending.length > 0 ? (
        <View style={styles.thumbs}>
          {pending.map((r) => (
            <View key={r.uri} style={styles.thumbWrap}>
              <Image source={{ uri: r.uri }} style={styles.thumb} accessibilityLabel={`Receipt ${r.name}`} />
              <Pressable accessibilityRole="button" accessibilityLabel={`Remove receipt ${r.name}`} onPress={() => onRemove(r.uri)} style={styles.remove} hitSlop={8}>
                <Text variant="caption" color={colors.accentText}>Remove</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  row: { flexDirection: 'row', gap: spacing.xs },
  flex: { flex: 1, paddingHorizontal: spacing.xs },
  thumbs: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  thumbWrap: { width: 96, height: 96, borderRadius: radius.md, overflow: 'hidden', borderWidth: hairline, borderColor: colors.border },
  thumb: { width: '100%', height: '100%' },
  remove: { position: 'absolute', left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(27,27,25,0.75)', alignItems: 'center', paddingVertical: 4 },
});
