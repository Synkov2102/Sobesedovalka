import type { PaletteMode } from '@mui/material'
import { appCssVars } from '../theme/appCssVars'

/** Базовый фон документа превью под тему хоста (letterbox вокруг приложения). */
export function injectPreviewHostTheme(
  html: string,
  mode: PaletteMode,
): string {
  const canvasBg = appCssVars[mode]['--preview-canvas-bg']
  const inject = `<style data-host-preview-theme>html{color-scheme:${mode};background:${canvasBg};}body{margin:0;background:${canvasBg};}</style>`
  if (html.includes('</head>')) {
    return html.replace('</head>', `${inject}</head>`)
  }
  return `${inject}${html}`
}
