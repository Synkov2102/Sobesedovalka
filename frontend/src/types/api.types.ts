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
