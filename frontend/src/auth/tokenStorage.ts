const KEY = 'sobesedovalka_access_token'

export function getAccessToken(): string | null {
  try {
    return localStorage.getItem(KEY)
  } catch {
    return null
  }
}

export function setAccessToken(token: string): void {
  localStorage.setItem(KEY, token)
}

export function clearAccessToken(): void {
  localStorage.removeItem(KEY)
}
