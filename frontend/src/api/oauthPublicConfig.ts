import { API_PREFIX } from './constants'

export type OAuthPublicConfig = {
  vkAppId: number | null
  vkRedirectUri?: string
  yandexClientId?: string
  yandexRedirectUri?: string
}

export async function fetchOAuthPublicConfig(): Promise<OAuthPublicConfig> {
  const res = await fetch(`${API_PREFIX}/auth/public-config`)
  if (!res.ok) {
    throw new Error(String(res.status))
  }
  return (await res.json()) as OAuthPublicConfig
}
