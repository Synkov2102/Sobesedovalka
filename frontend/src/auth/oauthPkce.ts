const PKCE_CHARS =
  'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-._~'

function randomString(length: number): string {
  const bytes = crypto.getRandomValues(new Uint8Array(length))
  return Array.from(bytes, (b) => PKCE_CHARS[b % PKCE_CHARS.length]).join('')
}

function base64Url(bytes: Uint8Array): string {
  let binary = ''
  for (const b of bytes) {
    binary += String.fromCharCode(b)
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

async function sha256Base64Url(input: string): Promise<string> {
  const data = new TextEncoder().encode(input)
  const hash = await crypto.subtle.digest('SHA-256', data)
  return base64Url(new Uint8Array(hash))
}

export type PkcePair = {
  codeVerifier: string
  codeChallenge: string
}

export async function createPkcePair(): Promise<PkcePair> {
  const codeVerifier = randomString(64)
  const codeChallenge = await codeChallengeFromVerifier(codeVerifier)
  return { codeVerifier, codeChallenge }
}

export async function codeChallengeFromVerifier(
  codeVerifier: string,
): Promise<string> {
  return sha256Base64Url(codeVerifier)
}

export function createOAuthState(): string {
  return randomString(32)
}

export function storeOAuthValue(key: string, value: string): void {
  sessionStorage.setItem(key, value)
}

export function peekOAuthValue(key: string): string | null {
  const v = sessionStorage.getItem(key)
  return v?.trim() ? v : null
}

export function takeOAuthValue(key: string): string | null {
  const v = peekOAuthValue(key)
  sessionStorage.removeItem(key)
  return v
}
