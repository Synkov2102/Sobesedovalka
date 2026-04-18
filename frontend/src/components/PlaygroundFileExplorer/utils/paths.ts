import { EMPTY_FOLDER_MARKER } from '../constants/playgroundFileExplorer.constants'

export function normalizeNewFilePath(input: string): string | null {
  let p = input.trim().replace(/\\/g, '/')
  if (!p) {
    return null
  }
  p = p.replace(/^\/+/, '')
  if (!p) {
    return null
  }
  p = `/${p}`
  return p
}

export function normalizeNewFolderPath(input: string): string | null {
  let p = input.trim().replace(/\\/g, '/')
  if (!p) {
    return null
  }
  p = p.replace(/^\/+/, '').replace(/\/+$/, '')
  if (!p) {
    return null
  }
  return `/${p}`
}

export function getParentPath(path: string): string {
  const parts = path
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .split('/')
    .filter(Boolean)
  if (parts.length <= 1) {
    return '/'
  }
  return `/${parts.slice(0, -1).join('/')}`
}

export function getFolderAncestors(path: string): string[] {
  const parts = path
    .replace(/^\/+/, '')
    .replace(/\/+$/, '')
    .split('/')
    .filter(Boolean)
  const folders: string[] = []
  for (let i = 0; i < parts.length; i += 1) {
    folders.push(`/${parts.slice(0, i + 1).join('/')}`)
  }
  return folders
}

export function getFoldersForFile(filePath: string): string[] {
  const folderPath = getParentPath(filePath)
  return folderPath === '/' ? [] : getFolderAncestors(folderPath)
}

export function joinEntryPath(parentPath: string, entryName: string): string {
  const normalized = entryName.trim().replace(/\\/g, '/').replace(/^\/+/, '')
  if (parentPath === '/') {
    return normalized
  }
  return `${parentPath.replace(/^\/+/, '')}/${normalized}`
}

export function folderMarkerPath(folderPath: string): string {
  return `${folderPath}/${EMPTY_FOLDER_MARKER}`.replace(/\/+/g, '/')
}

export function isFolderMarkerPath(filePath: string): boolean {
  return filePath.endsWith(`/${EMPTY_FOLDER_MARKER}`)
}

export function isPathInFolder(path: string, folderPath: string): boolean {
  if (folderPath === '/') {
    return true
  }
  return path === folderPath || path.startsWith(`${folderPath}/`)
}

export function replacePathPrefix(
  path: string,
  fromPath: string,
  toPath: string,
): string {
  if (path === fromPath) {
    return toPath
  }
  return `${toPath}${path.slice(fromPath.length)}`
}

export function joinFolderWithName(
  parentPath: string,
  name: string,
): string | null {
  return normalizeNewFolderPath(joinEntryPath(parentPath, name))
}

export function joinFileWithName(
  parentPath: string,
  name: string,
): string | null {
  return normalizeNewFilePath(joinEntryPath(parentPath, name))
}

export function getEntryName(path: string): string {
  return path.replace(/\/+$/, '').split('/').filter(Boolean).pop() || path
}

export function splitFileName(fileName: string): {
  stem: string
  extension: string
} {
  const lastDotIndex = fileName.lastIndexOf('.')
  if (lastDotIndex <= 0) {
    return {
      stem: fileName,
      extension: '',
    }
  }

  return {
    stem: fileName.slice(0, lastDotIndex),
    extension: fileName.slice(lastDotIndex),
  }
}
