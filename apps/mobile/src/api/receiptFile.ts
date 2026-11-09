import { File, Paths } from 'expo-file-system';
import { client } from './index';
import type { Receipt } from './types';

const EXT: Record<string, string> = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp', 'application/pdf': 'pdf' };

/**
 * Downloads an authenticated receipt to the cache directory using the bearer header (no token in the URL).
 * On a 401 it performs the client's single-flight refresh and retries once. Returns a local file:// URI.
 */
export async function downloadReceipt(r: Pick<Receipt, 'id' | 'mimeType'>): Promise<string> {
  const dest = new File(Paths.cache, `receipt-${r.id}.${EXT[r.mimeType] ?? 'bin'}`);
  if (dest.exists) return dest.uri;
  const url = client.url(`/receipts/${r.id}`);
  const attempt = async (token: string) => (await File.downloadFileAsync(url, dest, { headers: { Authorization: `Bearer ${token}` } })).uri;

  const token = await client.getAccessToken();
  if (!token) throw new Error('Not signed in');
  try {
    return await attempt(token);
  } catch (e) {
    const msg = e instanceof Error ? e.message : '';
    if (!/\b401\b/.test(msg)) throw new Error(`Could not load receipt. ${msg}`.trim());
    const fresh = await client.refresh(token);
    return attempt(fresh.accessToken);
  }
}
