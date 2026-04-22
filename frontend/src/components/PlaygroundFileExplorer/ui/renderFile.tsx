import type { Dispatch, MouseEvent, ReactNode, SetStateAction } from 'react'
import type { CollabPeerDTO } from '../../../collab/collab.types'
import { peerAccentRgbCss, peerAccentRgbaCss } from '../../../collab/peerColor'
import type {
  ContextMenuTarget,
  DragItem,
  ExplorerDraft,
  ExplorerFileNode,
} from '../types/playgroundFileExplorer.types'
import { getParentPath, isPathInFolder } from '../utils/paths'

type SandpackLike = {
  openFile: (path: string) => void
}

export function renderFile({
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
  renderDraftRowAtDepth,
  FileTypeIcon,
}: {
  file: ExplorerFileNode
  depth: number
  draft: ExplorerDraft | null
  focusedPath: string
  setFocusedPath: Dispatch<SetStateAction<string>>
  active: string
  sandpack: SandpackLike
  canRenameFile: (path: string) => boolean
  peersByActiveFile: Map<string, CollabPeerDTO[]>
  openContextMenu: (event: MouseEvent<HTMLElement>, target: ContextMenuTarget) => void
  dragItem: DragItem | null
  setDragItem: Dispatch<SetStateAction<DragItem | null>>
  setDropTargetPath: Dispatch<SetStateAction<string | null>>
  handleDropToFolder: (targetFolderPath: string) => void
  renderDraftRowAtDepth: (depth: number) => ReactNode
  FileTypeIcon: (props: { filePath: string }) => ReactNode
}) {
  if (draft?.mode === 'rename' && draft.kind === 'file' && draft.path === file.path) {
    return <div key={file.path}>{renderDraftRowAtDepth(depth)}</div>
  }

  const isFocused = focusedPath === file.path
  const isActive = file.path === active
  const parentPath = getParentPath(file.path)
  const filePeers = peersByActiveFile.get(file.path) ?? []

  const draggable = canRenameFile(file.path)

  function handleClick() {
    sandpack.openFile(file.path)
    setFocusedPath(file.path)
  }

  function handleDragStart(event: React.DragEvent<HTMLButtonElement>) {
    if (!draggable) {
      event.preventDefault()
      return
    }
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', file.path)
    setDragItem({ kind: 'file', path: file.path })
    setFocusedPath(file.path)
  }

  function handleDragEnd() {
    setDragItem(null)
    setDropTargetPath(null)
  }

  function handleDragOver(event: React.DragEvent<HTMLButtonElement>) {
    if (!dragItem) {
      return
    }
    if (
      dragItem.kind === 'folder' &&
      (parentPath === dragItem.path || isPathInFolder(parentPath, dragItem.path))
    ) {
      return
    }
    event.preventDefault()
    event.dataTransfer.dropEffect = 'move'
    setDropTargetPath(parentPath)
  }

  function handleDragLeave() {
    setDropTargetPath((prev) => (prev === parentPath ? null : prev))
  }

  function handleDrop(event: React.DragEvent<HTMLButtonElement>) {
    event.preventDefault()
    event.stopPropagation()
    handleDropToFolder(parentPath)
  }

  function handleContextMenu(event: MouseEvent<HTMLElement>) {
    openContextMenu(event, { kind: 'file', path: file.path })
  }

  function renderPeerDot(p: CollabPeerDTO) {
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
  }

  return (
    <div
      key={file.path}
      className="playground__treeRow"
      style={{ paddingLeft: `${depth * 16 + 12}px` }}
    >
      <button
        type="button"
        draggable={draggable}
        className={
          isActive
            ? 'playground__treeItem playground__treeItem--file is-active'
            : isFocused
              ? 'playground__treeItem playground__treeItem--file is-focused'
              : 'playground__treeItem playground__treeItem--file'
        }
        onClick={handleClick}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onContextMenu={handleContextMenu}
        title={file.path}
      >
        <FileTypeIcon filePath={file.path} />
        <span className="playground__treeName">{file.name}</span>
        {filePeers.length > 0 ? (
          <span
            className="playground__filePeerDots"
            aria-label={`Открыто: ${filePeers.map((p) => p.displayName).join(', ')}`}
          >
            {filePeers.map(renderPeerDot)}
          </span>
        ) : null}
      </button>
    </div>
  )
}

