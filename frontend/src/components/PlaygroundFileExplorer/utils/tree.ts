import type { ExplorerFolderNode } from '../types/playgroundFileExplorer.types'
import { getFolderAncestors, getFoldersForFile, getParentPath } from './paths'

export function buildExplorerTree(
  filePaths: string[],
  folderPaths: string[],
): ExplorerFolderNode {
  const root: ExplorerFolderNode = {
    kind: 'folder',
    path: '/',
    name: '/',
    folders: [],
    files: [],
  }
  const folderMap = new Map<string, ExplorerFolderNode>([['/', root]])

  const ensureFolder = (folderPath: string): ExplorerFolderNode => {
    const existing = folderMap.get(folderPath)
    if (existing) {
      return existing
    }

    const node: ExplorerFolderNode = {
      kind: 'folder',
      path: folderPath,
      name: folderPath.split('/').filter(Boolean).pop() || folderPath,
      folders: [],
      files: [],
    }

    folderMap.set(folderPath, node)
    const parent = ensureFolder(getParentPath(folderPath))
    parent.folders.push(node)
    return node
  }

  folderPaths.forEach((folderPath) => {
    getFolderAncestors(folderPath).forEach((path) => {
      ensureFolder(path)
    })
  })

  filePaths.forEach((filePath) => {
    getFoldersForFile(filePath).forEach((folderPath) => {
      ensureFolder(folderPath)
    })

    const parent = ensureFolder(getParentPath(filePath))
    parent.files.push({
      kind: 'file',
      path: filePath,
      name: filePath.split('/').pop() || filePath,
    })
  })

  const sortFolder = (folder: ExplorerFolderNode) => {
    folder.folders.sort((a, b) => a.name.localeCompare(b.name))
    folder.files.sort((a, b) => a.name.localeCompare(b.name))
    folder.folders.forEach(sortFolder)
  }

  sortFolder(root)
  return root
}
