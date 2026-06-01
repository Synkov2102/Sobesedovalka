import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadEnv, type Plugin } from 'vite'

const OAUTH_KEYS = [
  'VITE_VK_APP_ID',
  'VK_CLIENT_ID',
  'VITE_VK_REDIRECT_URI',
  'VK_REDIRECT_URI',
  'VITE_YANDEX_CLIENT_ID',
  'YANDEX_CLIENT_ID',
  'VITE_YANDEX_REDIRECT_URI',
  'YANDEX_REDIRECT_URI',
  'VITE_COLLAB_WS_URL',
] as const

export type OAuthViteEnv = {
  VITE_VK_APP_ID: string
  VITE_VK_REDIRECT_URI: string
  VITE_YANDEX_CLIENT_ID: string
  VITE_YANDEX_REDIRECT_URI: string
  VITE_COLLAB_WS_URL: string
}

const frontendDir = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(frontendDir, '..')
const backendDir = path.join(repoRoot, 'backend')

function firstNonEmpty(...values: (string | undefined)[]): string {
  for (const value of values) {
    const trimmed = value?.trim()
    if (trimmed) {
      return trimmed
    }
  }
  return ''
}

function pickProcessEnv(): Record<string, string> {
  const out: Record<string, string> = {}
  for (const key of OAUTH_KEYS) {
    const value = process.env[key]?.trim()
    if (value) {
      out[key] = value
    }
  }
  return out
}

function mergeEnvLayers(mode: string): Record<string, string> {
  return {
    ...loadEnv(mode, repoRoot, ''),
    ...loadEnv(mode, backendDir, ''),
    ...loadEnv(mode, frontendDir, ''),
    ...pickProcessEnv(),
  }
}

/** VK_* / YANDEX_* → VITE_* для клиента (dev, docker build, CI build-args). */
export function resolveOAuthViteEnv(mode: string): OAuthViteEnv {
  const env = mergeEnvLayers(mode)

  return {
    VITE_VK_APP_ID: firstNonEmpty(env.VITE_VK_APP_ID, env.VK_CLIENT_ID),
    VITE_VK_REDIRECT_URI: firstNonEmpty(
      env.VITE_VK_REDIRECT_URI,
      env.VK_REDIRECT_URI,
    ),
    VITE_YANDEX_CLIENT_ID: firstNonEmpty(
      env.VITE_YANDEX_CLIENT_ID,
      env.YANDEX_CLIENT_ID,
    ),
    VITE_YANDEX_REDIRECT_URI: firstNonEmpty(
      env.VITE_YANDEX_REDIRECT_URI,
      env.YANDEX_REDIRECT_URI,
    ),
    VITE_COLLAB_WS_URL: firstNonEmpty(env.VITE_COLLAB_WS_URL),
  }
}

export function oauthViteEnvDefine(
  oauth: OAuthViteEnv,
): Record<string, string> {
  return {
    'import.meta.env.VITE_VK_APP_ID': JSON.stringify(oauth.VITE_VK_APP_ID),
    'import.meta.env.VITE_VK_REDIRECT_URI': JSON.stringify(
      oauth.VITE_VK_REDIRECT_URI,
    ),
    'import.meta.env.VITE_YANDEX_CLIENT_ID': JSON.stringify(
      oauth.VITE_YANDEX_CLIENT_ID,
    ),
    'import.meta.env.VITE_YANDEX_REDIRECT_URI': JSON.stringify(
      oauth.VITE_YANDEX_REDIRECT_URI,
    ),
    'import.meta.env.VITE_COLLAB_WS_URL': JSON.stringify(
      oauth.VITE_COLLAB_WS_URL,
    ),
  }
}

export function oauthViteEnvPlugin(mode: string): Plugin {
  const oauth = resolveOAuthViteEnv(mode)
  const define = oauthViteEnvDefine(oauth)

  return {
    name: 'sobesedovalka-oauth-env',
    config: () => ({ define }),
  }
}
