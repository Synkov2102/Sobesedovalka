import type {
  RoomSolutionResponse,
  TaskPreset,
  TaskPresetFile,
  TaskPresetVisibility,
} from '../types/api.types'
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

export type TaskPresetPayload = {
  title: string
  description?: string
  files: TaskPresetFile[]
  solutionFiles?: TaskPresetFile[]
  visibility?: TaskPresetVisibility
  organizationId?: string
}

function encPresetId(id: string): string {
  return encodeURIComponent(id)
}

export async function fetchTaskPresets(): Promise<TaskPreset[]> {
  const res = await apiFetch('/task-presets')
  if (!res.ok) {
    throw new Error(await readApiError(res))
  }
  return (await res.json()) as TaskPreset[]
}

export async function fetchTaskPreset(id: string): Promise<TaskPreset> {
  const res = await apiFetch(`/task-presets/${encPresetId(id)}`)
  if (!res.ok) {
    throw new Error(await readApiError(res))
  }
  return (await res.json()) as TaskPreset
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
  const res = await apiFetch(`/task-presets/${encPresetId(id)}`, {
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
  const res = await apiFetch(`/task-presets/${encPresetId(id)}`, {
    method: 'DELETE',
  })
  if (!res.ok && res.status !== 404) {
    throw new Error(await readApiError(res))
  }
}

export async function cloneTaskPreset(id: string): Promise<TaskPreset> {
  const res = await apiFetch(`/task-presets/${encPresetId(id)}/clone`, {
    method: 'POST',
  })
  if (!res.ok) {
    throw new Error(await readApiError(res))
  }
  return (await res.json()) as TaskPreset
}

export async function startRoomFromPreset(
  id: string,
): Promise<{ roomId: string }> {
  const res = await apiFetch(`/task-presets/${encPresetId(id)}/start-room`, {
    method: 'POST',
  })
  if (!res.ok) {
    throw new Error(await readApiError(res))
  }
  return (await res.json()) as { roomId: string }
}

export async function fetchCollabRoomReady(roomId: string): Promise<boolean> {
  const enc = encodeURIComponent(roomId)
  const res = await apiFetch(`/task-presets/collab-room/${enc}`)
  if (!res.ok) {
    throw new Error(await readApiError(res))
  }
  const body = (await res.json()) as { ready?: unknown }
  return body.ready === true
}

export async function fetchRoomSolution(
  roomId: string,
): Promise<RoomSolutionResponse | null> {
  const enc = encodeURIComponent(roomId)
  const res = await apiFetch(`/task-presets/collab-room/${enc}/solution`)
  if (res.status === 403 || res.status === 404) {
    return null
  }
  if (!res.ok) {
    throw new Error(await readApiError(res))
  }
  return (await res.json()) as RoomSolutionResponse
}
