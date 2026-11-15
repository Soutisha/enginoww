/** Fail fast on unsafe or incomplete production configuration. */
export function validateRuntimeConfig(env: NodeJS.ProcessEnv = process.env): void {
  if (env.NODE_ENV !== 'production') return;

  const problems: string[] = [];
  const jwtSecret = env.JWT_SECRET ?? '';
  if (jwtSecret.length < 32 || /change[_-]?me|example|fallback|secret123/i.test(jwtSecret)) {
    problems.push('JWT_SECRET must be a unique random value of at least 32 characters');
  }

  const encryptionKey = env.ENCRYPTION_KEY ?? '';
  const validHexKey = /^[a-fA-F0-9]{64}$/.test(encryptionKey) && !/^0+$/.test(encryptionKey);
  const decodedBase64Key = Buffer.from(encryptionKey, 'base64');
  const validBase64Key = /^[A-Za-z0-9+/]{43}=$/.test(encryptionKey)
    && decodedBase64Key.length === 32
    && decodedBase64Key.some((byte) => byte !== 0);
  if (!validHexKey && !validBase64Key) {
    problems.push('ENCRYPTION_KEY must be a non-zero 32-byte key encoded as 64 hex or 44 base64 characters');
  }

  const domain = env.DOMAIN ?? '';
  if (!domain || domain.includes('yourcompany.com') || domain.includes('CHANGE_ME') || /[\s/:]/.test(domain)) {
    problems.push('DOMAIN must be the public hostname without a scheme or path');
  }

  for (const key of ['DATABASE_URL', 'DIRECT_DATABASE_URL', 'REDIS_URL']) {
    if (!env[key] || env[key]?.includes('changeme')) problems.push(`${key} must be configured`);
  }

  if (problems.length) {
    throw new Error(`Unsafe production configuration:\n- ${problems.join('\n- ')}`);
  }
}
