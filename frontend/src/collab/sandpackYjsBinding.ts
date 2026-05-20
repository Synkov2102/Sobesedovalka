import { EditorView, type ViewUpdate } from '@codemirror/view'
import type * as Y from 'yjs'
import { collabSyncLog } from './collabSyncLog'

type ActiveYjsEditorBinding = {
  path: string
  yText: Y.Text
  transact: (apply: () => void) => void
  shouldIgnore?: () => boolean
  onLocalChange?: (detail: {
    insertedChars: number
    deletedChars: number
    changeCount: number
  }) => void
}

type ActiveYjsEditorBindingProvider = () => ActiveYjsEditorBinding | null

let activeProvider: ActiveYjsEditorBindingProvider | null = null

export function setSandpackYjsBindingProvider(
  provider: ActiveYjsEditorBindingProvider | null,
): void {
  activeProvider = provider
  collabSyncLog('yjs-binding', provider ? 'provider-set' : 'provider-clear')
}

export const sandpackYjsBindingExtension = EditorView.updateListener.of(
  (update: ViewUpdate) => {
    if (!update.docChanged) {
      return
    }

    const binding = activeProvider?.()
    if (!binding) {
      collabSyncLog('yjs-binding', 'skip-no-binding', {
        docLength: update.state.doc.length,
      })
      return
    }
    if (binding.shouldIgnore?.()) {
      collabSyncLog('yjs-binding', 'skip-ignored', {
        path: binding.path,
        docLength: update.state.doc.length,
      })
      return
    }

    const editorText = update.state.doc.toString()
    const yTextContent = binding.yText.toJSON()
    if (editorText === yTextContent) {
      collabSyncLog('yjs-binding', 'skip-editor-already-matches-yjs', {
        path: binding.path,
        docLength: update.state.doc.length,
        yTextLength: binding.yText.length,
      })
      return
    }

    let changeCount = 0
    let insertedChars = 0
    let deletedChars = 0
    binding.transact(() => {
      let offset = 0
      update.changes.iterChanges((fromA, toA, _fromB, _toB, inserted) => {
        changeCount += 1
        const index = fromA + offset
        const deleteCount = toA - fromA
        deletedChars += deleteCount
        if (deleteCount > 0) {
          binding.yText.delete(
            index,
            Math.min(deleteCount, binding.yText.length - index),
          )
        }

        const insertText = inserted.toString()
        insertedChars += insertText.length
        if (insertText.length > 0) {
          binding.yText.insert(index, insertText)
        }
        offset += insertText.length - deleteCount
      })
    })
    collabSyncLog('yjs-binding', 'editor-transaction', {
      path: binding.path,
      changeCount,
      insertedChars,
      deletedChars,
      yTextLength: binding.yText.length,
      editorDocLength: update.state.doc.length,
    })
    binding.onLocalChange?.({ insertedChars, deletedChars, changeCount })
  },
)
