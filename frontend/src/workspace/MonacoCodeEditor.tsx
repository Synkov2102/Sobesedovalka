import Editor, { type OnMount } from '@monaco-editor/react'
import { useTheme } from '@mui/material/styles'
import { useEffect, useMemo, useRef } from 'react'
import type * as monaco from 'monaco-editor'
import type * as Y from 'yjs'
import { getYFileText, replaceYText } from '../collab/collabYjsModel'
import { useCollabPaste } from '../components/collabPasteContext'
import { useCollabYDoc } from '../collab/collabYDocContext'
import { useCollabFileSync } from '../collab/collabFileSyncContext'
import { useWorkspace } from './WorkspaceContext'
import { setActiveMonacoEditor } from './monacoPresence'
import { configureMonacoTypeScript } from './monacoTypeScriptEnv'
import { configureMonacoShiki, monacoThemeId } from './monacoShiki'
import {
  disposeWorkspaceModels,
  syncWorkspaceModels,
} from './monacoWorkspaceModels'

/** Monaco TS language service is wired only to `typescript` / `javascript` ids. */
function languageForPath(path: string): string {
  if (path.endsWith('.tsx') || path.endsWith('.ts')) {
    return 'typescript'
  }
  if (path.endsWith('.jsx') || path.endsWith('.js')) {
    return 'javascript'
  }
  if (path.endsWith('.css')) {
    return 'css'
  }
  if (path.endsWith('.html')) {
    return 'html'
  }
  if (path.endsWith('.json')) {
    return 'json'
  }
  return 'plaintext'
}

