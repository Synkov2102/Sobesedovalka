import { createContext, useContext } from 'react'

export type CollabFsContextValue = {
  filePaths: string[]
  folderPaths: string[]
  snapshotReady: boolean
  syncFolders: (folders: string[], nextFilePaths?: string[]) => void
  saveFile: (path: string, content: string) => void
  removeFile: (path: string) => void
}

export const CollabFsContext = createContext<CollabFsContextValue | null>(null)

export function useCollabFs(): CollabFsContextValue {
  const value = useContext(CollabFsContext)
  if (!value) {
    throw new Error(
      'useCollabFs must be used inside CollabSync or LocalSandpackFsProvider',
    )
  }
  return value
}
