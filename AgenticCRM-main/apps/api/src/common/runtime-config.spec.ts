import { validateRuntimeConfig } from './runtime-config';

describe('validateRuntimeConfig', () => {
  it('does not block local development', () => {
    expect(() => validateRuntimeConfig({ NODE_ENV: 'development' })).not.toThrow();
  });

  it('rejects production placeholders and missing infrastructure', () => {
    expect(() => validateRuntimeConfig({ NODE_ENV: 'production' })).toThrow(/JWT_SECRET/);
  });

  it('accepts a fully configured production environment', () => {
    expect(() => validateRuntimeConfig({
      NODE_ENV: 'production',
      JWT_SECRET: 'a-unique-production-secret-with-more-than-32-characters',
      ENCRYPTION_KEY: '1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
      DOMAIN: 'crm.example.org',
      DATABASE_URL: 'postgresql://user:pass@db:5432/app',
      DIRECT_DATABASE_URL: 'postgresql://user:pass@db:5432/app',
      REDIS_URL: 'redis://redis:6379',
    })).not.toThrow();
  });
});
