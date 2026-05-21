import type * as monaco from 'monaco-editor'

let activeEditor: monaco.editor.IStandaloneCodeEditor | null = null

export function setActiveMonacoEditor(
  editor: monaco.editor.IStandaloneCodeEditor | null,
): void {
  activeEditor = editor
}

export function readMonacoSelection(): {
  anchor: { line: number; col: number }
  head: { line: number; col: number }
} | null {
  const selection = activeEditor?.getSelection()
  if (!selection) {
    return null
  }
  return {
    anchor: {
      line: selection.selectionStartLineNumber,
      col: selection.selectionStartColumn,
    },
    head: {
      line: selection.positionLineNumber,
      col: selection.positionColumn,
    },
  }
}

export function getActiveMonacoEditor():
  | monaco.editor.IStandaloneCodeEditor
  | null {
  return activeEditor
}

