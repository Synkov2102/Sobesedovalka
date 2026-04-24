import { getAccessToken } from '../auth/tokenStorage'
import { API_PREFIX } from './constants'

/** Authenticated fetch to `/api/...` (Vite proxy). */
export async function apiFetch(
  path: string,
  init: RequestInit = {},
): Promise<Response> {
  const p = path.startsWith('/') ? path : `/${path}`
  const headers = new Headers(init.headers)
  const t = getAccessToken()
  if (t) {
    headers.set('Authorization', `Bearer ${t}`)
  }
  return fetch(`${API_PREFIX}${p}`, { ...init, headers })
}
