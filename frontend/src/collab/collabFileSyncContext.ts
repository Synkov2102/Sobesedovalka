import { createContext, useContext } from 'react'

export type CollabFileSyncContextValue = {
  emitFileChange: (path: string, content: string) => void
}

export const CollabFileSyncContext =
  createContext<CollabFileSyncContextValue | null>(null)

export function useCollabFileSync(): CollabFileSyncContextValue | null {
  return useContext(CollabFileSyncContext)
}

