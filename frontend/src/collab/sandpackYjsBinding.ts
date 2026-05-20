import { Annotation } from '@codemirror/state'
import { EditorView, ViewPlugin, type ViewUpdate } from '@codemirror/view'
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
let activeEditorView: EditorView | null = null
const yjsRemoteApplyAnnotation = Annotation.define<boolean>()

export function setSandpackYjsBindingProvider(
  provider: ActiveYjsEditorBindingProvider | null,
): void {
  activeProvider = provider
  collabSyncLog('yjs-binding', provider ? 'provider-set' : 'provider-clear')
}

function syncCodeMirrorDocToContent(
  view: EditorView,
  path: string,
  content: string,
): boolean {
  const current = view.state.doc.toString()
  if (current === content) {
    collabSyncLog('yjs-binding', 'skip-editor-apply-already-matches', {
      path,
      docLength: current.length,
    })
    return true
  }

  let prefix = 0
  const minLength = Math.min(current.length, content.length)
  while (prefix < minLength && current[prefix] === content[prefix]) {
    prefix += 1
  }

  let suffix = 0
  while (
    suffix < current.length - prefix &&
    suffix < content.length - prefix &&
    current[current.length - 1 - suffix] === content[content.length - 1 - suffix]
  ) {
    suffix += 1
  }

  const from = prefix
  const to = current.length - suffix
  const insert = content.slice(prefix, content.length - suffix)
  view.dispatch({
    changes: {
      from,
      to,
      insert,
    },
    annotations: yjsRemoteApplyAnnotation.of(true),
  })
  collabSyncLog('yjs-binding', 'apply-yjs-to-active-editor', {
    path,
    from,
    deleteCount: to - from,
    insertLen: insert.length,
    nextLen: content.length,
  })
  return true
}

export function applyYjsContentToActiveSandpackEditor(
  path: string,
  content: string,
): boolean {
  const binding = activeProvider?.()
  if (!binding || binding.path !== path || !activeEditorView) {
    collabSyncLog('yjs-binding', 'skip-active-editor-apply-no-view', {
      path,
      bindingPath: binding?.path ?? '',
      hasView: Boolean(activeEditorView),
    })
    return false
  }

  return syncCodeMirrorDocToContent(activeEditorView, path, content)
}

const sandpackYjsEditorViewPlugin = ViewPlugin.fromClass(
  class {
    constructor(view: EditorView) {
      activeEditorView = view
      collabSyncLog('yjs-binding', 'active-view-set', {
        docLength: view.state.doc.length,
      })
    }

    update(update: ViewUpdate) {
      activeEditorView = update.view
    }

    destroy() {
      if (activeEditorView) {
        collabSyncLog('yjs-binding', 'active-view-clear', {
          docLength: activeEditorView.state.doc.length,
        })
      }
      activeEditorView = null
    }
  },
)

const sandpackYjsEditorChangeListener = EditorView.updateListener.of(
  (update: ViewUpdate) => {
    activeEditorView = update.view
    if (!update.docChanged) {
      return
    }
    if (
      update.transactions.some((transaction) =>
        transaction.annotation(yjsRemoteApplyAnnotation),
      )
    ) {
      const binding = activeProvider?.()
      collabSyncLog('yjs-binding', 'skip-remote-editor-apply', {
        path: binding?.path ?? '',
        docLength: update.state.doc.length,
      })
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

export const sandpackYjsBindingExtension = [
  sandpackYjsEditorViewPlugin,
  sandpackYjsEditorChangeListener,
]
