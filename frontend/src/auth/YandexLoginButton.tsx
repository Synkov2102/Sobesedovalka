import { Button } from '@mui/material'
import { startYandexLogin, yandexClientId } from './yandexOAuth'

type Props = {
  disabled?: boolean
  onError: (message: string) => void
}

export function YandexLoginButton({ disabled, onError }: Props) {
  const clientId = yandexClientId()

  if (!clientId) {
    return null
  }

  return (
    <Button
      variant="outlined"
      color="inherit"
      disabled={disabled}
      onClick={() => {
        void startYandexLogin().catch((e: unknown) => {
          onError(e instanceof Error ? e.message : 'Не удалось открыть Яндекс OAuth')
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