export function MonacoCodeEditor() {
  const theme = useTheme()
  const workspace = useWorkspace()
  const { doc, synced } = useCollabYDoc()
  const paste = useCollabPaste()
  const fileSync = useCollabFileSync()
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const monacoApiRef = useRef<Parameters<OnMount>[1] | null>(null)
  const bindingCleanupRef = useRef<(() => void) | null>(null)
  const applyingWorkspaceRef = useRef(false)
  const applyingYjsRef = useRef(false)
  const activeFile = workspace.activeFile
  const value = workspace.files[activeFile] ?? ''
  const language = useMemo(() => languageForPath(activeFile), [activeFile])
  const editorTheme = monacoThemeId(theme.palette.mode === 'dark' ? 'dark' : 'light')

  const handleBeforeMount = async (monacoApi: Parameters<OnMount>[1]) => {
    await configureMonacoShiki(monacoApi)
    configureMonacoTypeScript(monacoApi)
  }

  const bindEditor = useMemo(
    () => () => {
      const editor = editorRef.current
      const model = editor?.getModel()
      bindingCleanupRef.current?.()
      bindingCleanupRef.current = null
      if (!doc || !synced || !editor || !model || !activeFile) {
        return
      }
      const yText = getYFileText(doc, activeFile)

      const syncModelToYText = () => {
        const yValue = yText.toJSON()
        if (model.getValue() === yValue) {
          return
        }
        applyingYjsRef.current = true
        try {
          model.setValue(yValue)
        } finally {
          applyingYjsRef.current = false
        }
      }

      const onYTextChange = (event: Y.YTextEvent, transaction: Y.Transaction) => {
        if (transaction.origin === 'monaco-editor') {
          return
        }
        applyingYjsRef.current = true
        try {
          let index = 0
          const edits: monaco.editor.IIdentifiedSingleEditOperation[] = []
          for (const op of event.delta) {
            if (op.retain !== undefined) {
              index += op.retain
            } else if (op.insert !== undefined) {
              const pos = model.getPositionAt(index)
              edits.push({
                range: {
                  startLineNumber: pos.lineNumber,
                  startColumn: pos.column,
                  endLineNumber: pos.lineNumber,
                  endColumn: pos.column,
                },
                text: String(op.insert),
              })
              index += String(op.insert).length
            } else if (op.delete !== undefined) {
              const start = model.getPositionAt(index)
              const end = model.getPositionAt(index + op.delete)
              edits.push({
                range: {
                  startLineNumber: start.lineNumber,
                  startColumn: start.column,
                  endLineNumber: end.lineNumber,
                  endColumn: end.column,
                },
                text: '',
              })
            }
          }
          if (edits.length > 0) {
            model.applyEdits(edits)
          }
        } finally {
          applyingYjsRef.current = false
        }
      }

      yText.observe(onYTextChange)
      syncModelToYText()
      bindingCleanupRef.current = () => {
        yText.unobserve(onYTextChange)
      }
    },
    [activeFile, doc, synced],
  )

  useEffect(() => {
    bindEditor()
    return () => {
      bindingCleanupRef.current?.()
      bindingCleanupRef.current = null
    }
  }, [bindEditor])

  useEffect(() => {
    const monacoApi = monacoApiRef.current
    if (!monacoApi || !activeFile) {
      return
    }
    syncWorkspaceModels(monacoApi, workspace.files, {
      activePath: activeFile,
      languageForPath: languageForPath,
    })
  }, [activeFile, workspace.files])

  useEffect(() => {
    return () => {
      const monacoApi = monacoApiRef.current
      if (monacoApi) {
        disposeWorkspaceModels(monacoApi)
      }
    }
  }, [])

  useEffect(() => {
    const model = editorRef.current?.getModel()
    if (!model || !activeFile || model.getValue() === value) {
      return
    }
    // With Yjs synced, the model is driven by Y.Text deltas — full replace resets the caret.
    if (doc && synced) {
      return
    }
    const editor = editorRef.current
    const selection = editor?.getSelection()
    const scrollTop = editor?.getScrollTop()
    applyingWorkspaceRef.current = true
    try {
      model.setValue(value)
      if (editor && selection) {
        editor.setSelection(selection)
        if (scrollTop !== undefined) {
          editor.setScrollTop(scrollTop)
        }
      }
    } finally {
      applyingWorkspaceRef.current = false
    }
  }, [activeFile, doc, synced, value])

  const handleMount: OnMount = (editor, monacoApi) => {
    monacoApiRef.current = monacoApi
    editorRef.current = editor
    setActiveMonacoEditor(editor)
    syncWorkspaceModels(monacoApi, workspace.files, {
      activePath: activeFile,
      languageForPath: languageForPath,
    })
    editor.onDidDispose(() => {
      if (editorRef.current === editor) {
        editorRef.current = null
        setActiveMonacoEditor(null)
      }
    })
    editor.onDidPaste((event) => {
      const recordPaste = paste?.recordPaste
      if (!recordPaste || !activeFile) {
        return
      }
      const model = editor.getModel()
      const range = event.range
      if (!model || !range) {
        return
      }
      const content = model.getValueInRange(range)
      if (!content) {
        return
      }
      const startOffset = model.getOffsetAt(range.getStartPosition())
      const endOffset = model.getOffsetAt(range.getEndPosition())
      recordPaste({
        path: activeFile,
        content,
        fileContent: model.getValue(),
        insertStartOffset: startOffset,
        insertEndOffset: endOffset,
        line: range.startLineNumber,
        col: range.startColumn,
      })
    })
    bindEditor()
  }

  if (!activeFile) {
    return (
      <div className="playground__emptyEditor">
        Создайте или выберите файл, чтобы начать редактирование.
      </div>
    )
  }

  return (
    <div className="playground__editorPane">
      <div className="playground__editorTabs">
        <span className="playground__editorTab is-active">{activeFile}</span>
      </div>
      <Editor
        key={activeFile}
        path={activeFile}
        defaultValue={value}
        language={language}
        theme={editorTheme}
        beforeMount={handleBeforeMount}
        onMount={handleMount}
        onChange={(next) => {
          if (
            !activeFile ||
            applyingWorkspaceRef.current ||
            applyingYjsRef.current
          ) {
            return
          }
          const content = next ?? ''
          workspace.updateWorkspaceFile(activeFile, content)
          if (doc && synced) {
            const yText = getYFileText(doc, activeFile)
            if (yText.toJSON() !== content) {
              doc.transact(() => {
                replaceYText(yText, content)
              }, 'monaco-editor')
            }
          }
          fileSync?.emitFileChange(activeFile, content)
        }}
        options={{
          automaticLayout: true,
          readOnly: Boolean(doc && !synced),
          readOnlyMessage: { value: 'Ожидание синхронизации комнаты...' },
          minimap: { enabled: false },
          fontSize: 14,
          fontFamily:
            'Cascadia Code, Consolas, "Courier New", monospace',
          fontLigatures: true,
          tabSize: 2,
          scrollBeyondLastLine: false,
          wordWrap: 'on',
          smoothScrolling: true,
          cursorBlinking: 'smooth',
          cursorSmoothCaretAnimation: 'on',
          renderWhitespace: 'selection',
          bracketPairColorization: { enabled: true },
          guides: {
            bracketPairs: true,
            bracketPairsHorizontal: 'active',
            indentation: true,
            highlightActiveIndentation: true,
          },
          'semanticHighlighting.enabled': true,
          hover: { enabled: true, delay: 300 },
          quickSuggestions: {
            other: true,
            comments: false,
            strings: true,
          },
          parameterHints: { enabled: true },
          padding: { top: 8 },
        }}
      />
    </div>
  )
}

