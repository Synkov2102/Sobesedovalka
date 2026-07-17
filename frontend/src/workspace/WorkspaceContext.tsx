import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import {
  getFoldersForFile,
  normalizeNewFolderPath,
} from '../components/PlaygroundFileExplorer/utils/paths'
import { normalizeWorkspacePath } from './workspacePaths'

export type WorkspaceContextValue = {
  files: Record<string, string>
  filePaths: string[]
  folderPaths: string[]
  activeFile: string
  snapshotReady: boolean
  setWorkspaceSnapshot: (
    files: Record<string, string>,
    folders?: string[],
  ) => void
  updateWorkspaceFile: (path: string, content: string) => void
  deleteWorkspaceFile: (path: string) => void
  openFile: (path: string) => void
  syncFolders: (folders: string[], nextFilePaths?: string[]) => void
}

const WorkspaceContext = createContext<WorkspaceContextValue | null>(null)

function sortPaths(paths: string[]): string[] {
  return Array.from(new Set(paths)).sort((a, b) => a.localeCompare(b))
}

function normalizeFolderList(
  filePaths: string[],
  folders: readonly string[],
): string[] {
  const normalized = new Set<string>()
  folders.forEach((folderPath) => {
    const path = normalizeNewFolderPath(folderPath)
    if (path) {
      normalized.add(path)
    }
  })
  filePaths.forEach((filePath) => {
    getFoldersForFile(filePath).forEach((folderPath) => {
      normalized.add(folderPath)
    })
  })
  return Array.from(normalized).sort((a, b) => a.localeCompare(b))
}

export function WorkspaceProvider({
  initialFiles,
  initialFolders = [],
  children,
}: {
  initialFiles: Record<string, string>
  initialFolders?: string[]
  children?: ReactNode
}) {
  const initialPaths = useMemo(
    () => sortPaths(Object.keys(initialFiles).map(normalizeWorkspacePath)),
    [initialFiles],
  )
  const [files, setFiles] = useState<Record<string, string>>(initialFiles)
  const [filePaths, setFilePaths] = useState<string[]>(initialPaths)
  const [folderPaths, setFolderPaths] = useState<string[]>(
    normalizeFolderList(initialPaths, initialFolders),
  )
  const [activeFile, setActiveFile] = useState<string>(
    initialPaths.includes('/App.tsx') ? '/App.tsx' : (initialPaths[0] ?? ''),
  )
  const [snapshotReady, setSnapshotReady] = useState(true)
  const filesRef = useRef(files)
  const filePathsRef = useRef(filePaths)
  const folderPathsRef = useRef(folderPaths)

  const syncStateRefs = useCallback(
    (
      nextFiles: Record<string, string>,
      nextFilePaths: string[],
      nextFolderPaths: string[],
    ) => {
      filesRef.current = nextFiles
      filePathsRef.current = nextFilePaths
      folderPathsRef.current = nextFolderPaths
    },
    [],
  )

  const setWorkspaceSnapshot = useCallback(
    (nextRawFiles: Record<string, string>, folders: string[] = []) => {
      const nextFiles: Record<string, string> = {}
      for (const [path, content] of Object.entries(nextRawFiles)) {
        const normalized = normalizeWorkspacePath(path)
        if (normalized) {
          nextFiles[normalized] = content
        }
      }
      const nextFilePaths = sortPaths(Object.keys(nextFiles))
      const nextFolders = normalizeFolderList(nextFilePaths, folders)
      syncStateRefs(nextFiles, nextFilePaths, nextFolders)
      setFiles(nextFiles)
      setFilePaths(nextFilePaths)
      setFolderPaths(nextFolders)
      setSnapshotReady(true)
      setActiveFile((current) =>
        current && nextFiles[current] !== undefined
          ? current
          : nextFilePaths.includes('/App.tsx')
            ? '/App.tsx'
            : (nextFilePaths[0] ?? ''),
      )
    },
    [syncStateRefs],
  )

  const updateWorkspaceFile = useCallback(
    (path: string, content: string) => {
      const normalized = normalizeWorkspacePath(path)
      if (!normalized) {
        return
      }
      const nextFiles = { ...filesRef.current, [normalized]: content }
      const nextFilePaths = sortPaths([...filePathsRef.current, normalized])
      const nextFolders = normalizeFolderList(
        nextFilePaths,
        folderPathsRef.current,
      )
      syncStateRefs(nextFiles, nextFilePaths, nextFolders)
      setFiles(nextFiles)
      setFilePaths(nextFilePaths)
      setFolderPaths(nextFolders)
    },
    [syncStateRefs],
  )

  const deleteWorkspaceFile = useCallback(
    (path: string) => {
      const normalized = normalizeWorkspacePath(path)
      if (!normalized) {
        return
      }
      const nextFiles = { ...filesRef.current }
      delete nextFiles[normalized]
      const nextFilePaths = filePathsRef.current.filter(
        (entry) => entry !== normalized,
      )
      const nextFolders = normalizeFolderList(
        nextFilePaths,
        folderPathsRef.current,
      )
      syncStateRefs(nextFiles, nextFilePaths, nextFolders)
      setFiles(nextFiles)
      setFilePaths(nextFilePaths)
      setFolderPaths(nextFolders)
      setActiveFile((current) =>
        current === normalized
          ? nextFilePaths.includes('/App.tsx')
            ? '/App.tsx'
            : (nextFilePaths[0] ?? '')
          : current,
      )
    },
    [syncStateRefs],
  )

  const openFile = useCallback((path: string) => {
    const normalized = normalizeWorkspacePath(path)
    if (normalized && filesRef.current[normalized] !== undefined) {
      setActiveFile(normalized)
    }
  }, [])

  const syncFolders = useCallback(
    (folders: string[], nextFilePaths?: string[]) => {
      const baseFiles = nextFilePaths ?? filePathsRef.current
      const nextFolders = normalizeFolderList(baseFiles, folders)
      folderPathsRef.current = nextFolders
      setFolderPaths(nextFolders)
    },
    [],
  )

  const value = useMemo<WorkspaceContextValue>(
    () => ({
      files,
      filePaths,
      folderPaths,
      activeFile,
      snapshotReady,
      setWorkspaceSnapshot,
      updateWorkspaceFile,
      deleteWorkspaceFile,
      openFile,
      syncFolders,
    }),
    [
      activeFile,
      deleteWorkspaceFile,
      filePaths,
      files,
      folderPaths,
      openFile,
      setWorkspaceSnapshot,
      snapshotReady,
      syncFolders,
      updateWorkspaceFile,
    ],
  )

  return (
    <WorkspaceContext.Provider value={value}>
      {children ?? null}
    </WorkspaceContext.Provider>
  )
}

export function useWorkspace(): WorkspaceContextValue {
  const value = useContext(WorkspaceContext)
  if (!value) {
    throw new Error('useWorkspace must be used inside WorkspaceProvider')
  }
  return value
}
