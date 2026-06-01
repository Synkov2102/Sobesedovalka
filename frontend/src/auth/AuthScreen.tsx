import { useCallback, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Collapse,
  Divider,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { useAuth } from './useAuth'
import { appShellPageSx, sectionSurfacePaddingSx } from '../theme/layout'
import { AppBrandWordmark } from '../components/AppBrandWordmark'
import { ThemeModeToggle } from '../components/ThemeModeToggle'
import { PasswordAuthForm } from './PasswordAuthForm'
import { useOAuthPublicConfig } from './useOAuthPublicConfig'
import { useYandexOAuthCallback } from './useYandexOAuthCallback'
import { VkOneTapLogin } from './VkOneTapLogin'
import { YandexLoginButton } from './YandexLoginButton'

type VkAuthPayload = {
  code: string
  device_id: string
  state: string
}

export function AuthScreen() {
  const { loginWithVk, authError, clearAuthError } = useAuth()
  const oauth = useOAuthPublicConfig()
  const [busy, setBusy] = useState(false)
  const [localError, setLocalError] = useState<string | null>(null)
  const [showPasswordAuth, setShowPasswordAuth] = useState(false)

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

  const handleOAuthError = useCallback((message: string) => {
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
        <Stack
          direction="row"
          sx={{ alignItems: 'center', justifyContent: 'space-between' }}
        >
          <AppBrandWordmark />
          <ThemeModeToggle />
        </Stack>
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
          {oauth.loading ? (
            <CircularProgress size={28} sx={{ alignSelf: 'flex-start' }} />
          ) : (
            <>
              {!oauth.vkAppId ? (
                <Alert severity="warning" sx={{ mb: 0 }}>
                  Не задан ID приложения VK (
                  <code>VK_CLIENT_ID</code> в <code>backend/.env</code> или на
                  бэкенде в Docker).
                </Alert>
              ) : (
                <VkOneTapLogin
                  appId={oauth.vkAppId}
                  redirectUri={oauth.vkRedirectUri}
                  onSuccess={(p) => void handleVkSuccess(p)}
                  onError={handleOAuthError}
                />
              )}

              {oauth.yandexClientId ? (
                <YandexLoginButton
                  clientId={oauth.yandexClientId}
                  redirectUri={oauth.yandexRedirectUri}
                  disabled={busy}
                  onError={handleOAuthError}
                />
              ) : null}
            </>
          )}

          {!showPasswordAuth ? (
            <Button
              variant="text"
              disabled={busy || oauth.loading}
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
