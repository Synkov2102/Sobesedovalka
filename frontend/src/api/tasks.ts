import { API_PREFIX } from './constants'
import type { Task } from '../types/api.types'

export async function fetchTasks(): Promise<Task[]> {
  const res = await fetch(`${API_PREFIX}/tasks`)
  if (!res.ok) {
    throw new Error(String(res.status))
  }
  return (await res.json()) as Task[]
}

export async function createTask(title: string): Promise<void> {
  const res = await fetch(`${API_PREFIX}/tasks`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title }),
  })
  if (!res.ok) {
    throw new Error(String(res.status))
  }
}

/** 204 or 404 are treated as success (idempotent delete). */
export async function deleteTask(id: string): Promise<void> {
  const res = await fetch(`${API_PREFIX}/tasks/${id}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 404) {
    throw new Error(String(res.status))
  }
}
