import { createTheme } from '@mui/material/styles'

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

export const appTheme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: acidOrange.main,
      light: acidOrange.light,
      dark: acidOrange.dark,
      contrastText: '#0e0f12',
    },
    secondary: {
      main: '#5c616d',
      light: '#757a87',
      dark: '#454952',
      contrastText: slate.heading,
    },
    background: {
      default: slate.bg,
      paper: slate.paper,
    },
    text: {
      primary: slate.heading,
      secondary: slate.muted,
    },
    divider: slate.border,
    error: {
      main: '#f87171',
    },
    success: {
      main: '#4ade80',
    },
  },
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
          backgroundColor: slate.bg,
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
        root: {
          textTransform: 'none',
          fontWeight: 600,
          borderColor: slate.border,
          '&.Mui-selected': {
            color: acidOrange.main,
            backgroundColor: 'rgba(255, 119, 0, 0.12)',
            borderColor: `${acidOrange.main} !important`,
            '&:hover': {
              backgroundColor: 'rgba(255, 119, 0, 0.18)',
            },
          },
        },
      },
    },
  },
})
