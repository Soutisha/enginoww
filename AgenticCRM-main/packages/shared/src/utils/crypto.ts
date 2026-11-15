import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

function getKey(): Buffer {
  const key = process.env.ENCRYPTION_KEY;
  if (!key) throw new Error('ENCRYPTION_KEY env var is not set');

  // Keep compatibility with existing deployments that use 64-character hex
  // keys, while also accepting Render's base64-encoded 32-byte generated keys.
  if (/^[a-fA-F0-9]{64}$/.test(key)) {
    return Buffer.from(key, 'hex');
  }

  if (/^[A-Za-z0-9+/]{43}=$/.test(key)) {
    const decoded = Buffer.from(key, 'base64');
    if (decoded.length === 32 && decoded.toString('base64') === key) {
      return decoded;
    }
  }

  throw new Error('ENCRYPTION_KEY must be a 32-byte key encoded as 64 hex or 44 base64 characters');
}

/**
 * Encrypt a plaintext string using AES-256-GCM.
 * Returns a colon-separated string: iv:authTag:ciphertext (all hex-encoded).
 */
export function encrypt(plaintext: string): string {
  const key = getKey();
  const iv = randomBytes(12); // 96-bit IV for GCM
  const cipher = createCipheriv('aes-256-gcm', key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return `${iv.toString('hex')}:${tag.toString('hex')}:${encrypted.toString('hex')}`;
}

/**
 * Decrypt a value produced by encrypt().
 */
export function decrypt(ciphertext: string): string {
  const key = getKey();
  const parts = ciphertext.split(':');
  if (parts.length !== 3) throw new Error('Invalid ciphertext format');
  const [ivHex, tagHex, encHex] = parts;
  const decipher = createDecipheriv(
    'aes-256-gcm',
    key,
    Buffer.from(ivHex, 'hex'),
  );
  decipher.setAuthTag(Buffer.from(tagHex, 'hex'));
  const decrypted = Buffer.concat([
    decipher.update(Buffer.from(encHex, 'hex')),
    decipher.final(),
  ]);
  return decrypted.toString('utf8');
}

/** Returns true if the string looks like an encrypted value (iv:tag:ciphertext). */
export function isEncrypted(value: string): boolean {
  const parts = value.split(':');
  return parts.length === 3 && parts.every((p) => /^[0-9a-f]+$/i.test(p));
}
