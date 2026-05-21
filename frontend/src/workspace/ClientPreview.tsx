import { useEffect, useMemo, useState } from 'react'
import { buildClientPreview } from './clientPreviewBuild'
import { useWorkspace } from './WorkspaceContext'

type PreviewState =
  | { status: 'building'; html: string; error: string }
  | { status: 'ready'; html: string; error: string }
  | { status: 'error'; html: string; error: string }

export function ClientPreview() {
  const { files } = useWorkspace()
  const [state, setState] = useState<PreviewState>({
    status: 'building',
    html: '',
    error: '',
  })
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
  }, [files, signature])

  return (
    <div className="playground__previewPane">
      <div className="playground__previewHeader">
        <span>Preview</span>
        <span className="playground__previewStatus">
          {state.status === 'building'
            ? 'Сборка...'
            : state.status === 'error'
              ? 'Ошибка'
              : 'Готово'}
        </span>
      </div>
      {state.error ? (
        <pre className="playground__previewError">{state.error}</pre>
      ) : null}
      <iframe
        key={state.html}
        className="playground__previewIframe"
        title="Preview"
        sandbox="allow-scripts allow-modals"
        srcDoc={state.html}
      />
    </div>
  )
}

