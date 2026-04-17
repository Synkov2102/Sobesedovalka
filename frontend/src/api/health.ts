import { API_PREFIX } from './constants'
import type { HealthPayload } from '../types/api.types'

export async function fetchHealth(): Promise<HealthPayload> {
  const res = await fetch(`${API_PREFIX}/health`)
  if (!res.ok) {
    throw new Error(String(res.status))
  }
  return (await res.json()) as HealthPayload
}
