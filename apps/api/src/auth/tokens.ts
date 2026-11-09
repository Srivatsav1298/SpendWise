import { createHash, randomBytes } from 'crypto';

export const newOpaqueToken = () => randomBytes(32).toString('base64url');
/** Only a SHA-256 hash of opaque tokens is stored; the raw token is shown once. */
export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex');
