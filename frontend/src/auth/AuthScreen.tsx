import { type FormEvent, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Paper,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { useAuth } from './useAuth'
import { appShellPageSx, sectionSurfacePaddingSx } from '../theme/layout'
import { AppBrandWordmark } from '../components/AppBrandWordmark'

type Mode = 'login' | 'register'

export function AuthScreen() {
  const { login, register, authError, clearAuthError } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [loginField, setLoginField] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)

  function switchMode(next: Mode) {
    setMode(next)
    clearAuthError()
    setLocalError(null)
  }

  async function onLogin(e: FormEvent) {
    e.preventDefault()
    const l = loginField.trim()
    if (!l || !password || busy) {
      return
    }
    setBusy(true)
    setLocalError(null)
    clearAuthError()
    try {
      await login(l, password)
    } catch {
      // authError set in context
    } finally {
      setBusy(false)
    }
  }

  async function onRegister(e: FormEvent) {
    e.preventDefault()
    if (!password.trim() || busy) {
      return
    }
    const eTrim = email.trim()
    const pTrim = phone.trim()
    if (!eTrim && !pTrim) {
      setLocalError('Укажите почту или номер телефона')
      return
    }
    if (password.length < 8) {
      setLocalError('Пароль не короче 8 символов')
      return
    }
    setBusy(true)
    setLocalError(null)
    clearAuthError()
    try {
      await register({ email, phone, password })
    } catch {
      // authError in context
    } finally {
      setBusy(false)
    }
  }

  const displayError = localError ?? authError

  return (
    <Box sx={appShellPageSx}>
      <Box component="header" sx={{ mb: 3 }}>
        <AppBrandWordmark />
        <Typography
          variant="h5"
          component="h1"
          sx={{
            mb: 1.25,
            mt: 2,
            fontWeight: 700,
            letterSpacing: '-0.02em',
          }}
        >
          {mode === 'login' ? 'Вход' : 'Регистрация'}
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Войдите или зарегистрируйтесь по почте и/или номеру телефона и паролю.
          Подтверждение почты и телефона пока не требуется.
        </Typography>
      </Box>

      <ToggleButtonGroup
        exclusive
        size="small"
        value={mode}
        onChange={(_, v: Mode | null) => v && switchMode(v)}
        aria-label="Режим"
        sx={{ mb: 2.5, display: 'flex', flexWrap: 'wrap', gap: 1 }}
      >
        <ToggleButton value="login">Вход</ToggleButton>
        <ToggleButton value="register">Регистрация</ToggleButton>
      </ToggleButtonGroup>

      <Paper
        component="section"
        variant="outlined"
        aria-label={mode === 'login' ? 'Вход' : 'Регистрация'}
        sx={sectionSurfacePaddingSx}
      >
        {displayError ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {displayError}
          </Alert>
        ) : null}

        {mode === 'login' ? (
          <Stack
            component="form"
            spacing={2}
            onSubmit={(ev) => void onLogin(ev)}
            noValidate
          >
            <TextField
              id="auth-login"
              label="Почта или телефон"
              value={loginField}
              onChange={(ev) => setLoginField(ev.target.value)}
              autoComplete="username"
              slotProps={{ htmlInput: { maxLength: 320 } }}
              fullWidth
              size="small"
            />
            <TextField
              id="auth-password"
              label="Пароль"
              type="password"
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              autoComplete="current-password"
              slotProps={{ htmlInput: { maxLength: 128 } }}
              fullWidth
              size="small"
            />
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={busy || !loginField.trim() || !password}
            >
              Войти
            </Button>
          </Stack>
        ) : (
          <Stack
            component="form"
            spacing={2}
            onSubmit={(ev) => void onRegister(ev)}
            noValidate
          >
            <TextField
              id="auth-email"
              label="Почта (необязательно)"
              type="text"
              value={email}
              onChange={(ev) => setEmail(ev.target.value)}
              autoComplete="email"
              slotProps={{ htmlInput: { maxLength: 320 } }}
              fullWidth
              size="small"
            />
            <TextField
              id="auth-phone"
              label="Телефон (необязательно)"
              type="text"
              value={phone}
              onChange={(ev) => setPhone(ev.target.value)}
              autoComplete="tel"
              slotProps={{ htmlInput: { maxLength: 64 } }}
              fullWidth
              size="small"
            />
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{ mt: -0.5 }}
            >
              Нужно заполнить хотя бы одно из двух полей выше.
            </Typography>
            <TextField
              id="auth-reg-password"
              label="Пароль (мин. 8 символов)"
              type="password"
              value={password}
              onChange={(ev) => setPassword(ev.target.value)}
              autoComplete="new-password"
              slotProps={{ htmlInput: { maxLength: 128 } }}
              fullWidth
              size="small"
            />
            <Button
              type="submit"
              variant="contained"
              color="primary"
              disabled={busy || !password.trim()}
            >
              Зарегистрироваться
            </Button>
          </Stack>
        )}
      </Paper>
    </Box>
  )
}
