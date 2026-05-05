import ButtonBase from '@mui/material/ButtonBase'
import Stack from '@mui/material/Stack'
import Typography from '@mui/material/Typography'
import { BrandMark } from './BrandMark'

const wordmarkSx = {
  fontWeight: 800,
  letterSpacing: '-0.03em',
  color: 'primary.main',
  fontSize: { xs: '1.2rem', sm: '1.4rem' },
  lineHeight: 1.15,
  m: 0,
} as const

type AppBrandWordmarkProps = {
  /** Если передан — марка кликабельна и ведёт к списку комнат (выход из редактора при необходимости). */
  onNavigateHome?: () => void
}

export function AppBrandWordmark({ onNavigateHome }: AppBrandWordmarkProps) {
  const label = (
    <Stack direction="row" spacing={0} sx={{ alignItems: 'center' }}>
      <BrandMark
        sx={{
          width: { xs: 36, sm: 40 },
          height: { xs: 36, sm: 40 },
        }}
      />
      <Typography component="span" variant="h6" sx={wordmarkSx}>
        Собесилка
      </Typography>
    </Stack>
  )

  if (onNavigateHome) {
    return (
      <ButtonBase
        aria-label="Собесилка — перейти к комнатам"
        onClick={onNavigateHome}
        sx={{
          borderRadius: 1,
          px: 0.5,
          mx: -0.5,
          '&:hover .MuiTypography-root': {
            color: 'primary.light',
          },
          '&:hover img': {
            filter: 'brightness(1.15)',
          },
        }}
      >
        {label}
      </ButtonBase>
    )
  }

  return label
}
