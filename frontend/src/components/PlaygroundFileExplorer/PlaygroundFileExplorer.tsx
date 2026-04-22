import { useCallback, useMemo, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { useSandpack } from '@codesandbox/sandpack-react'
import { useCollabFs } from '../CollabSync'
import type { CollabPeerDTO } from '../../collab/collab.types'
import { peerAccentRgbCss, peerAccentRgbaCss } from '../../collab/peerColor'
import { normalizeSandpackFilePath } from '../../collab/sandpackPaths'
import { VITE_REACT_TS_PROTECTED } from './constants/playgroundFileExplorer.constants'
import { useClearDropTargetWhenNoDrag } from './hooks/useDragDropUiSync'
import { useCopiedPathReset } from './hooks/useCopiedPathReset'
import { useContextMenuDismiss } from './hooks/useContextMenuDismiss'
import { useDraftInputFocus } from './hooks/useDraftInputFocus'
import type {
  ContextMenuState,
  ContextMenuTarget,
  DragItem,
  ExplorerDraft,
  ExplorerFileNode,
  ExplorerFolderNode,
} from './types/playgroundFileExplorer.types'
import { writeToClipboard } from './utils/clipboard'
import { defaultComponentSource } from './utils/source'
import { buildExplorerTree } from './utils/tree'
import { getFileIconSpec } from './utils/fileIcon'
import {
  getEntryName,
  getFolderAncestors,
  getFoldersForFile,
  getParentPath,
  isPathInFolder,
  joinEntryPath,
  joinFileWithName,
  joinFolderWithName,
  normalizeNewFilePath,
  normalizeNewFolderPath,
  replacePathPrefix,
  splitFileName,
} from './utils/paths'
import './PlaygroundFileExplorer.css'

function FileTypeIcon({ filePath }: { filePath: string }) {
  const spec = getFileIconSpec(filePath)

  return (
    <span
      className={`playground__fileTypeIcon playground__fileTypeIcon--${spec.tone}`}
      title={spec.title}
      aria-hidden="true"
    >
      {spec.label}
    </span>
  )
}

function sortPaths(paths: string[]): string[] {
  return Array.from(new Set(paths)).sort((a, b) => a.localeCompare(b))
}

export function PlaygroundFileExplorer({
  collabPeers = [],
}: {
  collabPeers?: CollabPeerDTO[]
} = {}) {
  const { sandpack } = useSandpack()
  const { filePaths, folderPaths, snapshotReady, syncFolders, saveFile, removeFile } =
    useCollabFs()
  const editorInputRef = useRef<HTMLInputElement | null>(null)
  const draftSelectKeyRef = useRef<string | null>(null)
  const [collapsedFolders, setCollapsedFolders] = useState<string[]>([])
  const [draft, setDraft] = useState<ExplorerDraft | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [focusedPath, setFocusedPath] = useState('/')
  const [dragItem, setDragItem] = useState<DragItem | null>(null)
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null)
  const [copiedPath, setCopiedPath] = useState<string | null>(null)
  const active = normalizeSandpackFilePath(sandpack.activeFile ?? '')
  const filePathSet = useMemo(() => new Set(filePaths), [filePaths])
  const folderPathSet = useMemo(() => new Set(folderPaths), [folderPaths])
  const tree = useMemo(
    () => buildExplorerTree(filePaths, folderPaths),
    [filePaths, folderPaths],
  )

  const peersByActiveFile = useMemo(() => {
    const m = new Map<string, CollabPeerDTO[]>()
    for (const p of collabPeers) {
      const f = normalizeSandpackFilePath(p.activeFile)
      if (!f) {
        continue
      }
      const list = m.get(f)
      if (list) {
        list.push(p)
      } else {
        m.set(f, [p])
      }
    }
    for (const list of m.values()) {
      list.sort((a, b) =>
        a.displayName.localeCompare(b.displayName, undefined, {
          sensitivity: 'base',
        }),
      )
    }
    return m
  }, [collabPeers])

  const sortUniqueFolderPaths = useCallback((paths: string[]) => {
    return Array.from(
      new Set(paths.filter((path) => path.length > 0 && path !== '/')),
    ).sort((a, b) => a.localeCompare(b))
  }, [])

  const mergeFolderPaths = useCallback(
    (extraPaths: string[]) =>
      sortUniqueFolderPaths([...folderPaths, ...extraPaths]),
    [folderPaths, sortUniqueFolderPaths],
  )

  const canRenameFile = useCallback(
    (path: string) => !VITE_REACT_TS_PROTECTED.has(path),
    [],
  )

  const canRenameFolder = useCallback(
    (folderPath: string) =>
      folderPath !== '/' &&
      !filePaths.some(
        (path) =>
          isPathInFolder(path, folderPath) && VITE_REACT_TS_PROTECTED.has(path),
      ),
    [filePaths],
  )

  const closeContextMenu = useCallback(() => {
    setContextMenu(null)
  }, [])

  const cancelDraft = useCallback(() => {
    setDraft(null)
  }, [])

  const copyPath = useCallback(async (path: string) => {
    await writeToClipboard(path)
    setCopiedPath(path)
  }, [])

  const startCreate = useCallback(
    (kind: 'file' | 'folder', parentPath: string) => {
      setCollapsedFolders((prev) => prev.filter((path) => path !== parentPath))
      setFocusedPath(parentPath)
      setContextMenu(null)
      setDraft({
        mode: 'create',
        kind,
        parentPath,
        value: kind === 'file' ? 'NewFile.tsx' : 'New Folder',
      })
    },
    [],
  )

  const startRename = useCallback(
    (kind: 'file' | 'folder', path: string) => {
      if (kind === 'file' ? !canRenameFile(path) : !canRenameFolder(path)) {
        return
      }

      setFocusedPath(path)
      setContextMenu(null)
      setDraft({
        mode: 'rename',
        kind,
        path,
        parentPath: getParentPath(path),
        value: getEntryName(path),
      })
    },
    [canRenameFile, canRenameFolder],
  )

  const toggleFolder = useCallback((folderPath: string) => {
    setCollapsedFolders((prev) =>
      prev.includes(folderPath)
        ? prev.filter((path) => path !== folderPath)
        : [...prev, folderPath],
    )
  }, [])

  const deleteSandpackFiles = useCallback(
    (paths: string[]) => {
      const entries = paths
        .filter((path) => sandpack.files[path])
        .sort((a, b) => b.length - a.length)

      entries.forEach((path, index) => {
        sandpack.deleteFile(path, index === entries.length - 1)
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
        sandpack.deleteFile(target.path, true)
        closeContextMenu()
        return
      }

      if (!canRenameFolder(target.path)) {
        return
      }

      const nextFolders = folderPaths.filter(
        (path) => !isPathInFolder(path, target.path),
      )
      const entries = filePaths.filter((path) => isPathInFolder(path, target.path))

      entries.forEach((path) => removeFile(path))
      syncFolders(nextFolders, filePaths.filter((path) => !isPathInFolder(path, target.path)))
      deleteSandpackFiles(entries)
      closeContextMenu()
    },
    [
      canRenameFile,
      canRenameFolder,
      closeContextMenu,
      deleteSandpackFiles,
      filePaths,
      folderPaths,
      removeFile,
      syncFolders,
    ],
  )

  const moveFilePath = useCallback(
    (fromPath: string, targetParentPath: string, nextName?: string) => {
      if (!canRenameFile(fromPath)) {
        return null
      }

      const source = sandpack.files[fromPath]
      if (!source) {
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
        ...(sourceParentPath === '/' ? [] : getFolderAncestors(sourceParentPath)),
      ])
      saveFile(nextPath, source.code ?? '')
      removeFile(fromPath)
      syncFolders(nextFolders, nextFilePaths)
      sandpack.addFile(nextPath, source.code ?? '', false)
      sandpack.deleteFile(fromPath, true)

      if (active === fromPath) {
        sandpack.openFile(nextPath)
      }

      setFocusedPath(nextPath)
      return nextPath
    },
    [
      active,
      canRenameFile,
      filePathSet,
      filePaths,
      mergeFolderPaths,
      removeFile,
      sandpack,
      saveFile,
      syncFolders,
    ],
  )

  const moveFolderPath = useCallback(
    (fromPath: string, targetParentPath: string, nextName?: string) => {
      if (!canRenameFolder(fromPath)) {
        return null
      }

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

      const entriesToMove = filePaths.filter((path) => isPathInFolder(path, fromPath))
      const movingSet = new Set(entriesToMove)
      const nextEntries = entriesToMove.map((path) =>
        replacePathPrefix(path, fromPath, nextFolderPath),
      )

      if (
        nextEntries.some((path) => filePathSet.has(path) && !movingSet.has(path))
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
        saveFile(nextPath, sandpack.files[path]?.code ?? '')
      })
      entriesToMove.forEach((path) => removeFile(path))
      syncFolders(nextFolders, nextFilePaths)
      entriesToMove.forEach((path) => {
        const nextPath = replacePathPrefix(path, fromPath, nextFolderPath)
        sandpack.addFile(nextPath, sandpack.files[path]?.code ?? '', false)
      })
      deleteSandpackFiles(entriesToMove)

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
      canRenameFolder,
      deleteSandpackFiles,
      filePathSet,
      filePaths,
      folderPathSet,
      folderPaths,
      removeFile,
      sandpack,
      saveFile,
      sortUniqueFolderPaths,
      syncFolders,
    ],
  )

  const commitDraft = useCallback(() => {
    if (!draft) {
      return
    }

    if (draft.mode === 'create') {
      const rawPath = joinEntryPath(draft.parentPath, draft.value)

      if (draft.kind === 'folder') {
        const folderPath = normalizeNewFolderPath(rawPath)
        if (!folderPath) {
          return
        }
        syncFolders(mergeFolderPaths(getFolderAncestors(folderPath)))
        setCollapsedFolders((prev) =>
          prev.filter((path) => path !== folderPath),
        )
        setFocusedPath(folderPath)
        setDraft(null)
        return
      }

      const filePath = normalizeNewFilePath(rawPath)
      if (!filePath) {
        return
      }

      if (filePathSet.has(filePath)) {
        sandpack.openFile(filePath)
        setFocusedPath(filePath)
        setDraft(null)
        return
      }

      const content = defaultComponentSource(filePath)
      saveFile(filePath, content)
      sandpack.addFile(filePath, content, true)
      sandpack.openFile(filePath)
      setFocusedPath(filePath)
      setDraft(null)
      return
    }

    if (draft.value.includes('/') || draft.value.includes('\\')) {
      return
    }

    if (draft.kind === 'file') {
      const nextPath = joinFileWithName(draft.parentPath, draft.value)
      if (!nextPath) {
        return
      }

      if (nextPath === draft.path) {
        setDraft(null)
        return
      }

      if (filePathSet.has(nextPath)) {
        return
      }

      const movedPath = moveFilePath(draft.path, draft.parentPath, draft.value)
      if (!movedPath) {
        return
      }
      setDraft(null)
      return
    }

    const nextFolderPath = joinFolderWithName(draft.parentPath, draft.value)
    if (!nextFolderPath) {
      return
    }

    if (nextFolderPath === draft.path) {
      setDraft(null)
      return
    }

    if (folderPathSet.has(nextFolderPath)) {
      return
    }

    const movedPath = moveFolderPath(draft.path, draft.parentPath, draft.value)
    if (!movedPath) {
      return
    }
    setDraft(null)
  }, [
    draft,
    filePathSet,
    folderPathSet,
    mergeFolderPaths,
    moveFilePath,
    moveFolderPath,
    sandpack,
    saveFile,
    syncFolders,
  ])

  const openContextMenu = useCallback(
    (event: MouseEvent<HTMLElement>, target: ContextMenuTarget) => {
      event.preventDefault()
      event.stopPropagation()
      setFocusedPath(target.path)
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        target,
      })
    },
    [],
  )

  useDraftInputFocus(draft, editorInputRef, draftSelectKeyRef)
  useContextMenuDismiss(!!contextMenu, closeContextMenu)
  useClearDropTargetWhenNoDrag(dragItem, setDropTargetPath)
  useCopiedPathReset(copiedPath, setCopiedPath)

  const handleDropToFolder = useCallback(
    (targetFolderPath: string) => {
      if (!dragItem) {
        return
      }

      const movedPath =
        dragItem.kind === 'file'
          ? moveFilePath(dragItem.path, targetFolderPath)
          : moveFolderPath(dragItem.path, targetFolderPath)

      if (movedPath) {
        setCollapsedFolders((prev) =>
          prev.filter((path) => path !== targetFolderPath),
        )
      }

      setDragItem(null)
      setDropTargetPath(null)
    },
    [dragItem, moveFilePath, moveFolderPath],
  )

  const renderDraftRow = useCallback(
    (depth: number) => {
      if (!draft) {
        return null
      }

      return (
        <div
          className="playground__treeRow playground__treeRow--draft"
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
        >
          {draft.kind === 'folder' ? (
            <span className="playground__treeIcon">{'>'}</span>
          ) : (
            <FileTypeIcon filePath={`/${draft.value || 'NewFile.tsx'}`} />
          )}
          <input
            ref={editorInputRef}
            className="playground__input playground__input--tree"
            value={draft.value}
            onChange={(e) =>
              setDraft((prev) =>
                prev ? { ...prev, value: e.target.value } : prev,
              )
            }
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                commitDraft()
              }
              if (e.key === 'Escape') {
                cancelDraft()
              }
            }}
            placeholder={
              draft.mode === 'create'
                ? draft.kind === 'file'
                  ? 'Widget.tsx or ui/Button'
                  : 'components/ui'
                : draft.kind === 'file'
                  ? 'Widget.tsx'
                  : 'components'
            }
            spellCheck={false}
            autoFocus
          />
        </div>
      )
    },
    [cancelDraft, commitDraft, draft],
  )

  const renderFile = useCallback(
    (file: ExplorerFileNode, depth: number) => {
      if (
        draft?.mode === 'rename' &&
        draft.kind === 'file' &&
        draft.path === file.path
      ) {
        return <div key={file.path}>{renderDraftRow(depth)}</div>
      }

      const isFocused = focusedPath === file.path
      const isActive = file.path === active
      const parentPath = getParentPath(file.path)
      const filePeers = peersByActiveFile.get(file.path) ?? []

      return (
        <div
          key={file.path}
          className="playground__treeRow"
          style={{ paddingLeft: `${depth * 16 + 12}px` }}
        >
          <button
            type="button"
            draggable={canRenameFile(file.path)}
            className={
              isActive
                ? 'playground__treeItem playground__treeItem--file is-active'
                : isFocused
                  ? 'playground__treeItem playground__treeItem--file is-focused'
                  : 'playground__treeItem playground__treeItem--file'
            }
            onClick={() => {
              sandpack.openFile(file.path)
              setFocusedPath(file.path)
            }}
            onDragStart={(event) => {
              if (!canRenameFile(file.path)) {
                event.preventDefault()
                return
              }
              event.dataTransfer.effectAllowed = 'move'
              event.dataTransfer.setData('text/plain', file.path)
              setDragItem({ kind: 'file', path: file.path })
              setFocusedPath(file.path)
            }}
            onDragEnd={() => {
              setDragItem(null)
              setDropTargetPath(null)
            }}
            onDragOver={(event) => {
              if (!dragItem) {
                return
              }
              if (
                dragItem.kind === 'folder' &&
                (parentPath === dragItem.path ||
                  isPathInFolder(parentPath, dragItem.path))
              ) {
                return
              }
              event.preventDefault()
              event.dataTransfer.dropEffect = 'move'
              setDropTargetPath(parentPath)
            }}
            onDragLeave={() => {
              setDropTargetPath((prev) => (prev === parentPath ? null : prev))
            }}
            onDrop={(event) => {
              event.preventDefault()
              event.stopPropagation()
              handleDropToFolder(parentPath)
            }}
            onContextMenu={(event) =>
              openContextMenu(event, { kind: 'file', path: file.path })
            }
            title={file.path}
          >
            <FileTypeIcon filePath={file.path} />
            <span className="playground__treeName">{file.name}</span>
            {filePeers.length > 0 ? (
              <span
                className="playground__filePeerDots"
                aria-label={`Открыто: ${filePeers.map((p) => p.displayName).join(', ')}`}
              >
                {filePeers.map((p) => {
                  const fill = peerAccentRgbCss(p)
                  const ring = peerAccentRgbaCss(p, 0.42)
                  return (
                    <span
                      key={p.clientId}
                      className="playground__filePeerDot"
                      style={{
                        background: fill,
                        boxShadow: `0 0 0 1px ${ring}`,
                      }}
                      title={p.displayName}
                    />
                  )
                })}
              </span>
            ) : null}
          </button>
        </div>
      )
    },
    [
      active,
      canRenameFile,
      draft,
      dragItem,
      focusedPath,
      handleDropToFolder,
      openContextMenu,
      peersByActiveFile,
      renderDraftRow,
      sandpack,
    ],
  )

  const renderFolder = useCallback(
    function renderFolderRecursive(folder: ExplorerFolderNode, depth: number) {
      const collapsed = collapsedFolders.includes(folder.path)
      const isFocused = focusedPath === folder.path
      const isDropTarget = dropTargetPath === folder.path

      return (
        <div key={folder.path} className="playground__treeGroup">
          {draft?.mode === 'rename' &&
          draft.kind === 'folder' &&
          draft.path === folder.path ? (
            renderDraftRow(depth)
          ) : (
            <div
              className="playground__treeRow playground__treeRow--folder"
              style={{ paddingLeft: `${depth * 16 + 12}px` }}
            >
              <button
                type="button"
                draggable={canRenameFolder(folder.path)}
                className={
                  isDropTarget
                    ? 'playground__treeItem playground__treeItem--folder is-drop-target'
                    : isFocused
                      ? 'playground__treeItem playground__treeItem--folder is-focused'
                      : 'playground__treeItem playground__treeItem--folder'
                }
                onClick={() => {
                  toggleFolder(folder.path)
                  setFocusedPath(folder.path)
                }}
                onDragStart={(event) => {
                  if (!canRenameFolder(folder.path)) {
                    event.preventDefault()
                    return
                  }
                  event.dataTransfer.effectAllowed = 'move'
                  event.dataTransfer.setData('text/plain', folder.path)
                  setDragItem({ kind: 'folder', path: folder.path })
                  setFocusedPath(folder.path)
                }}
                onDragEnd={() => {
                  setDragItem(null)
                  setDropTargetPath(null)
                }}
                onDragOver={(event) => {
                  if (!dragItem) {
                    return
                  }
                  if (
                    dragItem.kind === 'folder' &&
                    (dragItem.path === folder.path ||
                      isPathInFolder(folder.path, dragItem.path))
                  ) {
                    return
                  }
                  event.preventDefault()
                  event.dataTransfer.dropEffect = 'move'
                  setDropTargetPath(folder.path)
                }}
                onDragLeave={() => {
                  setDropTargetPath((prev) =>
                    prev === folder.path ? null : prev,
                  )
                }}
                onDrop={(event) => {
                  event.preventDefault()
                  event.stopPropagation()
                  handleDropToFolder(folder.path)
                }}
                onContextMenu={(event) =>
                  openContextMenu(event, { kind: 'folder', path: folder.path })
                }
                title={folder.path}
              >
                <span className="playground__treeIcon">
                  {collapsed ? '>' : 'v'}
                </span>
                <span className="playground__treeName">{folder.name}</span>
              </button>
            </div>
          )}

          {collapsed ? null : (
            <>
              {draft?.mode === 'create' && draft.parentPath === folder.path
                ? renderDraftRow(depth + 1)
                : null}
              {folder.folders.map((child) =>
                renderFolderRecursive(child, depth + 1),
              )}
              {folder.files.map((file) => renderFile(file, depth + 1))}
            </>
          )}
        </div>
      )
    },
    [
      canRenameFolder,
      collapsedFolders,
      draft,
      dragItem,
      dropTargetPath,
      focusedPath,
      handleDropToFolder,
      openContextMenu,
      renderDraftRow,
      renderFile,
      toggleFolder,
    ],
  )

  return (
    <div
      className="playground__fileExplorer sp-file-explorer"
      onContextMenu={(event) =>
        openContextMenu(event, { kind: 'root', path: '/' })
      }
    >
      <div className="playground__fileExplorerHeader">
        <div>
          <div className="playground__label">Explorer</div>
          <div className="playground__fileExplorerHint">
            Right click to create, rename, or delete files and folders.
          </div>
        </div>
      </div>

      <div className="playground__fileTree" role="tree">
        {!snapshotReady ? (
          <div className="playground__treeRow" style={{ padding: '12px' }}>
            Loading files...
          </div>
        ) : null}
        <div
          className={
            dropTargetPath === '/'
              ? 'playground__rootDropZone is-drop-target'
              : 'playground__rootDropZone'
          }
          onDragOver={(event) => {
            if (!dragItem) {
              return
            }
            event.preventDefault()
            event.dataTransfer.dropEffect = 'move'
            setDropTargetPath('/')
          }}
          onDragLeave={() => {
            setDropTargetPath((prev) => (prev === '/' ? null : prev))
          }}
          onDrop={(event) => {
            event.preventDefault()
            event.stopPropagation()
            handleDropToFolder('/')
          }}
        />
        {draft?.mode === 'create' && draft.parentPath === '/'
          ? renderDraftRow(0)
          : null}
        {tree.folders.map((folder) => renderFolder(folder, 0))}
        {tree.files.map((file) => renderFile(file, 0))}
      </div>

      {contextMenu ? (
        <div
          className="playground__contextMenu"
          style={{ left: contextMenu.x, top: contextMenu.y }}
          onPointerDown={(event) => event.stopPropagation()}
          onContextMenu={(event) => event.preventDefault()}
        >
          {contextMenu.target.kind === 'root' ? (
            <>
              <button
                type="button"
                className="playground__contextMenuItem"
                onClick={() => startCreate('file', '/')}
              >
                New File
              </button>
              <button
                type="button"
                className="playground__contextMenuItem"
                onClick={() => startCreate('folder', '/')}
              >
                New Folder
              </button>
            </>
          ) : null}

          {contextMenu.target.kind === 'folder' ? (
            <>
              <button
                type="button"
                className="playground__contextMenuItem"
                onClick={() => startCreate('file', contextMenu.target.path)}
              >
                New File
              </button>
              <button
                type="button"
                className="playground__contextMenuItem"
                onClick={() => startCreate('folder', contextMenu.target.path)}
              >
                New Folder
              </button>
              <button
                type="button"
                className="playground__contextMenuItem"
                onClick={() => startRename('folder', contextMenu.target.path)}
                disabled={!canRenameFolder(contextMenu.target.path)}
              >
                Rename
              </button>
              <button
                type="button"
                className="playground__contextMenuItem is-danger"
                onClick={() => deletePath(contextMenu.target)}
                disabled={!canRenameFolder(contextMenu.target.path)}
              >
                Delete
              </button>
            </>
          ) : null}

          {contextMenu.target.kind === 'file' ? (
            <>
              <button
                type="button"
                className="playground__contextMenuItem"
                onClick={() => {
                  void copyPath(contextMenu.target.path)
                  closeContextMenu()
                }}
              >
                Copy Path
              </button>
              <button
                type="button"
                className="playground__contextMenuItem"
                onClick={() => startRename('file', contextMenu.target.path)}
                disabled={!canRenameFile(contextMenu.target.path)}
              >
                Rename
              </button>
              <button
                type="button"
                className="playground__contextMenuItem is-danger"
                onClick={() => deletePath(contextMenu.target)}
                disabled={!canRenameFile(contextMenu.target.path)}
              >
                Delete
              </button>
            </>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
