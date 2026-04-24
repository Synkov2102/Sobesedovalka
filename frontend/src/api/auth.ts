import type { AuthLoginResponse, AuthUser } from '../types/api.types'
import { apiFetch } from './apiFetch'
import { API_PREFIX } from './constants'

async function readApiError(res: Response): Promise<string> {
  try {
    const body: unknown = await res.json()
    if (body && typeof body === 'object' && 'message' in body) {
      const m = (body as { message: unknown }).message
      if (Array.isArray(m)) {
        return m.map(String).join(', ')
      }
      if (typeof m === 'string') {
        return m
      }
    }
  } catch {
    // ignore
  }
  return res.statusText || String(res.status)
}

export async function postAuthRegister(body: {
  email?: string
  phone?: string
  password: string
}): Promise<AuthLoginResponse> {
  const res = await fetch(`${API_PREFIX}/auth/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(await readApiError(res))
  }
  return (await res.json()) as AuthLoginResponse
}

export async function postAuthLogin(body: {
  login: string
  password: string
}): Promise<AuthLoginResponse> {
  const res = await fetch(`${API_PREFIX}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(await readApiError(res))
  }
  return (await res.json()) as AuthLoginResponse
}

export async function fetchMe(): Promise<AuthUser> {
  const res = await apiFetch('/auth/me')
  if (!res.ok) {
    throw new Error(String(res.status))
  }
  return (await res.json()) as AuthUser
}
