import '@testing-library/jest-dom/vitest';
import { afterEach } from 'vitest';
import { cleanup } from '@testing-library/react';

// Newer Node versions ship an experimental global `localStorage` that is undefined unless a flag is passed and
// shadows jsdom's. Install a deterministic in-memory Storage so tests behave the same on every Node version.
class MemoryStorage implements Storage {
  private m = new Map<string, string>();
  get length() { return this.m.size; }
  clear() { this.m.clear(); }
  getItem(k: string) { return this.m.has(k) ? this.m.get(k)! : null; }
  key(i: number) { return [...this.m.keys()][i] ?? null; }
  removeItem(k: string) { this.m.delete(k); }
  setItem(k: string, v: string) { this.m.set(k, String(v)); }
}
const storage = new MemoryStorage();
for (const target of [globalThis, typeof window !== 'undefined' ? window : globalThis]) {
  Object.defineProperty(target, 'localStorage', { value: storage, configurable: true, writable: true });
}

afterEach(() => { cleanup(); storage.clear(); });
