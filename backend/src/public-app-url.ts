/** True for localhost / loopback hosts used in local Vite/dev. */
export function isLocalhostOrigin(value: string): boolean {
  try {
    const host = new URL(value.startsWith('http') ? value : `http://${value}`)
      .hostname;
    return (
      host === 'localhost' ||
      host === '127.0.0.1' ||
      host === '[::1]' ||
      host === '::1'
    );
  } catch {
    return /localhost|127\.0\.0\.1|\[::1\]/i.test(value);
  }
}

function originFromRaw(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) {
    return null;
  }
  try {
    const withScheme = trimmed.startsWith('http')
      ? trimmed
      : `https://${trimmed}`;
    return new URL(withScheme).origin;
  } catch {
    return null;
  }
}

/**
 * Public frontend origin for absolute links (org invites, etc.).
 *
 * Prefer dedicated env; never pick a localhost CORS entry when a public
 * origin is also listed (common misconfig: CORS_ORIGIN=http://localhost:5173,https://…).
 */
export function publicAppOriginFromEnv(): string {
  for (const key of [
    'PUBLIC_APP_URL',
    'APP_PUBLIC_URL',
    'FRONTEND_URL',
  ] as const) {
    const raw = process.env[key]?.trim();
    if (!raw) {
      continue;
    }
    const origin = originFromRaw(raw);
    if (origin) {
      return origin;
    }
  }

  const cors = process.env.CORS_ORIGIN?.trim() ?? '';
  if (cors && cors !== '*') {
    const parts = cors
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const nonLocal = parts.find((p) => !isLocalhostOrigin(p));
    const chosen = nonLocal ?? parts[0];
    if (chosen) {
      const origin = originFromRaw(chosen);
      if (origin) {
        return origin;
      }
    }
  }

  return 'http://localhost:5173';
}
