import { useCallback, useEffect, useState } from 'react'
import type { RefObject } from 'react'
import { PREVIEW_CONSOLE_MESSAGE } from './previewConsoleBridge'

export type PreviewConsoleLevel = 'log' | 'info' | 'warn' | 'error' | 'debug'

export type PreviewConsoleEntry = {
  id: number
  level: PreviewConsoleLevel
  args: string[]
}

const MAX_CONSOLE_ENTRIES = 200

function isPreviewConsoleLevel(value: unknown): value is PreviewConsoleLevel {
  return (
    value === 'log' ||
    value === 'info' ||
    value === 'warn' ||
    value === 'error' ||
    value === 'debug'
  )
}

export function usePreviewConsole(
  previewIframeRef: RefObject<HTMLIFrameElement | null>,
) {
  const [isConsoleOpen, setIsConsoleOpen] = useState(false)
  const [consoleEntries, setConsoleEntries] = useState<PreviewConsoleEntry[]>([])
  const clearConsole = useCallback(() => setConsoleEntries([]), [])
  const resetConsole = useCallback(() => setConsoleEntries([]), [])
  const toggleConsole = useCallback(
    () => setIsConsoleOpen((open) => !open),
    [],
  )

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (event.source !== previewIframeRef.current?.contentWindow) {
        return
      }
      const data = event.data as {
        type?: unknown
        level?: unknown
        args?: unknown
      }
      if (data.type !== PREVIEW_CONSOLE_MESSAGE) {
        return
      }
      const level = isPreviewConsoleLevel(data.level) ? data.level : 'log'
      const args = Array.isArray(data.args) ? data.args.map(String) : []
      setConsoleEntries((prev) =>
        [
          ...prev,
          {
            id: Date.now() + Math.random(),
            level,
            args,
          },
        ].slice(-MAX_CONSOLE_ENTRIES),
      )
    }

    window.addEventListener('message', handleMessage)
    return () => window.removeEventListener('message', handleMessage)
  }, [previewIframeRef])

  return {
    consoleEntries,
    isConsoleOpen,
    clearConsole,
    resetConsole,
    toggleConsole,
  }
}
