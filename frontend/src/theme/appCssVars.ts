import type { PaletteMode } from '@mui/material'

/** CSS-переменные Playground, проводника и превью (вне MUI). */
export const appCssVars = {
  dark: {
    '--text': '#a8abb3',
    '--text-h': '#eceef4',
    '--bg': '#1b1d24',
    '--border': '#343742',
    '--code-bg': '#23252e',
    '--accent': '#ff7700',
    '--accent-bg': 'rgba(255, 119, 0, 0.14)',
    '--accent-border': 'rgba(255, 119, 0, 0.55)',
    '--social-bg': 'rgba(35, 37, 46, 0.65)',
    '--shadow':
      'rgba(0, 0, 0, 0.45) 0 10px 15px -3px, rgba(0, 0, 0, 0.28) 0 4px 6px -2px',
    '--preview-canvas-bg': '#2a2d36',
    '--preview-chrome-mix': '#000000',
    '--page-bg': '#131418',
  },
  light: {
    '--text': '#5c616d',
    '--text-h': '#1a1c22',
    '--bg': '#ffffff',
    '--border': '#d4d7e0',
    '--code-bg': '#f0f1f4',
    '--accent': '#ff7700',
    '--accent-bg': 'rgba(255, 119, 0, 0.12)',
    '--accent-border': 'rgba(255, 119, 0, 0.45)',
    '--social-bg': 'rgba(240, 241, 244, 0.9)',
    '--shadow':
      'rgba(15, 23, 42, 0.08) 0 10px 15px -3px, rgba(15, 23, 42, 0.05) 0 4px 6px -2px',
    '--preview-canvas-bg': '#ffffff',
    '--preview-chrome-mix': '#ffffff',
    '--page-bg': '#f0f1f4',
  },
} as const satisfies Record<PaletteMode, Record<string, string>>

export function applyAppCssVars(mode: PaletteMode): void {
  const root = document.documentElement
  root.setAttribute('data-app-theme', mode)
  root.style.colorScheme = mode

  const vars = appCssVars[mode]
  for (const [name, value] of Object.entries(vars)) {
    root.style.setProperty(name, value)
  }
}
