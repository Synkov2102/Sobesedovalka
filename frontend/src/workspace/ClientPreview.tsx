import { useEffect, useMemo, useRef, useState } from 'react'
import { PreviewConsole, PreviewConsoleToggle } from './Console/PreviewConsole'
import { instrumentPreviewHtml } from './Console/previewConsoleBridge'
import { instrumentPreviewFormatterHtml } from './Formatter/previewFormatterBridge'
import { usePreviewFormatter } from './Formatter/usePreviewFormatter'
import { usePreviewConsole } from './Console/usePreviewConsole'
import { useThemeMode } from '../theme/ThemeModeProvider'
import { buildClientPreview } from './clientPreviewBuild'
import { injectPreviewHostTheme } from './injectPreviewHostTheme'
import { useWorkspace } from './WorkspaceContext'

type PreviewState =
  | { status: 'building'; html: string; error: string }
  | { status: 'ready'; html: string; error: string }
  | { status: 'error'; html: string; error: string }

function reloadPreviewIframe(iframe: HTMLIFrameElement | null): void {
  const win = iframe?.contentWindow
  if (!win) {
    return
  }
  try {
    win.location.reload()
  } catch {
    const html = iframe?.getAttribute('srcdoc')
    if (html != null) {
      iframe.srcdoc = html
    }
  }
}

/** Новый iframe: сброс React-состояния и sessionStorage; localStorage — только если не общий с хостом. */
function resetPreviewIframe(
  iframe: HTMLIFrameElement | null,
  remount: () => void,
): void {
  const win = iframe?.contentWindow
  if (win) {
    try {
      win.sessionStorage.clear()
      if (win.localStorage !== window.localStorage) {
        win.localStorage.clear()
      }
    } catch {
      // storage недоступен в sandbox без allow-same-origin
    }
  }
  remount()
}

export function ClientPreview() {
  const { mode } = useThemeMode()
  const { files } = useWorkspace()
  const previewIframeRef = useRef<HTMLIFrameElement>(null)
  const [resetGeneration, setResetGeneration] = useState(0)
  const {
    consoleEntries,
    isConsoleOpen,
    clearConsole,
    resetConsole,
    toggleConsole,
  } = usePreviewConsole(previewIframeRef)
  const [state, setState] = useState<PreviewState>({
    status: 'building',
    html: '',
    error: '',
  })

  usePreviewFormatter(previewIframeRef)

  const signature = useMemo(
    () =>
      Object.keys(files)
        .sort((a, b) => a.localeCompare(b))
        .map((path) => `${path}:${files[path].length}`)
        .join('|'),
    [files],
  )

  useEffect(() => {
    let cancelled = false
    const timer = window.setTimeout(() => {
      setState((prev) => ({ ...prev, status: 'building', error: '' }))
      resetConsole()
      void buildClientPreview(files).then((result) => {
        if (cancelled) {
          return
        }
        if (result.ok) {
          setState({ status: 'ready', html: result.html, error: '' })
        } else {
          setState((prev) => ({
            status: 'error',
            html: prev.html,
            error: result.error,
          }))
        }
      })
    }, 350)
    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [files, resetConsole, signature])

  const previewHtml = useMemo(() => {
    if (!state.html) {
      return ''
    }
    const built = instrumentPreviewFormatterHtml(
      instrumentPreviewHtml(state.html),
    )
    return injectPreviewHostTheme(built, mode)
  }, [state.html, mode])

  return (
    <div className="playground__previewPane">
      <div className="playground__previewHeader">
        <span>Превью</span>
        <div className="playground__previewHeaderActions">
          <span className="playground__previewStatus">
            {state.status === 'building'
              ? 'Сборка...'
              : state.status === 'error'
                ? 'Ошибка сборки'
                : 'Готово к работе'}
          </span>
          <PreviewConsoleToggle
            isOpen={isConsoleOpen}
            onToggle={toggleConsole}
          />
          <button
            type="button"
            className="playground__btn playground__btn--ghost playground__btn--compact"
            title="Перезагрузить превью (сохранить localStorage и sessionStorage)"
            aria-label="Перезагрузить превью"
            disabled={state.status === 'building' || !state.html}
            onClick={() => reloadPreviewIframe(previewIframeRef.current)}
          >
            ↻
          </button>
          <button
            type="button"
            className="playground__btn playground__btn--danger playground__btn--compact"
            title="Сбросить превью (очистить localStorage, sessionStorage и состояние React)"
            aria-label="Сбросить превью"
            disabled={state.status === 'building' || !state.html}
            onClick={() =>
              resetPreviewIframe(previewIframeRef.current, () =>
                setResetGeneration((n) => n + 1),
              )
            }
          >
            Сброс
          </button>
        </div>
      </div>
      {state.error ? (
        <pre className="playground__previewError">{state.error}</pre>
      ) : null}
      <iframe
        ref={previewIframeRef}
        key={`${resetGeneration}:${previewHtml}`}
        className="playground__previewIframe"
        title="Preview"
        sandbox="allow-scripts allow-modals allow-same-origin"
        srcDoc={previewHtml}
      />
      {isConsoleOpen ? (
        <PreviewConsole entries={consoleEntries} onClear={clearConsole} />
      ) : null}
    </div>
  )
}
