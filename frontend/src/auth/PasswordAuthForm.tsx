import { type FormEvent, useState } from 'react'
import {
  Button,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import { useAuth } from './useAuth'

type Mode = 'login' | 'register'

type Props = {
  busy: boolean
  onBusyChange: (busy: boolean) => void
  onLocalError: (message: string | null) => void
}

export function PasswordAuthForm({ busy, onBusyChange, onLocalError }: Props) {
  const { login, register, clearAuthError } = useAuth()
  const [mode, setMode] = useState<Mode>('login')
  const [loginField, setLoginField] = useState('')
  const [email, setEmail] = useState('')
  const [phone, setPhone] = useState('')
  const [password, setPassword] = useState('')

  function switchMode(next: Mode) {
    setMode(next)
    clearAuthError()
    onLocalError(null)
  }

  async function onLogin(e: FormEvent) {
    e.preventDefault()
    const l = loginField.trim()
    if (!l || !password || busy) {
      return
    }
    onBusyChange(true)
    onLocalError(null)
    clearAuthError()
    try {
      await login(l, password)
    } catch {
      // authError set in context
    } finally {
      onBusyChange(false)
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
      onLocalError('Укажите почту или номер телефона')
      return
    }
    if (password.length < 8) {
      onLocalError('Пароль не короче 8 символов')
      return
    }
    onBusyChange(true)
    onLocalError(null)
    clearAuthError()
    try {
      await register({ email, phone, password })
    } catch {
      // authError in context
    } finally {
      onBusyChange(false)
    }
  }

  return (
    <Stack spacing={2}>
      <ToggleButtonGroup
        exclusive
        size="small"
        value={mode}
        onChange={(_, v: Mode | null) => v && switchMode(v)}
        aria-label="Режим входа по паролю"
        sx={{ display: 'flex', flexWrap: 'wrap', gap: 1 }}
      >
        <ToggleButton value="login">Вход</ToggleButton>
        <ToggleButton value="register">Регистрация</ToggleButton>
      </ToggleButtonGroup>

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
          <Typography variant="body2" color="text.secondary" sx={{ mt: -0.5 }}>
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
    </Stack>
  )
}
