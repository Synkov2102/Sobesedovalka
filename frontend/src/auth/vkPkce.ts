import {
  createPkcePair,
  peekOAuthValue,
  storeOAuthValue,
  takeOAuthValue,
  type PkcePair,
} from './oauthPkce'

export function peekVkCodeVerifier(): string | null {
  return peekOAuthValue(VK_PKCE_KEY)
}

const VK_PKCE_KEY = 'sobesedovalka_vkid_pkce'

export type VkPkcePair = PkcePair

export { createPkcePair as createVkPkce }

export function storeVkCodeVerifier(codeVerifier: string): void {
  storeOAuthValue(VK_PKCE_KEY, codeVerifier)
}

export function takeVkCodeVerifier(): string | null {
  return takeOAuthValue(VK_PKCE_KEY)
}

export function vkRedirectUri(): string {
  const fromEnv = import.meta.env.VITE_VK_REDIRECT_URI?.trim()
  if (fromEnv) {
    return fromEnv
  }
  return window.location.origin
}

export function vkAppId(): number | null {
  const raw = import.meta.env.VITE_VK_APP_ID?.trim()
  if (!raw) {
    return null
  }
  const n = Number(raw)
  return Number.isFinite(n) && n > 0 ? n : null
}
