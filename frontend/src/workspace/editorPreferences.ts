/** Темы Shiki, зарегистрированные в Monaco (см. monacoShiki.ts). */
export const EDITOR_SHIKI_THEMES = [
  'dark-plus',
  'light-plus',
  'github-dark',
  'github-light',
  'dracula',
  'catppuccin-mocha',
  'catppuccin-latte',
  'ayu-dark',
  'ayu-light',
] as const

export type EditorShikiThemeId = (typeof EDITOR_SHIKI_THEMES)[number]

export type EditorColorThemePreference = 'app' | EditorShikiThemeId

export type EditorFontId =
  | 'cascadia'
  | 'jetbrains'
  | 'fira'
  | 'sf-mono'
  | 'consolas'
  | 'system'

export type EditorFontOption = {
  id: EditorFontId
  label: string
  family: string
  ligatures: boolean
}

export const EDITOR_FONT_OPTIONS: EditorFontOption[] = [
  {
    id: 'cascadia',
    label: 'Cascadia Code',
    family: '"Cascadia Code", "Cascadia Mono", Consolas, monospace',
    ligatures: true,
  },
  {
    id: 'jetbrains',
    label: 'JetBrains Mono',
    family: '"JetBrains Mono", Consolas, monospace',
    ligatures: true,
  },
  {
    id: 'fira',
    label: 'Fira Code',
    family: '"Fira Code", Consolas, monospace',
    ligatures: true,
  },
  {
    id: 'sf-mono',
    label: 'SF Mono',
    family: 'SFMono-Regular, ui-monospace, Menlo, monospace',
    ligatures: false,
  },
  {
    id: 'consolas',
    label: 'Consolas',
    family: 'Consolas, "Courier New", monospace',
    ligatures: false,
  },
  {
    id: 'system',
    label: 'Системный',
    family: 'ui-monospace, SFMono-Regular, Consolas, monospace',
    ligatures: false,
  },
]

export const EDITOR_COLOR_THEME_OPTIONS: {
  value: EditorColorThemePreference
  label: string
  group: 'sync' | 'dark' | 'light'
}[] = [
  { value: 'app', label: 'Как в приложении', group: 'sync' },
  { value: 'dark-plus', label: 'Dark+', group: 'dark' },
  { value: 'github-dark', label: 'GitHub Dark', group: 'dark' },
  { value: 'dracula', label: 'Dracula', group: 'dark' },
  { value: 'catppuccin-mocha', label: 'Catppuccin Mocha', group: 'dark' },
  { value: 'ayu-dark', label: 'Ayu Dark', group: 'dark' },
  { value: 'light-plus', label: 'Light+', group: 'light' },
  { value: 'github-light', label: 'GitHub Light', group: 'light' },
  { value: 'catppuccin-latte', label: 'Catppuccin Latte', group: 'light' },
  { value: 'ayu-light', label: 'Ayu Light', group: 'light' },
]

const STORAGE_COLOR_THEME = 'sobesedovalka-editor-color-theme'
const STORAGE_FONT = 'sobesedovalka-editor-font'

const shikiThemeSet = new Set<string>(EDITOR_SHIKI_THEMES)
const fontIdSet = new Set<string>(EDITOR_FONT_OPTIONS.map((f) => f.id))

export function isEditorShikiThemeId(
  value: string,
): value is EditorShikiThemeId {
  return shikiThemeSet.has(value)
}

export function readEditorColorThemePreference(): EditorColorThemePreference {
  try {
    const stored = localStorage.getItem(STORAGE_COLOR_THEME)
    if (stored === 'app' || (stored && isEditorShikiThemeId(stored))) {
      return stored
    }
  } catch {
    // ignore
  }
  return 'app'
}

export function writeEditorColorThemePreference(
  value: EditorColorThemePreference,
): void {
  try {
    localStorage.setItem(STORAGE_COLOR_THEME, value)
  } catch {
    // ignore
  }
}

export function readEditorFontId(): EditorFontId {
  try {
    const stored = localStorage.getItem(STORAGE_FONT)
    if (stored && fontIdSet.has(stored)) {
      return stored as EditorFontId
    }
  } catch {
    // ignore
  }
  return 'cascadia'
}

export function writeEditorFontId(value: EditorFontId): void {
  try {
    localStorage.setItem(STORAGE_FONT, value)
  } catch {
    // ignore
  }
}

export function editorFontById(id: EditorFontId): EditorFontOption {
  return EDITOR_FONT_OPTIONS.find((f) => f.id === id) ?? EDITOR_FONT_OPTIONS[0]
}

export function resolveEditorMonacoTheme(
  preference: EditorColorThemePreference,
  appMode: 'dark' | 'light',
): EditorShikiThemeId {
  if (preference === 'app') {
    return appMode === 'dark' ? 'dark-plus' : 'light-plus'
  }
  return preference
}
