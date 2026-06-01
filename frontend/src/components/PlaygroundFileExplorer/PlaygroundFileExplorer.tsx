import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined'
import { IconButton, Tooltip } from '@mui/material'
import { useCallback, useMemo, useState } from 'react'
import type { MouseEvent } from 'react'
import { useCollabFs } from '../collabFsContext'
import type { CollabPeerDTO } from '../../collab/collab.types'
import { normalizeSandpackFilePath } from '../../collab/sandpackPaths'
import { useWorkspace } from '../../workspace/WorkspaceContext'
import { VITE_REACT_TS_PROTECTED } from './constants/playgroundFileExplorer.constants'
import { useClearDropTargetWhenNoDrag } from './hooks/useDragDropUiSync'
import { useCopiedPathReset } from './hooks/useCopiedPathReset'
import { useContextMenuDismiss } from './hooks/useContextMenuDismiss'
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
import { ExplorerDraftRow } from './ui/ExplorerDraftRow'
import { renderFile as renderFileUi } from './ui/renderFile'
import { renderFolder as renderFolderUi } from './ui/renderFolder'
import { PlaygroundContextMenu } from './ui/PlaygroundContextMenu'
import { FileTypeIcon } from './ui/FileTypeIcon'

const FILE_EXPLORER_HINT =
  'Кликните правой кнопкой, чтобы создавать, переименовывать и удалять файлы и папки.'

export function PlaygroundFileExplorer({
  collabPeers = [],
}: {
  collabPeers?: CollabPeerDTO[]
} = {}) {
  const workspace = useWorkspace()
  const {
    filePaths,
    folderPaths,
    snapshotReady,
    syncFolders,
    saveFile,
    removeFile,
  } = useCollabFs()
  const [collapsedFolders, setCollapsedFolders] = useState<string[]>([])
  const [draft, setDraft] = useState<ExplorerDraft | null>(null)
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null)
  const [focusedPath, setFocusedPath] = useState('/')
  const [dragItem, setDragItem] = useState<DragItem | null>(null)
  const [dropTargetPath, setDropTargetPath] = useState<string | null>(null)
  const [copiedPath, setCopiedPath] = useState<string | null>(null)
  const active = normalizeSandpackFilePath(workspace.activeFile ?? '')
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
        value: kind === 'file' ? 'NewFile.tsx' : 'NewFolder',
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
    sandpack: {
      files: workspace.files,
      updateFile: workspace.updateWorkspaceFile,
      deleteFile: workspace.deleteWorkspaceFile,
      openFile: workspace.openFile,
    },
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
        workspace.openFile(filePath)
        setFocusedPath(filePath)
        setDraft(null)
        return
      }

      const content = ''
      saveFile(filePath, content)
      workspace.updateWorkspaceFile(filePath, content)
      workspace.openFile(filePath)
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
    saveFile,
    syncFolders,
    workspace,
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

  useContextMenuDismiss(!!contextMenu, closeContextMenu)
  useClearDropTargetWhenNoDrag(dragItem, setDropTargetPath)
  useCopiedPathReset(copiedPath, setCopiedPath)

  const handleContextMenuPointerDown = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      event.stopPropagation()
    },
    [],
  )

  const preventNativeContextMenu = useCallback((event: React.MouseEvent) => {
    event.preventDefault()
  }, [])

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

      return (
        <ExplorerDraftRow
          key={`draft-${draft.mode}-${draft.kind}-${draft.mode === 'rename' ? draft.path : draft.parentPath}`}
          depth={depth}
          draft={draft}
          setDraft={setDraft}
          commitDraft={commitDraft}
          cancelDraft={cancelDraft}
          FileTypeIcon={FileTypeIcon}
        />
      )
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
        openFile: workspace.openFile,
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
      draft,
      dragItem,
      focusedPath,
      handleDropToFolder,
      openContextMenu,
      peersByActiveFile,
      renderDraftRow,
      workspace.openFile,
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
        <div className="playground__fileExplorerHeaderTitle">
          <div className="playground__label">Проводник</div>
          <Tooltip title={FILE_EXPLORER_HINT} arrow placement="top">
            <IconButton
              type="button"
              size="small"
              className="playground__fileExplorerInfoBtn"
              aria-label={FILE_EXPLORER_HINT}
            >
              <InfoOutlinedIcon fontSize="inherit" />
            </IconButton>
          </Tooltip>
        </div>
      </div>

      <div className="playground__fileTree" role="tree">
        {!snapshotReady ? (
          <div className="playground__treeRow" style={{ padding: '12px' }}>
            Загрузка файлов...
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
        <div
          className={
            dropTargetPath === '/'
              ? 'playground__rootDropZone playground__rootDropZone--bottom is-drop-target'
              : 'playground__rootDropZone playground__rootDropZone--bottom'
          }
          onDragOver={handleRootDragOver}
          onDragLeave={handleRootDragLeave}
          onDrop={handleRootDrop}
        />
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
