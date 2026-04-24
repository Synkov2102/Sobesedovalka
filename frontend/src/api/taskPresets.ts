import type { TaskPreset, TaskPresetFile } from '../types/api.types'
import { apiFetch } from './apiFetch'

async function readApiError(res: Response): Promise<string> {
  try {
    const body: unknown = await res.json()
    if (body && typeof body === 'object' && 'message' in body) {
      const message = (body as { message: unknown }).message
      if (Array.isArray(message)) {
        return message.map(String).join(', ')
      }
      if (typeof message === 'string') {
        return message
      }
    }
  } catch {
    // ignore
  }

  return res.statusText || String(res.status)
}

type TaskPresetPayload = {
  title: string
  description?: string
  files: TaskPresetFile[]
}

export async function fetchTaskPresets(): Promise<TaskPreset[]> {
  const res = await apiFetch('/task-presets')
  if (!res.ok) {
    throw new Error(await readApiError(res))
  }
  return (await res.json()) as TaskPreset[]
}

export async function createTaskPreset(
  body: TaskPresetPayload,
): Promise<TaskPreset> {
  const res = await apiFetch('/task-presets', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(await readApiError(res))
  }
  return (await res.json()) as TaskPreset
}

export async function updateTaskPreset(
  id: string,
  body: Partial<TaskPresetPayload>,
): Promise<TaskPreset> {
  const res = await apiFetch(`/task-presets/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    throw new Error(await readApiError(res))
  }
  return (await res.json()) as TaskPreset
}

export async function deleteTaskPreset(id: string): Promise<void> {
  const res = await apiFetch(`/task-presets/${id}`, { method: 'DELETE' })
  if (!res.ok && res.status !== 404) {
    throw new Error(await readApiError(res))
  }
}

export async function startRoomFromPreset(
  id: string,
): Promise<{ roomId: string }> {
  const res = await apiFetch(`/task-presets/${id}/start-room`, {
    method: 'POST',
  })
  if (!res.ok) {
    throw new Error(await readApiError(res))
  }
  return (await res.json()) as { roomId: string }
}
