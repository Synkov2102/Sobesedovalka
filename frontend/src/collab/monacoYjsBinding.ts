import { MonacoBinding } from 'y-monaco'
import * as Y from 'yjs'
import type * as monaco from 'monaco-editor'

export type MonacoYjsBindingHandle = {
  binding: MonacoBinding
  undoManager: Y.UndoManager
  destroy: () => void
}

/**
 * Binds a Monaco model to Y.Text and routes undo/redo through Yjs so remote
 * edits are not reverted when the user presses Ctrl+Z.
 */
export function bindMonacoModelToYText(args: {
  yText: Y.Text
  model: monaco.editor.ITextModel
  editor: monaco.editor.IStandaloneCodeEditor
}): MonacoYjsBindingHandle {
  const { yText, model, editor } = args
  const binding = new MonacoBinding(yText, model, new Set([editor]))
  const undoManager = new Y.UndoManager(yText, {
    trackedOrigins: new Set([binding]),
  })

  const originalUndo = model.undo.bind(model)
  const originalRedo = model.redo.bind(model)
  const originalCanUndo = model.canUndo.bind(model)
  const originalCanRedo = model.canRedo.bind(model)

  model.undo = () => {
    if (undoManager.undoStack.length > 0) {
      undoManager.undo()
    }
  }
  model.redo = () => {
    if (undoManager.redoStack.length > 0) {
      undoManager.redo()
    }
  }
  model.canUndo = () => undoManager.undoStack.length > 0
  model.canRedo = () => undoManager.redoStack.length > 0

  return {
    binding,
    undoManager,
    destroy: () => {
      model.undo = originalUndo
      model.redo = originalRedo
      model.canUndo = originalCanUndo
      model.canRedo = originalCanRedo
      undoManager.destroy()
      binding.destroy()
    },
  }
}
