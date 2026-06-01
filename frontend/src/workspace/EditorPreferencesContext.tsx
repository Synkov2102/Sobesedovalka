import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { PaletteMode } from '@mui/material'
import {
  editorFontById,
  readEditorColorThemePreference,
  readEditorFontId,
  resolveEditorMonacoTheme,
  writeEditorColorThemePreference,
  writeEditorFontId,
  type EditorColorThemePreference,
  type EditorFontId,
  type EditorFontOption,
  type EditorShikiThemeId,
} from './editorPreferences'

type EditorPreferencesContextValue = {
  colorTheme: EditorColorThemePreference
  setColorTheme: (value: EditorColorThemePreference) => void
  fontId: EditorFontId
  setFontId: (value: EditorFontId) => void
  font: EditorFontOption
  monacoThemeId: EditorShikiThemeId
}

const EditorPreferencesContext =
  createContext<EditorPreferencesContextValue | null>(null)

export function EditorPreferencesProvider({
  appMode,
  children,
}: {
  appMode: PaletteMode
  children: ReactNode
}) {
  const [colorTheme, setColorThemeState] = useState(readEditorColorThemePreference)
  const [fontId, setFontIdState] = useState(readEditorFontId)

  const setColorTheme = useCallback((value: EditorColorThemePreference) => {
    setColorThemeState(value)
    writeEditorColorThemePreference(value)
  }, [])

  const setFontId = useCallback((value: EditorFontId) => {
    setFontIdState(value)
    writeEditorFontId(value)
  }, [])

  const font = useMemo(() => editorFontById(fontId), [fontId])
  const monacoThemeId = useMemo(
    () => resolveEditorMonacoTheme(colorTheme, appMode),
    [appMode, colorTheme],
  )

  const value = useMemo(
    () => ({
      colorTheme,
      setColorTheme,
      fontId,
      setFontId,
      font,
      monacoThemeId,
    }),
    [colorTheme, font, fontId, monacoThemeId, setColorTheme, setFontId],
  )

  return (
    <EditorPreferencesContext.Provider value={value}>
      {children}
    </EditorPreferencesContext.Provider>
  )
}

export function useEditorPreferences(): EditorPreferencesContextValue {
  const ctx = useContext(EditorPreferencesContext)
  if (!ctx) {
    throw new Error(
      'useEditorPreferences must be used within EditorPreferencesProvider',
    )
  }
  return ctx
}
