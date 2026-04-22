import type { ContextMenuState } from '../types/playgroundFileExplorer.types'

type Props = {
  contextMenu: ContextMenuState | null
  handleContextMenuPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void
  preventNativeContextMenu: (e: React.MouseEvent<HTMLElement>) => void
  handleCreateFileInRoot: () => void
  handleCreateFolderInRoot: () => void
  handleCreateFileInContextFolder: () => void
  handleCreateFolderInContextFolder: () => void
  handleRenameContextFolder: () => void
  handleDeleteContextFolder: () => void
  handleCopyPathContextFile: () => void
  handleRenameContextFile: () => void
  handleDeleteContextFile: () => void
  canRenameFolder: (folderPath: string) => boolean
  canRenameFile: (path: string) => boolean
}

export function PlaygroundContextMenu({
  contextMenu,
  handleContextMenuPointerDown,
  preventNativeContextMenu,
  handleCreateFileInRoot,
  handleCreateFolderInRoot,
  handleCreateFileInContextFolder,
  handleCreateFolderInContextFolder,
  handleRenameContextFolder,
  handleDeleteContextFolder,
  handleCopyPathContextFile,
  handleRenameContextFile,
  handleDeleteContextFile,
  canRenameFolder,
  canRenameFile,
}: Props) {
  if (!contextMenu) {
    return null
  }

  return (
    <div
      className="playground__contextMenu"
      style={{ left: contextMenu.x, top: contextMenu.y }}
      onPointerDown={handleContextMenuPointerDown}
      onContextMenu={preventNativeContextMenu}
    >
      {contextMenu.target.kind === 'root' ? (
        <>
          <button
            type="button"
            className="playground__contextMenuItem"
            onClick={handleCreateFileInRoot}
          >
            New File
          </button>
          <button
            type="button"
            className="playground__contextMenuItem"
            onClick={handleCreateFolderInRoot}
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
            onClick={handleCreateFileInContextFolder}
          >
            New File
          </button>
          <button
            type="button"
            className="playground__contextMenuItem"
            onClick={handleCreateFolderInContextFolder}
          >
            New Folder
          </button>
          <button
            type="button"
            className="playground__contextMenuItem"
            onClick={handleRenameContextFolder}
            disabled={!canRenameFolder(contextMenu.target.path)}
          >
            Rename
          </button>
          <button
            type="button"
            className="playground__contextMenuItem is-danger"
            onClick={handleDeleteContextFolder}
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
            onClick={handleCopyPathContextFile}
          >
            Copy Path
          </button>
          <button
            type="button"
            className="playground__contextMenuItem"
            onClick={handleRenameContextFile}
            disabled={!canRenameFile(contextMenu.target.path)}
          >
            Rename
          </button>
          <button
            type="button"
            className="playground__contextMenuItem is-danger"
            onClick={handleDeleteContextFile}
            disabled={!canRenameFile(contextMenu.target.path)}
          >
            Delete
          </button>
        </>
      ) : null}
    </div>
  )
}
