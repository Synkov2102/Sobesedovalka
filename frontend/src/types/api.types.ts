export type Task = {
  id: string
  title: string
  createdAt: string
}

export type HealthPayload = {
  ok: boolean
  service: string
}

export type MainTab = 'playground' | 'api'

export type AuthUser = {
  id: string
  email?: string
  phone?: string
}

export type AuthLoginResponse = {
  accessToken: string
  user: AuthUser
}
