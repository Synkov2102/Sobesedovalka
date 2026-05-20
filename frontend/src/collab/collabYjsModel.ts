import type * as Y from 'yjs'
import { collabSyncLog } from './collabSyncLog'
import { normalizeSandpackFilePath } from './sandpackPaths'

export const Y_FILES_MAP = 'files'
export const Y_FOLDERS_ARRAY = 'folders'

export function yTextName(path: string): string {
  return `file:${path}`
}

export function getYFilesMap(doc: Y.Doc): Y.Map<boolean> {
  return doc.getMap<boolean>(Y_FILES_MAP)
}

export function getYFoldersArray(doc: Y.Doc): Y.Array<string> {
  return doc.getArray<string>(Y_FOLDERS_ARRAY)
}

export function getYFileText(doc: Y.Doc, path: string): Y.Text {
  return doc.getText(yTextName(normalizeSandpackFilePath(path)))
}

export function readYjsFiles(doc: Y.Doc): Record<string, string> {
  const files: Record<string, string> = {}
  for (const path of getYFilesMap(doc).keys()) {
    files[path] = getYFileText(doc, path).toJSON()
  }
  return files
}

export function readYjsFolders(doc: Y.Doc): string[] {
  return getYFoldersArray(doc).toArray()
}

export function replaceYText(text: Y.Text, content: string): void {
  syncYTextToContent(text, content)
}

export function syncYTextToContent(text: Y.Text, content: string): void {
  const current = text.toJSON()
  if (current === content) {
    collabSyncLog('yjs-model', 'sync-text-skip-unchanged', {
      len: content.length,
    })
    return
  }

  let prefix = 0
  const maxPrefix = Math.min(current.length, content.length)
  while (prefix < maxPrefix && current[prefix] === content[prefix]) {
    prefix += 1
  }

  let currentSuffix = current.length
  let nextSuffix = content.length
  while (
    currentSuffix > prefix &&
    nextSuffix > prefix &&
    current[currentSuffix - 1] === content[nextSuffix - 1]
  ) {
    currentSuffix -= 1
    nextSuffix -= 1
  }

  const deleteCount = currentSuffix - prefix
  const insertText = content.slice(prefix, nextSuffix)
  collabSyncLog('yjs-model', 'sync-text-diff', {
    currentLen: current.length,
    nextLen: content.length,
    prefix,
    deleteCount,
    insertLen: insertText.length,
  })
  if (deleteCount > 0) {
    text.delete(prefix, deleteCount)
  }
  if (insertText.length > 0) {
    text.insert(prefix, insertText)
  }
}

export function replaceYArray<T>(array: Y.Array<T>, values: T[]): void {
  array.delete(0, array.length)
  if (values.length > 0) {
    array.push(values)
  }
}
