import { createContext } from 'react'
import type { AuthUser } from '../types/api.types'

export type AuthContextValue = {
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

export const AuthContext = createContext<AuthContextValue | null>(null)
