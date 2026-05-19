import {
  startTransition,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useSandpack } from '@codesandbox/sandpack-react'
import { normalizeSandpackFilePath } from '../collab/sandpackPaths'
import { CollabFsContext, type CollabFsContextValue } from './collabFsContext'
import { readSandpackFileCode } from '../sandbox/sandpackCode'
import {
  getFoldersForFile,
  normalizeNewFolderPath,
} from './PlaygroundFileExplorer/utils/paths'

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

/**
 * Локальный провайдер файловой модели для Sandpack без коллаборации —
 * тот же контекст, что и у CollabSync, чтобы работал PlaygroundFileExplorer.
 */
export function LocalSandpackFsProvider({
  children,
}: {
  children?: ReactNode
}) {
  const { sandpack } = useSandpack()
  const [snapshotReady, setSnapshotReady] = useState(false)
  const [filePaths, setFilePaths] = useState<string[]>([])
  const [folderPaths, setFolderPaths] = useState<string[]>([])
  const filePathsRef = useRef<string[]>([])
  const folderPathsRef = useRef<string[]>([])
  const snapshotStartedRef = useRef(false)

  useLayoutEffect(() => {
    filePathsRef.current = filePaths
  }, [filePaths])

  useLayoutEffect(() => {
    folderPathsRef.current = folderPaths
  }, [folderPaths])

  useEffect(() => {
    if (sandpack.status !== 'running' || snapshotStartedRef.current) {
      return
    }
    snapshotStartedRef.current = true

    const paths = Object.keys(sandpack.files)
      .filter((path) => {
        const raw = sandpack.files[path]
        if (raw == null || typeof raw !== 'object') {
          return false
        }
        if ('hidden' in raw && (raw as { hidden?: boolean }).hidden) {
          return false
        }
        return readSandpackFileCode(raw) !== undefined
      })
      .map((path) => normalizeSandpackFilePath(path))
      .filter((path): path is string => Boolean(path))

    const sorted = sortPaths(paths)
    const folders = normalizeFolderList(sorted, [])
    filePathsRef.current = sorted
    folderPathsRef.current = folders
    startTransition(() => {
      setFilePaths(sorted)
      setFolderPaths(folders)
      setSnapshotReady(true)
    })
  }, [sandpack.status, sandpack.files])

  const syncFolders = useCallback(
    (folders: string[], nextFilePaths?: string[]) => {
      const baseFiles = nextFilePaths ?? filePathsRef.current
      const nextFolders = normalizeFolderList(baseFiles, folders)
      folderPathsRef.current = nextFolders
      setFolderPaths(nextFolders)
    },
    [],
  )

  const saveFile = useCallback((path: string, content: string) => {
    void content
    const normalizedPath = normalizeSandpackFilePath(path)
    if (!normalizedPath) {
      return
    }

    const nextFilePaths = sortPaths([...filePathsRef.current, normalizedPath])
    filePathsRef.current = nextFilePaths
    setFilePaths(nextFilePaths)

    const nextFolders = normalizeFolderList(
      nextFilePaths,
      folderPathsRef.current,
    )
    folderPathsRef.current = nextFolders
    setFolderPaths(nextFolders)
  }, [])

  const removeFile = useCallback((path: string) => {
    const normalizedPath = normalizeSandpackFilePath(path)
    if (!normalizedPath) {
      return
    }

    const nextFilePaths = filePathsRef.current.filter(
      (entry) => entry !== normalizedPath,
    )
    filePathsRef.current = nextFilePaths
    setFilePaths(nextFilePaths)

    const nextFolders = normalizeFolderList(
      nextFilePaths,
      folderPathsRef.current,
    )
    folderPathsRef.current = nextFolders
    setFolderPaths(nextFolders)
  }, [])

  const contextValue = useMemo<CollabFsContextValue>(
    () => ({
      filePaths,
      folderPaths,
      snapshotReady,
      syncFolders,
      saveFile,
      removeFile,
    }),
    [filePaths, folderPaths, snapshotReady, syncFolders, saveFile, removeFile],
  )

  return (
    <CollabFsContext.Provider value={contextValue}>
      {children ?? null}
    </CollabFsContext.Provider>
  )
}
