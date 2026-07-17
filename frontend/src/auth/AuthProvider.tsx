import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  fetchMe,
  postAuthLogin,
  postAuthRegister,
  postAuthVk,
  postAuthYandex,
} from '../api/auth'
import type { AuthUser } from '../types/api.types'
import { AuthContext, type AuthContextValue } from './auth-state'
import { takeVkCodeVerifier } from './vkPkce'
import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from './tokenStorage'

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

  const loginWithVk = useCallback(
    async (params: {
      code: string
      deviceId: string
      state: string
      redirectUri: string
    }) => {
      setAuthError(null)
      const codeVerifier = takeVkCodeVerifier()
      if (!codeVerifier) {
        const msg = 'Сессия VK ID истекла — обновите страницу'
        setAuthError(msg)
        throw new Error(msg)
      }
      try {
        const r = await postAuthVk({
          code: params.code,
          deviceId: params.deviceId,
          codeVerifier,
          state: params.state,
          redirectUri: params.redirectUri,
        })
        setAccessToken(r.accessToken)
        setUser(r.user)
      } catch (e) {
        setAuthError(e instanceof Error ? e.message : 'Ошибка входа')
        throw e
      }
    },
    [],
  )

  const loginWithYandex = useCallback(
    async (params: { code: string; codeVerifier: string; state?: string }) => {
      setAuthError(null)
      try {
        const r = await postAuthYandex({
          code: params.code,
          codeVerifier: params.codeVerifier,
          state: params.state,
        })
        setAccessToken(r.accessToken)
        setUser(r.user)
      } catch (e) {
        setAuthError(
          e instanceof Error ? e.message : 'Ошибка входа через Яндекс',
        )
        throw e
      }
    },
    [],
  )

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
        setAuthError(err instanceof Error ? err.message : 'Ошибка регистрации')
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
      loginWithVk,
      loginWithYandex,
      login,
      register,
      logout,
      authError,
      clearAuthError,
    }),
    [
      user,
      ready,
      loginWithVk,
      loginWithYandex,
      login,
      register,
      logout,
      authError,
      clearAuthError,
    ],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
