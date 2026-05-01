/** Align with `main.ts` enableCors — Socket.IO must use the same rules or prod collab breaks. */
export function corsOriginFromEnv(): true | string[] {
  const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:5173';
  if (corsOrigin === '*') {
    return true;
  }
  return corsOrigin.split(',').map((s) => s.trim());
}

export function corsCredentialsFromEnv(): boolean {
  const corsOrigin = process.env.CORS_ORIGIN ?? 'http://localhost:5173';
  return corsOrigin !== '*';
}
