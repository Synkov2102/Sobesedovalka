import { useEffect, useState } from 'react'
import {
  fetchOAuthPublicConfig,
  type OAuthPublicConfig,
} from '../api/oauthPublicConfig'
import { oauthRedirectUriForPage } from './oauthRedirectUri'
import { vkAppId as vkAppIdFromEnv, vkRedirectUri as vkRedirectFromEnv } from './vkPkce'
import { yandexClientId as yandexFromEnv, yandexRedirectUri as yandexRedirectFromEnv } from './yandexOAuth'

export type ResolvedOAuthConfig = {
  vkAppId: number | null
  vkRedirectUri: string
  yandexClientId: string | null
  yandexRedirectUri: string
  loading: boolean
}

function mergeConfig(server: OAuthPublicConfig | null): ResolvedOAuthConfig {
  const vkAppId = vkAppIdFromEnv() ?? server?.vkAppId ?? null
  const yandexClientId =
    yandexFromEnv() ?? server?.yandexClientId?.trim() ?? null

  return {
    vkAppId,
    vkRedirectUri: oauthRedirectUriForPage(
      vkRedirectFromEnv(),
      server?.vkRedirectUri,
    ),
    yandexClientId,
    yandexRedirectUri: oauthRedirectUriForPage(
      yandexRedirectFromEnv(),
      server?.yandexRedirectUri,
    ),
    loading: false,
  }
}

export function useOAuthPublicConfig(): ResolvedOAuthConfig {
  const [resolved, setResolved] = useState<ResolvedOAuthConfig>(() => ({
    ...mergeConfig(null),
    loading: true,
  }))

  useEffect(() => {
    let cancelled = false

    async function run() {
      try {
        const server = await fetchOAuthPublicConfig()
        if (!cancelled) {
          setResolved(mergeConfig(server))
        }
      } catch {
        if (!cancelled) {
          setResolved(mergeConfig(null))
        }
      }
    }

    void run()
    return () => {
      cancelled = true
    }
  }, [])

  return resolved
}
