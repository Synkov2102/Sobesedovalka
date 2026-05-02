import type { SxProps, Theme } from '@mui/material/styles'

/** Единая ширина контентной колонки (комнаты, пресеты, экран входа). */
export const APP_CONTENT_MAX_WIDTH_PX = 1152

/**
 * Корневой контейнер страниц вне редактора комнаты.
 * Совпадает с прежними значениями из App.tsx для не-песочницы.
 */
export const appShellPageSx: SxProps<Theme> = {
  boxSizing: 'border-box',
  textAlign: 'left',
  maxWidth: APP_CONTENT_MAX_WIDTH_PX,
  mx: 'auto',
  px: { xs: 2, sm: 'clamp(16px, 3vw, 28px)' },
  pt: 4,
  pb: 6,
}

/** Внутренние отступы основной поверхности раздела (карточка пресетов, блоки контента). */
export const sectionSurfacePaddingSx: SxProps<Theme> = {
  p: { xs: 2.5, sm: 3 },
}

/** Полноэкранный shell: редактор комнаты (?room) и редактор пресета (?preset=new или ?preset=<id>). */
export const editorFullScreenShellSx: SxProps<Theme> = {
  boxSizing: 'border-box',
  textAlign: 'left',
  maxWidth: 'none',
  width: '100%',
  height: '100svh',
  minHeight: '100svh',
  maxHeight: '100svh',
  overflow: 'hidden',
  display: 'flex',
  flexDirection: 'column',
  px: { xs: 1, sm: 2 },
  py: 1,
}
