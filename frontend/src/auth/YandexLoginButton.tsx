import { Button } from '@mui/material'
import { startYandexLogin } from './yandexOAuth'

type Props = {
  clientId: string
  redirectUri: string
  disabled?: boolean
  onError: (message: string) => void
}

export function YandexLoginButton({
  clientId,
  redirectUri,
  disabled,
  onError,
}: Props) {
  return (
    <Button
      variant="outlined"
      color="inherit"
      disabled={disabled}
      onClick={() => {
        void startYandexLogin({ clientId, redirectUri }).catch((e: unknown) => {
          onError(
            e instanceof Error ? e.message : 'Не удалось открыть Яндекс OAuth',
          )
        })
      }}
      sx={{
        borderColor: 'divider',
        textTransform: 'none',
        fontWeight: 600,
      }}
    >
      Войти через Яндекс
    </Button>
  )
}
