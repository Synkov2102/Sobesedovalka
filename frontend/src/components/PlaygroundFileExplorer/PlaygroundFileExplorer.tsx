import { useCallback, useMemo, useRef, useState } from 'react'
import type { MouseEvent } from 'react'
import { useSandpack } from '@codesandbox/sandpack-react'
import { useCollabFs } from '../CollabSync'
import type { CollabPeerDTO } from '../../collab/collab.types'
import { normalizeSandpackFilePath } from '../../collab/sandpackPaths'
import { VITE_REACT_TS_PROTECTED } from './constants/playgroundFileExplorer.constants'
import { useClearDropTargetWhenNoDrag } from './hooks/useDragDropUiSync'
import { useCopiedPathReset } from './hooks/useCopiedPathReset'
import { useContextMenuDismiss } from './hooks/useContextMenuDismiss'
import { useDraftInputFocus } from './hooks/useDraftInputFocus'
import { useExplorerFsOps } from './hooks/useExplorerFsOps'
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
import { buildPeersByActiveFile } from './utils/peers'
import {
  getEntryName,
  getFolderAncestors,
  getParentPath,
  isPathInFolder,
  joinEntryPath,
  joinFileWithName,
  joinFolderWithName,
  normalizeNewFilePath,
  normalizeNewFolderPath,
} from './utils/paths'
import { sortUniqueFolderPaths } from './utils/sort'
import './PlaygroundFileExplorer.css'
import {
  renderDraftRow as renderDraftRowUi,
} from './ui/renderDraftRow'
import { renderFile as renderFileUi } from './ui/renderFile'
import { renderFolder as renderFolderUi } from './ui/renderFolder'
import { PlaygroundContextMenu } from './ui/PlaygroundContextMenu'
import { FileTypeIcon } from './ui/FileTypeIcon'

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

  const peersByActiveFile = useMemo(
    () => buildPeersByActiveFile(collabPeers),
    [collabPeers],
  )

  const mergeFolderPaths = useCallback(
    (extraPaths: string[]) =>
      sortUniqueFolderPaths([...folderPaths, ...extraPaths]),
    [folderPaths],
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

  const { deletePath, moveFilePath, moveFolderPath } = useExplorerFsOps({
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
  })

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

  const openRootContextMenu = useCallback(
    (event: MouseEvent<HTMLElement>) => {
      openContextMenu(event, { kind: 'root', path: '/' })
    },
    [openContextMenu],
  )

  useDraftInputFocus(draft, editorInputRef, draftSelectKeyRef)
  useContextMenuDismiss(!!contextMenu, closeContextMenu)
  useClearDropTargetWhenNoDrag(dragItem, setDropTargetPath)
  useCopiedPathReset(copiedPath, setCopiedPath)

  const handleContextMenuPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.stopPropagation()
    },
    [],
  )

  const preventNativeContextMenu = useCallback(
    (event: React.MouseEvent) => {
      event.preventDefault()
    },
    [],
  )

  const handleCreateFileInRoot = useCallback(() => {
    startCreate('file', '/')
  }, [startCreate])

  const handleCreateFolderInRoot = useCallback(() => {
    startCreate('folder', '/')
  }, [startCreate])

  const handleCreateFileInContextFolder = useCallback(() => {
    if (!contextMenu || contextMenu.target.kind !== 'folder') {
      return
    }
    startCreate('file', contextMenu.target.path)
  }, [contextMenu, startCreate])

  const handleCreateFolderInContextFolder = useCallback(() => {
    if (!contextMenu || contextMenu.target.kind !== 'folder') {
      return
    }
    startCreate('folder', contextMenu.target.path)
  }, [contextMenu, startCreate])

  const handleRenameContextFolder = useCallback(() => {
    if (!contextMenu || contextMenu.target.kind !== 'folder') {
      return
    }
    startRename('folder', contextMenu.target.path)
  }, [contextMenu, startRename])

  const handleDeleteContextFolder = useCallback(() => {
    if (!contextMenu || contextMenu.target.kind !== 'folder') {
      return
    }
    deletePath(contextMenu.target)
  }, [contextMenu, deletePath])

  const handleCopyPathContextFile = useCallback(() => {
    if (!contextMenu || contextMenu.target.kind !== 'file') {
      return
    }
    void copyPath(contextMenu.target.path)
    closeContextMenu()
  }, [closeContextMenu, contextMenu, copyPath])

  const handleRenameContextFile = useCallback(() => {
    if (!contextMenu || contextMenu.target.kind !== 'file') {
      return
    }
    startRename('file', contextMenu.target.path)
  }, [contextMenu, startRename])

  const handleDeleteContextFile = useCallback(() => {
    if (!contextMenu || contextMenu.target.kind !== 'file') {
      return
    }
    deletePath(contextMenu.target)
  }, [contextMenu, deletePath])

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

  const handleRootDragOver = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      if (!dragItem) {
        return
      }
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      setDropTargetPath('/')
    },
    [dragItem],
  )

  const handleRootDragLeave = useCallback(() => {
    setDropTargetPath((prev) => (prev === '/' ? null : prev))
  }, [])

  const handleRootDrop = useCallback(
    (event: React.DragEvent<HTMLDivElement>) => {
      event.preventDefault()
      event.stopPropagation()
      handleDropToFolder('/')
    },
    [handleDropToFolder],
  )

  const renderDraftRow = useCallback(
    (depth: number) => {
      if (!draft) {
        return null
      }

      return renderDraftRowUi({
        depth,
        draft,
        editorInputRef,
        setDraft,
        commitDraft,
        cancelDraft,
        FileTypeIcon,
      })
    },
    [cancelDraft, commitDraft, draft],
  )

  const renderFile = useCallback(
    (file: ExplorerFileNode, depth: number) => {
      return renderFileUi({
        file,
        depth,
        draft,
        focusedPath,
        setFocusedPath,
        active,
        sandpack,
        canRenameFile,
        peersByActiveFile,
        openContextMenu,
        dragItem,
        setDragItem,
        setDropTargetPath,
        handleDropToFolder,
        renderDraftRowAtDepth: renderDraftRow,
        FileTypeIcon,
      })
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
      return renderFolderUi({
        folder,
        depth,
        collapsedFolders,
        focusedPath,
        setFocusedPath,
        dropTargetPath,
        draft,
        canRenameFolder,
        toggleFolder,
        dragItem,
        setDragItem,
        setDropTargetPath,
        handleDropToFolder,
        openContextMenu,
        renderDraftRowAtDepth: renderDraftRow,
        renderFileAtDepth: renderFile,
      })
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
      onContextMenu={openRootContextMenu}
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
          onDragOver={handleRootDragOver}
          onDragLeave={handleRootDragLeave}
          onDrop={handleRootDrop}
        />
        {draft?.mode === 'create' && draft.parentPath === '/'
          ? renderDraftRow(0)
          : null}
        {tree.folders.map((folder) => renderFolder(folder, 0))}
        {tree.files.map((file) => renderFile(file, 0))}
      </div>

      <PlaygroundContextMenu
        contextMenu={contextMenu}
        handleContextMenuPointerDown={handleContextMenuPointerDown}
        preventNativeContextMenu={preventNativeContextMenu}
        handleCreateFileInRoot={handleCreateFileInRoot}
        handleCreateFolderInRoot={handleCreateFolderInRoot}
        handleCreateFileInContextFolder={handleCreateFileInContextFolder}
        handleCreateFolderInContextFolder={handleCreateFolderInContextFolder}
        handleRenameContextFolder={handleRenameContextFolder}
        handleDeleteContextFolder={handleDeleteContextFolder}
        handleCopyPathContextFile={handleCopyPathContextFile}
        handleRenameContextFile={handleRenameContextFile}
        handleDeleteContextFile={handleDeleteContextFile}
        canRenameFolder={canRenameFolder}
        canRenameFile={canRenameFile}
      />
    </div>
  )
}
