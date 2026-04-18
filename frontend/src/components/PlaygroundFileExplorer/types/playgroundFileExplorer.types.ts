export type ExplorerFileNode = {
  kind: 'file'
  path: string
  name: string
}

export type ExplorerFolderNode = {
  kind: 'folder'
  path: string
  name: string
  folders: ExplorerFolderNode[]
  files: ExplorerFileNode[]
}

export type ExplorerDraft =
  | {
      mode: 'create'
      kind: 'file' | 'folder'
      parentPath: string
      value: string
    }
  | {
      mode: 'rename'
      kind: 'file' | 'folder'
      path: string
      parentPath: string
      value: string
    }

export type ContextMenuTarget =
  | {
      kind: 'root'
      path: '/'
    }
  | {
      kind: 'file' | 'folder'
      path: string
    }

export type ContextMenuState = {
  x: number
  y: number
  target: ContextMenuTarget
}

export type DragItem =
  | {
      kind: 'file'
      path: string
    }
  | {
      kind: 'folder'
      path: string
    }

export type FileIconTone =
  | 'react'
  | 'ts'
  | 'js'
  | 'css'
  | 'html'
  | 'json'
  | 'md'
  | 'vite'
  | 'npm'
  | 'default'

export type FileIconSpec = {
  label: string
  tone: FileIconTone
  title: string
}
