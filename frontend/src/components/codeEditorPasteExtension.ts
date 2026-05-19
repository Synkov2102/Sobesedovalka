import { EditorView } from '@codemirror/view'

type PasteHandler = (event: ClipboardEvent, view: EditorView) => void

let activePasteHandler: PasteHandler | null = null

export function setCodeEditorPasteHandler(handler: PasteHandler | null): void {
  activePasteHandler = handler
}

export const codeEditorPasteExtension = EditorView.domEventHandlers({
  paste(event, view) {
    activePasteHandler?.(event, view)
  },
})
