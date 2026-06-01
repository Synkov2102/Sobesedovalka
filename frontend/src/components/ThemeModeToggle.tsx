import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined'
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined'
import { IconButton, Tooltip } from '@mui/material'
import { useThemeMode } from '../theme/ThemeModeProvider'

export function ThemeModeToggle() {
  const { mode, toggleMode } = useThemeMode()
  const isDark = mode === 'dark'

  return (
    <Tooltip title={isDark ? 'Светлая тема' : 'Тёмная тема'}>
      <IconButton
        onClick={toggleMode}
        size="small"
        color="inherit"
        aria-label={isDark ? 'Включить светлую тему' : 'Включить тёмную тему'}
        sx={{ color: 'text.secondary' }}
      >
        {isDark ? (
          <LightModeOutlinedIcon fontSize="small" />
        ) : (
          <DarkModeOutlinedIcon fontSize="small" />
        )}
      </IconButton>
    </Tooltip>
  )
}
