import { createContext, useContext } from 'react'

export type CollabPasteEventInput = {
  path: string
  content: string
  fileContent: string
  insertStartOffset: number
  insertEndOffset: number
  line: number
  col: number
}

export type CollabPasteContextValue = {
  recordPaste: (event: CollabPasteEventInput) => void
}

export const CollabPasteContext =
  createContext<CollabPasteContextValue | null>(null)

export function useCollabPaste(): CollabPasteContextValue | null {
  return useContext(CollabPasteContext)
}
