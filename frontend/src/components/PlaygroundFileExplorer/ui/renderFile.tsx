import type { Dispatch, MouseEvent, ReactNode, SetStateAction } from 'react'
import type { CollabPeerDTO } from '../../../collab/collab.types'
import { peerAccentRgbCss } from '../../../collab/peerColor'
import type {
  ContextMenuTarget,
  DragItem,
  ExplorerDraft,
  ExplorerFileNode,
} from '../types/playgroundFileExplorer.types'
import { treeRowPaddingLeft } from '../constants/playgroundFileExplorer.constants'
import { getParentPath, isPathInFolder } from '../utils/paths'

export function renderFile({
  file,
  depth,
  draft,
  focusedPath,
  setFocusedPath,
  active,
  openFile,
  peersByActiveFile,
  openContextMenu,
  dragItem,
  setDragItem,
  setDropTargetPath,
  handleDropToFolder,
  renderDraftRowAtDepth,
  FileTypeIcon,
  isSolution = false,
}: {
  file: ExplorerFileNode
  depth: number
  draft: ExplorerDraft | null
  focusedPath: string
  setFocusedPath: Dispatch<SetStateAction<string>>
  active: string
  openFile: (path: string) => void
  peersByActiveFile: Map<string, CollabPeerDTO[]>
  openContextMenu: (
    event: MouseEvent<HTMLElement>,
    target: ContextMenuTarget,
  ) => void
  dragItem: DragItem | null
  setDragItem: Dispatch<SetStateAction<DragItem | null>>
  setDropTargetPath: Dispatch<SetStateAction<string | null>>
  handleDropToFolder: (targetFolderPath: string) => void
  renderDraftRowAtDepth: (depth: number) => ReactNode
  FileTypeIcon: (props: { filePath: string }) => ReactNode
  isSolution?: boolean
}) {
  if (
    draft?.mode === 'rename' &&
    draft.kind === 'file' &&
    draft.path === file.path
  ) {
    return (
      <div key={file.path} className="playground__treeBranchWrap">
        {renderDraftRowAtDepth(depth)}
      </div>
    )
  }

  const isFocused = focusedPath === file.path
  const isActive = file.path === active
  const parentPath = getParentPath(file.path)
  const filePeers = peersByActiveFile.get(file.path) ?? []

  const draggable = true

  function handleClick() {
    openFile(file.path)
    setFocusedPath(file.path)
  }

  function handleDragStart(event: React.DragEvent<HTMLButtonElement>) {
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
      (parentPath === dragItem.path ||
        isPathInFolder(parentPath, dragItem.path))
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
    return (
      <span
        key={p.clientId}
        className="playground__filePeerDot"
        style={{
          background: fill,
        }}
        title={p.displayName}
      />
    )
  }

  return (
    <div
      key={file.path}
      className="playground__treeRow"
      style={{ paddingLeft: `${treeRowPaddingLeft(depth)}px` }}
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
        {isSolution ? (
          <span className="playground__solutionBadge" title="Файл решения">
            решение
          </span>
        ) : null}
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
