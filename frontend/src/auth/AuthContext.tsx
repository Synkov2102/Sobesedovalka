import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  fetchMe,
  postAuthLogin,
  postAuthRegister,
} from '../api/auth'
import type { AuthUser } from '../types/api.types'
import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from './tokenStorage'

type AuthContextValue = {
  user: AuthUser | null
  /** True after initial check of stored token. */
  ready: boolean
  login: (login: string, password: string) => Promise<void>
  register: (params: {
    email: string
    phone: string
    password: string
  }) => Promise<void>
  logout: () => void
  authError: string | null
  clearAuthError: () => void
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null)
  const [ready, setReady] = useState(false)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    async function run() {
      const t = getAccessToken()
      if (!t) {
        if (!cancelled) {
          setReady(true)
        }
        return
      }
      try {
        const u = await fetchMe()
        if (!cancelled) {
          setUser(u)
        }
      } catch {
        clearAccessToken()
        if (!cancelled) {
          setUser(null)
        }
      } finally {
        if (!cancelled) {
          setReady(true)
        }
      }
    }
    void run()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (loginStr: string, password: string) => {
    setAuthError(null)
    try {
      const r = await postAuthLogin({
        login: loginStr.trim(),
        password,
      })
      setAccessToken(r.accessToken)
      setUser(r.user)
    } catch (e) {
      setAuthError(e instanceof Error ? e.message : 'Ошибка входа')
      throw e
    }
  }, [])

  const register = useCallback(
    async (params: { email: string; phone: string; password: string }) => {
      setAuthError(null)
      const body: { email?: string; phone?: string; password: string } = {
        password: params.password,
      }
      const e = params.email.trim()
      const p = params.phone.trim()
      if (e) {
        body.email = e
      }
      if (p) {
        body.phone = p
      }
      try {
        const r = await postAuthRegister(body)
        setAccessToken(r.accessToken)
        setUser(r.user)
      } catch (err) {
        setAuthError(
          err instanceof Error ? err.message : 'Ошибка регистрации',
        )
        throw err
      }
    },
    [],
  )

  const logout = useCallback(() => {
    clearAccessToken()
    setUser(null)
  }, [])

  const clearAuthError = useCallback(() => setAuthError(null), [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      ready,
      login,
      register,
      logout,
      authError,
      clearAuthError,
    }),
    [user, ready, login, register, logout, authError, clearAuthError],
  )

  return (
    <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
  )
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return ctx
}
