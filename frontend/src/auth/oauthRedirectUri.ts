/** Redirect URI для OAuth: совпадает с origin страницы (важно для прода). */
export function oauthRedirectUriForPage(
  fromEnv?: string,
  fromServer?: string,
): string {
  const origin = window.location.origin
  for (const candidate of [fromEnv?.trim(), fromServer?.trim()]) {
    if (!candidate) {
      continue
    }
    try {
      if (new URL(candidate).origin === origin) {
        return candidate
      }
    } catch {
      // ignore invalid URL in config
    }
  }
  return origin
}
