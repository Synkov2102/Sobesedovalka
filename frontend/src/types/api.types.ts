export type Task = {
  id: string
  title: string
  createdAt: string
}

export type TaskPresetFile = {
  path: string
  content: string
}

export type TaskPreset = {
  id: string
  title: string
  description: string
  files: Record<string, string>
  folders: string[]
  createdAt: string
  updatedAt: string
}

export type HealthPayload = {
  ok: boolean
  service: string
}

export type MainTab = 'playground' | 'api' | 'presets'

export type AuthUser = {
  id: string
  email?: string
  phone?: string
}

export type AuthLoginResponse = {
  accessToken: string
  user: AuthUser
}
