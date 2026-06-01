import Editor, { type OnMount } from '@monaco-editor/react'
import { useTheme } from '@mui/material/styles'
import { useEffect, useMemo, useRef } from 'react'
import type * as monaco from 'monaco-editor'
import { getYFileText } from '../collab/collabYjsModel'
import {
  bindMonacoModelToYText,
  type MonacoYjsBindingHandle,
} from '../collab/monacoYjsBinding'
import { useCollabPaste } from '../components/collabPasteContext'
import { useCollabYDoc } from '../collab/collabYDocContext'
import { useCollabFileSync } from '../collab/collabFileSyncContext'
import {
  EditorPreferencesProvider,
  useEditorPreferences,
} from './EditorPreferencesContext'
import { EditorFileBreadcrumb } from './EditorFileBreadcrumb'
import { EditorSettingsControls } from './EditorSettingsControls'
import { useWorkspace } from './WorkspaceContext'
import { setActiveMonacoEditor } from './monacoPresence'
import { configureMonacoHtml } from './monacoHtmlEnv'
import { configureMonacoTypeScript } from './monacoTypeScriptEnv'
import { configureMonacoShiki } from './monacoShiki'
import { monacoSuggestEditorOptions } from './monacoSuggestOptions'
import {
  disposeWorkspaceModels,
  syncWorkspaceModels,
  workspaceFileUri,
} from './monacoWorkspaceModels'

/**
 * TS/JS/TSX/JSX share the TypeScript language service so JSX tags, props,
 * methods, and types get the same completions.
 */
function languageForPath(path: string): string {
  const lower = path.toLowerCase()
  if (
    lower.endsWith('.tsx') ||
    lower.endsWith('.ts') ||
    lower.endsWith('.jsx') ||
    lower.endsWith('.js')
  ) {
    return 'typescript'
  }
  if (lower.endsWith('.css')) {
    return 'css'
  }
  if (lower.endsWith('.html') || lower.endsWith('.htm')) {
    return 'html'
  }
  if (lower.endsWith('.json')) {
    return 'json'
  }
  return 'plaintext'
}

export function MonacoCodeEditor() {
  const theme = useTheme()
  return (
    <EditorPreferencesProvider appMode={theme.palette.mode}>
      <MonacoCodeEditorInner />
    </EditorPreferencesProvider>
  )
}

function MonacoCodeEditorInner() {
  const { monacoThemeId: editorTheme, font } = useEditorPreferences()
  const workspace = useWorkspace()
  const { doc, synced } = useCollabYDoc()
  const paste = useCollabPaste()
  const fileSync = useCollabFileSync()
  const editorRef = useRef<monaco.editor.IStandaloneCodeEditor | null>(null)
  const monacoApiRef = useRef<Parameters<OnMount>[1] | null>(null)
  const yjsBindingRef = useRef<MonacoYjsBindingHandle | null>(null)
  const applyingWorkspaceRef = useRef(false)
  const activeFile = workspace.activeFile
  const value = workspace.files[activeFile] ?? ''
  const language = useMemo(() => languageForPath(activeFile), [activeFile])
  const editorThemeRef = useRef(editorTheme)
  editorThemeRef.current = editorTheme

  const applyEditorTheme = (monacoApi: Parameters<OnMount>[1]) => {
    monacoApi.editor.setTheme(editorThemeRef.current)
  }

  const handleBeforeMount = async (monacoApi: Parameters<OnMount>[1]) => {
    await configureMonacoShiki(monacoApi)
    configureMonacoTypeScript(monacoApi)
    configureMonacoHtml(monacoApi)
    applyEditorTheme(monacoApi)
  }

  useEffect(() => {
    const monacoApi = monacoApiRef.current
    if (!monacoApi) {
      return
    }
    applyEditorTheme(monacoApi)
  }, [editorTheme])

  useEffect(() => {
    editorRef.current?.updateOptions({
      fontFamily: font.family,
      fontLigatures: font.ligatures,
    })
  }, [font])

  const bindEditor = useMemo(
    () => () => {
      const editor = editorRef.current
      const model = editor?.getModel()
      yjsBindingRef.current?.destroy()
      yjsBindingRef.current = null
      if (!doc || !synced || !editor || !model || !activeFile) {
        return
      }
      const yText = getYFileText(doc, activeFile)
      yjsBindingRef.current = bindMonacoModelToYText({ yText, model, editor })
    },
    [activeFile, doc, synced],
  )

  useEffect(() => {
    bindEditor()
    return () => {
      yjsBindingRef.current?.destroy()
      yjsBindingRef.current = null
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
    applyEditorTheme(monacoApi)
    editor.updateOptions({
      fontFamily: font.family,
      fontLigatures: font.ligatures,
    })
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
        <EditorFileBreadcrumb filePath={activeFile} />
        <EditorSettingsControls />
      </div>
      <Editor
        key={activeFile}
        path={workspaceFileUri(activeFile)}
        defaultValue={value}
        language={language}
        theme={editorTheme}
        beforeMount={handleBeforeMount}
        onMount={handleMount}
        onChange={(next) => {
          if (!activeFile || applyingWorkspaceRef.current) {
            return
          }
          const content = next ?? ''
          if (!doc || !synced) {
            workspace.updateWorkspaceFile(activeFile, content)
          }
          fileSync?.emitFileChange(activeFile, content)
        }}
        options={{
          ...monacoSuggestEditorOptions,
          automaticLayout: true,
          readOnly: Boolean(doc && !synced),
          readOnlyMessage: { value: 'Ожидание синхронизации комнаты...' },
          minimap: { enabled: false },
          fontSize: 14,
          fontFamily: font.family,
          fontLigatures: font.ligatures,
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
          padding: { top: 8 },
        }}
      />
    </div>
  )
}
