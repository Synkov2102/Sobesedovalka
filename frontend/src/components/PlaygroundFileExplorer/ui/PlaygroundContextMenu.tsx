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
            Новый файл
          </button>
          <button
            type="button"
            className="playground__contextMenuItem"
            onClick={handleCreateFolderInRoot}
          >
            Новая папка
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
            Новый файл
          </button>
          <button
            type="button"
            className="playground__contextMenuItem"
            onClick={handleCreateFolderInContextFolder}
          >
            Новая папка
          </button>
          <button
            type="button"
            className="playground__contextMenuItem"
            onClick={handleRenameContextFolder}
            disabled={!canRenameFolder(contextMenu.target.path)}
          >
            Переименовать
          </button>
          <button
            type="button"
            className="playground__contextMenuItem is-danger"
            onClick={handleDeleteContextFolder}
            disabled={!canRenameFolder(contextMenu.target.path)}
          >
            Удалить
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
            Копировать путь
          </button>
          <button
            type="button"
            className="playground__contextMenuItem"
            onClick={handleRenameContextFile}
            disabled={!canRenameFile(contextMenu.target.path)}
          >
            Переименовать
          </button>
          <button
            type="button"
            className="playground__contextMenuItem is-danger"
            onClick={handleDeleteContextFile}
            disabled={!canRenameFile(contextMenu.target.path)}
          >
            Удалить
          </button>
        </>
      ) : null}
    </div>
  )
}
