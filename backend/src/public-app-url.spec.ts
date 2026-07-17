import { isLocalhostOrigin, publicAppOriginFromEnv } from './public-app-url';

describe('publicAppOriginFromEnv', () => {
  const keys = [
    'PUBLIC_APP_URL',
    'APP_PUBLIC_URL',
    'FRONTEND_URL',
    'CORS_ORIGIN',
  ] as const;
  const saved: Record<string, string | undefined> = {};

  beforeEach(() => {
    for (const key of keys) {
      saved[key] = process.env[key];
      delete process.env[key];
    }
  });

  afterEach(() => {
    for (const key of keys) {
      const value = saved[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });

  it('prefers PUBLIC_APP_URL over CORS_ORIGIN', () => {
    process.env.PUBLIC_APP_URL = 'https://sobesilka.ru';
    process.env.CORS_ORIGIN = 'http://localhost:5173';
    expect(publicAppOriginFromEnv()).toBe('https://sobesilka.ru');
  });

  it('skips localhost CORS when a public origin is listed', () => {
    process.env.CORS_ORIGIN = 'http://localhost:5173,https://sobesilka.ru';
    expect(publicAppOriginFromEnv()).toBe('https://sobesilka.ru');
  });

  it('falls back to localhost CORS when that is the only origin', () => {
    process.env.CORS_ORIGIN = 'http://localhost:5173';
    expect(publicAppOriginFromEnv()).toBe('http://localhost:5173');
  });

  it('defaults to local Vite origin when unset', () => {
    expect(publicAppOriginFromEnv()).toBe('http://localhost:5173');
  });

  it('detects localhost origins', () => {
    expect(isLocalhostOrigin('http://localhost:5173')).toBe(true);
    expect(isLocalhostOrigin('https://sobesilka.ru')).toBe(false);
  });
});
