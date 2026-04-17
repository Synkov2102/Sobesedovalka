import { EditorView } from '@codemirror/view'

function getEditorView(): EditorView | null {
  const el = document.querySelector(
    '.playground__sandpack .sp-editor .cm-content',
  )
  if (!el || !(el instanceof HTMLElement)) {
    return null
  }
  return EditorView.findFromDOM(el)
}

export type LineCol = { line: number; col: number }

/** Main selection as1-based line/column (matches server roster). */
export function readSandpackSelection(): {
  anchor: LineCol
  head: LineCol
} | null {
  const view = getEditorView()
  if (!view) {
    return null
  }
  const sel = view.state.selection.main
  const doc = view.state.doc
  const al = doc.lineAt(sel.anchor)
  const hl = doc.lineAt(sel.head)
  return {
    anchor: {
      line: al.number,
      col: sel.anchor - al.from + 1,
    },
    head: {
      line: hl.number,
      col: sel.head - hl.from + 1,
    },
  }
}

/** Caret only — same as `readSandpackSelection()?.head`. */
export function readSandpackCursor(): LineCol | null {
  const s = readSandpackSelection()
  return s ? s.head : null
}
