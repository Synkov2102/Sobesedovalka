import {
  FormControl,
  ListSubheader,
  MenuItem,
  Select,
  type SelectChangeEvent,
} from '@mui/material'
import {
  EDITOR_COLOR_THEME_OPTIONS,
  EDITOR_FONT_OPTIONS,
  type EditorColorThemePreference,
  type EditorFontId,
} from './editorPreferences'
import { useEditorPreferences } from './EditorPreferencesContext'

export function EditorSettingsControls() {
  const { colorTheme, setColorTheme, fontId, setFontId } =
    useEditorPreferences()

  const handleThemeChange = (event: SelectChangeEvent) => {
    setColorTheme(event.target.value as EditorColorThemePreference)
  }

  const handleFontChange = (event: SelectChangeEvent) => {
    setFontId(event.target.value as EditorFontId)
  }

  return (
    <div className="playground__editorSettings">
      <FormControl
        size="small"
        className="playground__editorSetting"
        title="Цветовая тема редактора"
      >
        <Select
          value={colorTheme}
          onChange={handleThemeChange}
          aria-label="Тема редактора"
          variant="outlined"
        >
          {EDITOR_COLOR_THEME_OPTIONS.filter((o) => o.group === 'sync').map(
            (option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ),
          )}
          <ListSubheader>Тёмные</ListSubheader>
          {EDITOR_COLOR_THEME_OPTIONS.filter((o) => o.group === 'dark').map(
            (option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ),
          )}
          <ListSubheader>Светлые</ListSubheader>
          {EDITOR_COLOR_THEME_OPTIONS.filter((o) => o.group === 'light').map(
            (option) => (
              <MenuItem key={option.value} value={option.value}>
                {option.label}
              </MenuItem>
            ),
          )}
        </Select>
      </FormControl>
      <FormControl
        size="small"
        className="playground__editorSetting"
        title="Моноширинный шрифт (нужен установленный в системе)"
      >
        <Select
          value={fontId}
          onChange={handleFontChange}
          aria-label="Шрифт редактора"
          variant="outlined"
        >
          {EDITOR_FONT_OPTIONS.map((option) => (
            <MenuItem key={option.id} value={option.id}>
              {option.label}
            </MenuItem>
          ))}
        </Select>
      </FormControl>
    </div>
  )
}
