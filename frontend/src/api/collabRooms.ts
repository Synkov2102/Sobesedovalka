import type {
  CollabPageLeaveEvent,
  CollabPasteEvent,
  CollabRoomSummary,
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

export async function fetchCollabRooms(): Promise<CollabRoomSummary[]> {
  const res = await apiFetch('/collab-rooms')
  if (!res.ok) {
    throw new Error(await readApiError(res))
  }
  return (await res.json()) as CollabRoomSummary[]
}

export async function createCollabRoom(): Promise<CollabRoomSummary> {
  const res = await apiFetch('/collab-rooms', { method: 'POST' })
  if (!res.ok) {
    throw new Error(await readApiError(res))
  }
  return (await res.json()) as CollabRoomSummary
}

export async function deleteCollabRoom(roomId: string): Promise<void> {
  const encoded = encodeURIComponent(roomId)
  const res = await apiFetch(`/collab-rooms/${encoded}`, {
    method: 'DELETE',
  })
  if (!res.ok && res.status !== 404) {
    throw new Error(await readApiError(res))
  }
}

export async function fetchCollabPasteEvents(
  roomId: string,
): Promise<CollabPasteEvent[]> {
  const encoded = encodeURIComponent(roomId)
  const res = await apiFetch(`/collab-rooms/${encoded}/paste-events`)
  if (!res.ok) {
    throw new Error(await readApiError(res))
  }
  return (await res.json()) as CollabPasteEvent[]
}

export async function fetchCollabPageLeaveEvents(
  roomId: string,
): Promise<CollabPageLeaveEvent[]> {
  const encoded = encodeURIComponent(roomId)
  const res = await apiFetch(`/collab-rooms/${encoded}/page-leave-events`)
  if (!res.ok) {
    throw new Error(await readApiError(res))
  }
  return (await res.json()) as CollabPageLeaveEvent[]
}
