import { useCallback } from 'react'
import type { ContextMenuTarget } from '../types/playgroundFileExplorer.types'
import {
  getEntryName,
  getFolderAncestors,
  getFoldersForFile,
  getParentPath,
  isPathInFolder,
  joinFileWithName,
  joinFolderWithName,
  replacePathPrefix,
  splitFileName,
} from '../utils/paths'
import { sortPaths, sortUniqueFolderPaths } from '../utils/sort'

type SandpackLike = {
  files: Record<string, string | undefined>
  updateFile: (path: string, code: string) => void
  deleteFile: (path: string) => void
  openFile: (path: string) => void
}

export function useExplorerFsOps({
  sandpack,
  active,
  filePaths,
  folderPaths,
  filePathSet,
  folderPathSet,
  syncFolders,
  saveFile,
  removeFile,
  canRenameFile,
  canRenameFolder,
  closeContextMenu,
  setFocusedPath,
  setCollapsedFolders,
}: {
  sandpack: SandpackLike
  active: string
  filePaths: string[]
  folderPaths: string[]
  filePathSet: Set<string>
  folderPathSet: Set<string>
  syncFolders: (folders: string[], files?: string[]) => void
  saveFile: (path: string, code: string) => void
  removeFile: (path: string) => void
  canRenameFile: (path: string) => boolean
  canRenameFolder: (path: string) => boolean
  closeContextMenu: () => void
  setFocusedPath: (path: string) => void
  setCollapsedFolders: (updater: (prev: string[]) => string[]) => void
}) {
  const mergeFolderPaths = useCallback(
    (extraPaths: string[]) =>
      sortUniqueFolderPaths([...folderPaths, ...extraPaths]),
    [folderPaths],
  )

  const deleteWorkspaceFiles = useCallback(
    (paths: string[]) => {
      const entries = paths
        .filter((path) => sandpack.files[path] !== undefined)
        .sort((a, b) => b.length - a.length)

      entries.forEach((path) => {
        sandpack.deleteFile(path)
      })
    },
    [sandpack],
  )

  const deletePath = useCallback(
    (target: ContextMenuTarget) => {
      if (target.kind === 'root') {
        return
      }

      if (target.kind === 'file') {
        if (!canRenameFile(target.path)) {
          return
        }
        removeFile(target.path)
        sandpack.deleteFile(target.path)
        closeContextMenu()
        return
      }

      if (!canRenameFolder(target.path)) {
        return
      }

      const nextFolders = folderPaths.filter(
        (path) => !isPathInFolder(path, target.path),
      )
      const entries = filePaths.filter((path) =>
        isPathInFolder(path, target.path),
      )

      entries.forEach((path) => removeFile(path))
      syncFolders(
        nextFolders,
        filePaths.filter((path) => !isPathInFolder(path, target.path)),
      )
      deleteWorkspaceFiles(entries)
      closeContextMenu()
    },
    [
      canRenameFile,
      canRenameFolder,
      closeContextMenu,
      deleteWorkspaceFiles,
      filePaths,
      folderPaths,
      removeFile,
      sandpack,
      syncFolders,
    ],
  )

  const moveFilePath = useCallback(
    (fromPath: string, targetParentPath: string, nextName?: string) => {
      const source = sandpack.files[fromPath]
      if (source === undefined) {
        return null
      }

      const sourceParentPath = getParentPath(fromPath)
      const fileName = nextName ?? getEntryName(fromPath)
      const initialPath = joinFileWithName(targetParentPath, fileName)
      if (!initialPath || initialPath === fromPath) {
        return null
      }

      let nextPath = initialPath
      if (filePathSet.has(nextPath)) {
        if (nextName) {
          return null
        }
        const { stem, extension } = splitFileName(fileName)
        let suffix = 1

        do {
          const candidateName = `${stem}(${suffix})${extension}`
          const candidatePath = joinFileWithName(
            targetParentPath,
            candidateName,
          )
          if (!candidatePath) {
            return null
          }
          nextPath = candidatePath
          suffix += 1
        } while (filePathSet.has(nextPath))
      }

      const nextFilePaths = sortPaths(
        filePaths.filter((path) => path !== fromPath).concat(nextPath),
      )
      const nextFolders = mergeFolderPaths([
        ...getFoldersForFile(nextPath),
        ...(sourceParentPath === '/'
          ? []
          : getFolderAncestors(sourceParentPath)),
      ])

      saveFile(nextPath, source ?? '')
      removeFile(fromPath)
      syncFolders(nextFolders, nextFilePaths)
      sandpack.updateFile(nextPath, source ?? '')
      sandpack.deleteFile(fromPath)

      if (active === fromPath) {
        sandpack.openFile(nextPath)
      }

      setFocusedPath(nextPath)
      return nextPath
    },
    [
      active,
      filePathSet,
      filePaths,
      mergeFolderPaths,
      removeFile,
      sandpack,
      saveFile,
      setFocusedPath,
      syncFolders,
    ],
  )

  const moveFolderPath = useCallback(
    (fromPath: string, targetParentPath: string, nextName?: string) => {
      if (
        targetParentPath === fromPath ||
        isPathInFolder(targetParentPath, fromPath)
      ) {
        return null
      }

      const nextFolderPath = joinFolderWithName(
        targetParentPath,
        nextName ?? getEntryName(fromPath),
      )
      if (!nextFolderPath || nextFolderPath === fromPath) {
        return null
      }

      const entriesToMove = filePaths.filter((path) =>
        isPathInFolder(path, fromPath),
      )
      const movingSet = new Set(entriesToMove)
      const nextEntries = entriesToMove.map((path) =>
        replacePathPrefix(path, fromPath, nextFolderPath),
      )

      if (
        nextEntries.some(
          (path) => filePathSet.has(path) && !movingSet.has(path),
        )
      ) {
        return null
      }

      const movingFolders = folderPaths.filter((path) =>
        isPathInFolder(path, fromPath),
      )
      const movingFolderSet = new Set(movingFolders)
      if (
        folderPathSet.has(nextFolderPath) &&
        !movingFolderSet.has(nextFolderPath)
      ) {
        return null
      }

      const nextFolders = sortUniqueFolderPaths([
        ...folderPaths
          .filter((path) => !isPathInFolder(path, fromPath))
          .map((path) => path),
        ...movingFolders.map((path) =>
          replacePathPrefix(path, fromPath, nextFolderPath),
        ),
        ...getFolderAncestors(nextFolderPath),
      ])

      const nextFilePaths = sortPaths(
        filePaths.map((path) =>
          isPathInFolder(path, fromPath)
            ? replacePathPrefix(path, fromPath, nextFolderPath)
            : path,
        ),
      )

      entriesToMove.forEach((path) => {
        const nextPath = replacePathPrefix(path, fromPath, nextFolderPath)
        saveFile(nextPath, sandpack.files[path] ?? '')
      })
      entriesToMove.forEach((path) => removeFile(path))
      syncFolders(nextFolders, nextFilePaths)
      entriesToMove.forEach((path) => {
        const nextPath = replacePathPrefix(path, fromPath, nextFolderPath)
        sandpack.updateFile(nextPath, sandpack.files[path] ?? '')
      })
      deleteWorkspaceFiles(entriesToMove)

      if (active && isPathInFolder(active, fromPath)) {
        sandpack.openFile(replacePathPrefix(active, fromPath, nextFolderPath))
      }

      setCollapsedFolders((prev) => {
        const mapped = prev.map((path) =>
          isPathInFolder(path, fromPath)
            ? replacePathPrefix(path, fromPath, nextFolderPath)
            : path,
        )
        return Array.from(new Set(mapped))
      })
      setFocusedPath(nextFolderPath)
      return nextFolderPath
    },
    [
      active,
      deleteWorkspaceFiles,
      filePathSet,
      filePaths,
      folderPathSet,
      folderPaths,
      removeFile,
      sandpack,
      saveFile,
      setCollapsedFolders,
      setFocusedPath,
      syncFolders,
    ],
  )

  return { deletePath, moveFilePath, moveFolderPath }
}
