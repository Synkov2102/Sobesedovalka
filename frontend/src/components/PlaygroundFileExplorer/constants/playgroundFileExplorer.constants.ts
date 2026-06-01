export const EMPTY_FOLDER_MARKER = '.empty-folder'

const TREE_ROOT_PADDING_PX = 8

/** Горизонтальный отступ только у корня; вложенность — через `.playground__treeChildren`. */
export function treeRowPaddingLeft(depth: number): number {
  return depth === 0 ? TREE_ROOT_PADDING_PX : 0
}

export const VITE_REACT_TS_PROTECTED = new Set([
  '/App.tsx',
  '/index.tsx',
  '/index.html',
  '/package.json',
  '/tsconfig.json',
  '/tsconfig.node.json',
  '/vite-env.d.ts',
  '/vite.config.ts',
  '/styles.css',
])
