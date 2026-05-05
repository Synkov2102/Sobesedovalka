import Box, { type BoxProps } from '@mui/material/Box'

export type BrandMarkProps = {
  /** Базовый размер, если не задан через `sx`. */
  size?: number
  /** Для доступности при показе без текстовой метки рядом. */
  titleAccess?: string
  'aria-hidden'?: boolean
} & Pick<BoxProps, 'sx'>

/** Логотип приложения (`/logo.svg`, оранжевый акцент темы). */
export function BrandMark({
  size = 36,
  titleAccess,
  'aria-hidden': ariaHidden = true,
  sx,
}: BrandMarkProps) {
  const alt = titleAccess ?? ''

  return (
    <Box
      sx={[
        {
          lineHeight: 0,
          flexShrink: 0,
          display: 'block',
          width: size,
          height: size,
        },
        ...(sx ? (Array.isArray(sx) ? sx : [sx]) : []),
      ]}
    >
      <Box
        component="img"
        src="/logo.svg"
        alt={ariaHidden && !titleAccess ? '' : alt}
        aria-hidden={ariaHidden && !titleAccess ? true : undefined}
        sx={{
          width: '100%',
          height: '100%',
          display: 'block',
          objectFit: 'contain',
        }}
      />
    </Box>
  )
}
