import { useEffect, useRef } from 'react'
import { useAuth } from './useAuth'
import {
  clearYandexOAuthPending,
  readYandexCallbackFromUrl,
  stripOAuthParamsFromUrl,
  takeYandexCodeVerifier,
  takeYandexOAuthState,
} from './yandexOAuth'

/** Завершает вход после редиректа с oauth.yandex.com. */
export function useYandexOAuthCallback(onError?: (message: string) => void): void {
  const { loginWithYandex } = useAuth()
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) {
      return
    }

    let callback: ReturnType<typeof readYandexCallbackFromUrl>
    try {
      callback = readYandexCallbackFromUrl()
    } catch (e) {
      startedRef.current = true
      clearYandexOAuthPending()
      stripOAuthParamsFromUrl()
      onError?.(e instanceof Error ? e.message : 'Ошибка входа через Яндекс')
      return
    }

    if (!callback) {
      return
    }

    const expectedState = takeYandexOAuthState()
    const codeVerifier = takeYandexCodeVerifier()
    clearYandexOAuthPending()
    stripOAuthParamsFromUrl()

    if (!expectedState || callback.state !== expectedState) {
      onError?.('Сессия Яндекс OAuth истекла — попробуйте снова')
      return
    }
    if (!codeVerifier) {
      onError?.('Сессия Яндекс OAuth истекла — попробуйте снова')
      return
    }

    startedRef.current = true
    void loginWithYandex({
      code: callback.code,
      codeVerifier,
      state: callback.state,
    })
  }, [loginWithYandex])
}
