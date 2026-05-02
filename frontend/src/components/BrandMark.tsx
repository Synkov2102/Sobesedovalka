import Box, { type BoxProps } from '@mui/material/Box'

const strokeProps = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 16,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
}

export type BrandMarkProps = {
  /** Высота/ширина в px (viewBox квадратный). */
  size?: number
  /** Для доступности при показе без текстовой метки рядом. */
  titleAccess?: string
  'aria-hidden'?: boolean
} & Pick<BoxProps, 'sx'>

/** Логотип-марк из двойной «С» (геометрический знак приложения). */
export function BrandMark({
  size = 36,
  titleAccess,
  'aria-hidden': ariaHidden = true,
  sx,
}: BrandMarkProps) {
  return (
    <Box
      component="svg"
      viewBox="0 0 220 220"
      xmlns="http://www.w3.org/2000/svg"
      role={titleAccess ? 'img' : undefined}
      aria-hidden={ariaHidden ? true : undefined}
      aria-label={titleAccess}
      sx={[
        {
          width: size,
          height: size,
          flexShrink: 0,
          display: 'block',
          color: 'primary.main',
        },
        ...(sx ? (Array.isArray(sx) ? sx : [sx]) : []),
      ]}
    >
      {titleAccess ? <title>{titleAccess}</title> : null}
      <path
        {...strokeProps}
        d="M160 60 C120 30, 60 60, 60 110 C60 160, 120 190, 160 160"
      />
      <path
        {...strokeProps}
        d="M140 85 C115 65, 85 80, 85 110 C85 140, 115 155, 140 135"
      />
    </Box>
  )
}
