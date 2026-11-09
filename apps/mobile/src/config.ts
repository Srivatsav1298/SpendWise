const raw = process.env.EXPO_PUBLIC_API_URL?.trim();
/** API base URL, no trailing slash. Android emulator: http://10.0.2.2:3000/api */
export const API_URL = (raw && raw.length > 0 ? raw : 'http://localhost:3000/api').replace(/\/+$/, '');
export const DEFAULT_CURRENCY = 'NOK';
export const CATEGORIES = ['Travel', 'Meals', 'Software', 'Equipment', 'Marketing', 'Office', 'Other'] as const;
export const PAGE_SIZE = 20;
