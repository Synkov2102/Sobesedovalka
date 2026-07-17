import { createContext, useContext } from 'react'
import type * as Y from 'yjs'

export type CollabYDocContextValue = {
  doc: Y.Doc | null
  synced: boolean
}

export const CollabYDocContext = createContext<CollabYDocContextValue>({
  doc: null,
  synced: false,
})

export function useCollabYDoc(): CollabYDocContextValue {
  return useContext(CollabYDocContext)
}
