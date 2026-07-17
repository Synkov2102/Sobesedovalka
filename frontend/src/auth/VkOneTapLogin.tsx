import { useEffect, useRef } from 'react'
import * as VKID from '@vkid/sdk'
import { codeChallengeFromVerifier } from './oauthPkce'
import { createVkPkce, peekVkCodeVerifier, storeVkCodeVerifier } from './vkPkce'

type VkAuthPayload = {
  code: string
  device_id: string
  state: string
}

type Props = {
  appId: number
  redirectUri: string
  onSuccess: (payload: VkAuthPayload) => void
  onError: (message: string) => void
}

export function VkOneTapLogin({
  appId,
  redirectUri,
  onSuccess,
  onError,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const onSuccessRef = useRef(onSuccess)
  const onErrorRef = useRef(onError)

  useEffect(() => {
    onSuccessRef.current = onSuccess
    onErrorRef.current = onError
  }, [onSuccess, onError])

  useEffect(() => {
    const container = containerRef.current
    if (!appId || !container) {
      return
    }

    let cancelled = false
    let oneTap: VKID.OneTap | null = null

    async function init() {
      const app = appId
      if (!app || !container) {
        return
      }
      try {
        let codeVerifier = peekVkCodeVerifier()
        let codeChallenge: string
        if (codeVerifier) {
          codeChallenge = await codeChallengeFromVerifier(codeVerifier)
        } else {
          const pair = await createVkPkce()
          codeVerifier = pair.codeVerifier
          codeChallenge = pair.codeChallenge
          storeVkCodeVerifier(codeVerifier)
        }

        VKID.Config.init({
          app,
          redirectUrl: redirectUri,
          responseMode: VKID.ConfigResponseMode.Callback,
          codeChallenge,
          scope: '',
        })

        if (cancelled) {
          return
        }

        oneTap = new VKID.OneTap()
        oneTap
          .render({ container: container as HTMLElement })
          .on(VKID.WidgetEvents.ERROR, (err: unknown) => {
            onErrorRef.current(
              err instanceof Error ? err.message : 'Ошибка виджета VK ID',
            )
          })
          .on(VKID.OneTapInternalEvents.LOGIN_SUCCESS, (payload: unknown) => {
            const p = payload as Partial<VkAuthPayload>
            if (
              typeof p.code !== 'string' ||
              typeof p.device_id !== 'string' ||
              typeof p.state !== 'string'
            ) {
              onErrorRef.current('Некорректный ответ VK ID')
              return
            }
            onSuccessRef.current({
              code: p.code,
              device_id: p.device_id,
              state: p.state,
            })
          })
      } catch (e) {
        if (!cancelled) {
          onErrorRef.current(
            e instanceof Error
              ? e.message
              : 'Не удалось инициализировать VK ID',
          )
        }
      }
    }

    void init()

    return () => {
      cancelled = true
      container.replaceChildren()
      oneTap = null
    }
  }, [appId, redirectUri])

  return <div ref={containerRef} aria-label="Вход через VK ID" />
}
