import { useMemo, type ReactNode } from 'react'
import {
  CollabFsContext,
  type CollabFsContextValue,
} from '../components/collabFsContext'
import { useWorkspace } from './WorkspaceContext'

export function WorkspaceCollabFsBridge({
  saveFile,
  removeFile,
  children,
}: {
  saveFile?: (path: string, content: string) => void
  removeFile?: (path: string) => void
  children?: ReactNode
}) {
  const workspace = useWorkspace()
  const value = useMemo<CollabFsContextValue>(
    () => ({
      filePaths: workspace.filePaths,
      folderPaths: workspace.folderPaths,
      snapshotReady: workspace.snapshotReady,
      syncFolders: workspace.syncFolders,
      saveFile: saveFile ?? workspace.updateWorkspaceFile,
      removeFile: removeFile ?? workspace.deleteWorkspaceFile,
    }),
    [
      removeFile,
      saveFile,
      workspace.deleteWorkspaceFile,
      workspace.filePaths,
      workspace.folderPaths,
      workspace.snapshotReady,
      workspace.syncFolders,
      workspace.updateWorkspaceFile,
    ],
  )

  return (
    <CollabFsContext.Provider value={value}>
      {children ?? null}
    </CollabFsContext.Provider>
  )
}

