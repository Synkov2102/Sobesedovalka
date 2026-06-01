import { createTheme, type PaletteMode } from '@mui/material/styles'

/** Кислотно-оранжевый акцент (CTA, активные табы). */
export const acidOrange = {
  main: '#FF7700',
  light: '#FF9A40',
  dark: '#CC5F00',
} as const

/** Тёмно-серая база интерфейса. */
export const slate = {
  bg: '#131418',
  paper: '#1b1d24',
  elevated: '#23252e',
  border: '#343742',
  muted: '#9aa0ae',
  heading: '#eceef4',
} as const

/** Светлая база интерфейса. */
export const lightSlate = {
  bg: '#f0f1f4',
  paper: '#ffffff',
  elevated: '#e8eaef',
  border: '#d4d7e0',
  muted: '#5c616d',
  heading: '#1a1c22',
} as const

function paletteForMode(mode: PaletteMode) {
  const isDark = mode === 'dark'
  const colors = isDark ? slate : lightSlate

  return {
    mode,
    primary: {
      main: acidOrange.main,
      light: acidOrange.light,
      dark: acidOrange.dark,
      contrastText: '#0e0f12',
    },
    secondary: {
      main: isDark ? '#5c616d' : '#757a87',
      light: isDark ? '#757a87' : '#9298a6',
      dark: isDark ? '#454952' : '#5c616d',
      contrastText: colors.heading,
    },
    background: {
      default: colors.bg,
      paper: colors.paper,
    },
    text: {
      primary: colors.heading,
      secondary: colors.muted,
    },
    divider: colors.border,
    error: {
      main: '#f87171',
    },
    success: {
      main: '#4ade80',
    },
  } as const
}

export function createAppTheme(mode: PaletteMode) {
  const isDark = mode === 'dark'
  const colors = isDark ? slate : lightSlate
  const selectedToggleBg = isDark
    ? 'rgba(255, 119, 0, 0.12)'
    : 'rgba(255, 119, 0, 0.1)'
  const selectedToggleHoverBg = isDark
    ? 'rgba(255, 119, 0, 0.18)'
    : 'rgba(255, 119, 0, 0.16)'

  return createTheme({
    palette: paletteForMode(mode),
    shape: {
      borderRadius: 10,
    },
    typography: {
      fontFamily: [
        'system-ui',
        'Segoe UI',
        'Roboto',
        'Helvetica',
        'Arial',
        'sans-serif',
      ].join(','),
      h1: {
        fontWeight: 600,
        letterSpacing: '-0.02em',
      },
      h2: {
        fontWeight: 600,
        fontSize: '1.25rem',
      },
      h3: {
        fontWeight: 600,
        fontSize: '1.05rem',
      },
      button: {
        textTransform: 'none',
        fontWeight: 600,
      },
    },
    components: {
      MuiCssBaseline: {
        styleOverrides: {
          body: {
            backgroundColor: colors.bg,
          },
        },
      },
      /** Сброс голубого фона автозаполнения Chrome/Safari/Edge (-webkit-autofill). */
      MuiInputBase: {
        styleOverrides: {
          root: ({ theme }) => {
            const bg = theme.palette.background.paper
            const fg = theme.palette.text.primary
            const autofill = {
              WebkitBoxShadow: `0 0 0 1000px ${bg} inset`,
              WebkitTextFillColor: fg,
              caretColor: fg,
              transition: 'background-color 99999s ease-out 0s',
            }
            return {
              '& .MuiInputBase-input:-webkit-autofill': autofill,
              '& .MuiInputBase-input:-webkit-autofill:hover': autofill,
              '& .MuiInputBase-input:-webkit-autofill:focus': autofill,
              '& .MuiInputBase-input:-webkit-autofill:active': autofill,
            }
          },
        },
      },
      MuiButton: {
        defaultProps: {
          disableElevation: true,
        },
      },
      MuiPaper: {
        styleOverrides: {
          root: {
            backgroundImage: 'none',
          },
        },
      },
      MuiToggleButton: {
        styleOverrides: {
          root: ({ theme }) => ({
            textTransform: 'none',
            fontWeight: 600,
            borderColor: theme.palette.divider,
            '&.Mui-selected': {
              color: acidOrange.main,
              backgroundColor: selectedToggleBg,
              borderColor: `${acidOrange.main} !important`,
              '&:hover': {
                backgroundColor: selectedToggleHoverBg,
              },
            },
          }),
        },
      },
    },
  })
}
