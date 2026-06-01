import { useCallback, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Collapse,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { useAuth } from './useAuth'
import { appShellPageSx, sectionSurfacePaddingSx } from '../theme/layout'
import { AppBrandWordmark } from '../components/AppBrandWordmark'
import { PasswordAuthForm } from './PasswordAuthForm'
import { useYandexOAuthCallback } from './useYandexOAuthCallback'
import { VkOneTapLogin } from './VkOneTapLogin'
import { YandexLoginButton } from './YandexLoginButton'
import { vkAppId } from './vkPkce'
import { yandexClientId } from './yandexOAuth'

type VkAuthPayload = {
  code: string
  device_id: string
  state: string
}

export function AuthScreen() {
  const { loginWithVk, authError, clearAuthError } = useAuth()
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [showPasswordAuth, setShowPasswordAuth] = useState(false)

  const appId = vkAppId()
  const yandexId = yandexClientId()
  const displayError = localError ?? authError

  useYandexOAuthCallback((message) => setLocalError(message))

  const handleVkSuccess = useCallback(
    async (payload: VkAuthPayload) => {
      if (busy) {
        return
      }
      setBusy(true)
      setLocalError(null)
      clearAuthError()
      try {
        await loginWithVk({
          code: payload.code,
          deviceId: payload.device_id,
          state: payload.state,
        })
      } catch {
        // authError set in context
      } finally {
        setBusy(false)
      }
    },
    [busy, clearAuthError, loginWithVk],
  )

  const handleVkError = useCallback((message: string) => {
    setLocalError(message)
  }, [])

  function openPasswordAuth() {
    clearAuthError()
    setLocalError(null)
    setShowPasswordAuth(true)
  }

  function closePasswordAuth() {
    clearAuthError()
    setLocalError(null)
    setShowPasswordAuth(false)
  }

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
          Вход
        </Typography>
        <Typography variant="body1" color="text.secondary">
          Войдите через VK ID или Яндекс. Почта и пароль — по кнопке ниже.
        </Typography>
      </Box>

      <Paper
        component="section"
        variant="outlined"
        aria-label="Вход"
        sx={sectionSurfacePaddingSx}
      >
        {displayError ? (
          <Alert severity="error" sx={{ mb: 2 }}>
            {displayError}
          </Alert>
        ) : null}

        <Stack spacing={2} sx={{ opacity: busy ? 0.6 : 1 }}>
          {!appId ? (
            <Alert severity="warning" sx={{ mb: 0 }}>
              Не задан <code>VITE_VK_APP_ID</code> — виджет VK ID недоступен.
            </Alert>
          ) : (
            <VkOneTapLogin
              onSuccess={(p) => void handleVkSuccess(p)}
              onError={handleVkError}
            />
          )}

          <YandexLoginButton disabled={busy} onError={handleVkError} />

          {!yandexId ? (
            <Typography variant="caption" color="text.secondary">
              Для входа через Яндекс задайте <code>VITE_YANDEX_CLIENT_ID</code>{' '}
              в <code>frontend/.env</code>.
            </Typography>
          ) : null}

          {!showPasswordAuth ? (
            <Button
              variant="text"
              disabled={busy}
              onClick={openPasswordAuth}
              sx={{ alignSelf: 'flex-start', mt: 1 }}
            >
              Войти по почте или телефону
            </Button>
          ) : null}

          <Collapse in={showPasswordAuth}>
            <Divider sx={{ my: 2 }} />
            <Typography variant="subtitle2" sx={{ mb: 2 }}>
              Почта / телефон и пароль
            </Typography>
            <PasswordAuthForm
              busy={busy}
              onBusyChange={setBusy}
              onLocalError={setLocalError}
            />
            <Button
              variant="text"
              size="small"
              disabled={busy}
              onClick={closePasswordAuth}
              sx={{ alignSelf: 'flex-start', mt: 1 }}
            >
              Скрыть
            </Button>
          </Collapse>
        </Stack>
      </Paper>
    </Box>
  )
}
