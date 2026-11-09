import * as SecureStore from 'expo-secure-store';
import type { Tokens } from './types';

const KEY = 'spendwise.tokens.v1';

export interface TokenStore {
  get(): Promise<Tokens | null>;
  set(t: Tokens): Promise<void>;
  clear(): Promise<void>;
}

/** Tokens live only in the OS keychain/keystore (never AsyncStorage). */
export const secureTokenStore: TokenStore = {
  async get() {
    try {
      const raw = await SecureStore.getItemAsync(KEY);
      if (!raw) return null;
      const p = JSON.parse(raw) as Partial<Tokens>;
      return p.accessToken && p.refreshToken ? { accessToken: p.accessToken, refreshToken: p.refreshToken } : null;
    } catch {
      return null;
    }
  },
  async set(t) {
    await SecureStore.setItemAsync(KEY, JSON.stringify(t));
  },
  async clear() {
    try {
      await SecureStore.deleteItemAsync(KEY);
    } catch {
      /* nothing to clear */
    }
  },
};
