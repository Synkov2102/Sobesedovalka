import type { Dispatch, MouseEvent, ReactNode, SetStateAction } from 'react'
import type {
  ContextMenuTarget,
  DragItem,
  ExplorerDraft,
  ExplorerFileNode,
  ExplorerFolderNode,
} from '../types/playgroundFileExplorer.types'
import { isPathInFolder } from '../utils/paths'

export function renderFolder({
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
  renderDraftRowAtDepth,
  renderFileAtDepth,
}: {
  folder: ExplorerFolderNode
  depth: number
  collapsedFolders: string[]
  focusedPath: string
  setFocusedPath: Dispatch<SetStateAction<string>>
  dropTargetPath: string | null
  draft: ExplorerDraft | null
  toggleFolder: (folderPath: string) => void
  dragItem: DragItem | null
  setDragItem: Dispatch<SetStateAction<DragItem | null>>
  setDropTargetPath: Dispatch<SetStateAction<string | null>>
  handleDropToFolder: (targetFolderPath: string) => void
  openContextMenu: (event: MouseEvent<HTMLElement>, target: ContextMenuTarget) => void
  renderDraftRowAtDepth: (depth: number) => ReactNode
  renderFileAtDepth: (file: ExplorerFileNode, depth: number) => ReactNode
}) {
  function renderFolderRecursive(node: ExplorerFolderNode, nextDepth: number): ReactNode {
    const collapsed = collapsedFolders.includes(node.path)
    const isFocused = focusedPath === node.path
    const isDropTarget = dropTargetPath === node.path
    const draggable = node.path !== '/'

    function handleClick() {
      toggleFolder(node.path)
      setFocusedPath(node.path)
    }

    function handleDragStart(event: React.DragEvent<HTMLButtonElement>) {
      if (!draggable) {
        event.preventDefault()
        return
      }
      event.dataTransfer.effectAllowed = 'move'
      event.dataTransfer.setData('text/plain', node.path)
      setDragItem({ kind: 'folder', path: node.path })
      setFocusedPath(node.path)
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
        (dragItem.path === node.path || isPathInFolder(node.path, dragItem.path))
      ) {
        return
      }
      event.preventDefault()
      event.dataTransfer.dropEffect = 'move'
      setDropTargetPath(node.path)
    }

    function handleDragLeave() {
      setDropTargetPath((prev) => (prev === node.path ? null : prev))
    }

    function handleDrop(event: React.DragEvent<HTMLButtonElement>) {
      event.preventDefault()
      event.stopPropagation()
      handleDropToFolder(node.path)
    }

    function handleContextMenu(event: MouseEvent<HTMLElement>) {
      openContextMenu(event, { kind: 'folder', path: node.path })
    }

    function renderChildFolder(child: ExplorerFolderNode) {
      return renderFolderRecursive(child, nextDepth + 1)
    }

    function renderChildFile(f: ExplorerFileNode) {
      return renderFileAtDepth(f, nextDepth + 1)
    }

    return (
      <div key={node.path} className="playground__treeGroup">
        {draft?.mode === 'rename' && draft.kind === 'folder' && draft.path === node.path ? (
          renderDraftRowAtDepth(nextDepth)
        ) : (
          <div
            className="playground__treeRow playground__treeRow--folder"
            style={{ paddingLeft: `${nextDepth * 16 + 12}px` }}
          >
            <button
              type="button"
              draggable={draggable}
              className={
                isDropTarget
                  ? 'playground__treeItem playground__treeItem--folder is-drop-target'
                  : isFocused
                    ? 'playground__treeItem playground__treeItem--folder is-focused'
                    : 'playground__treeItem playground__treeItem--folder'
              }
              onClick={handleClick}
              onDragStart={handleDragStart}
              onDragEnd={handleDragEnd}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onContextMenu={handleContextMenu}
              title={node.path}
            >
              <span className="playground__treeIcon">{collapsed ? '>' : 'v'}</span>
              <span className="playground__treeName">{node.name}</span>
            </button>
          </div>
        )}

        {collapsed ? null : (
          <>
            {draft?.mode === 'create' && draft.parentPath === node.path
              ? renderDraftRowAtDepth(nextDepth + 1)
              : null}
            {node.folders.map(renderChildFolder)}
            {node.files.map(renderChildFile)}
          </>
        )}
      </div>
    )
  }

  return renderFolderRecursive(folder, depth)
}

