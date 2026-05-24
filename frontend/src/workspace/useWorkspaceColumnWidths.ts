import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from 'react'
import {
  loadWorkspaceColumnLayout,
  saveWorkspaceColumnLayout,
  WORKSPACE_COLUMN_LIMITS,
  type WorkspaceColumnLayout,
} from './workspaceLayoutStorage'

export type WorkspaceResizeTarget = 'files' | 'preview'

type DragState = {
  target: WorkspaceResizeTarget
  startX: number
  start: WorkspaceColumnLayout
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function layoutWithinContainer(
  layout: WorkspaceColumnLayout,
  containerWidth: number,
): WorkspaceColumnLayout {
  const { handle, editor, files, preview } = WORKSPACE_COLUMN_LIMITS
  const available = Math.max(0, containerWidth - handle * 2)
  let nextFiles = clamp(
    layout.files,
    files.min,
    Math.min(files.max, available - editor.min - preview.min),
  )
  let nextPreview = clamp(
    layout.preview,
    preview.min,
    Math.min(preview.max, available - editor.min - nextFiles),
  )
  if (nextFiles + nextPreview + editor.min > available) {
    const overflow = nextFiles + nextPreview + editor.min - available
    nextPreview = Math.max(preview.min, nextPreview - overflow)
  }
  if (nextFiles + nextPreview + editor.min > available) {
    nextFiles = Math.max(files.min, available - editor.min - nextPreview)
  }
  return { files: nextFiles, preview: nextPreview }
}

export function useWorkspaceColumnWidths(
  containerRef: RefObject<HTMLElement | null>,
) {
  const [layout, setLayout] = useState(loadWorkspaceColumnLayout)
  const dragRef = useRef<DragState | null>(null)
  const layoutRef = useRef(layout)
  layoutRef.current = layout

  const applyLayout = useCallback(
    (next: WorkspaceColumnLayout) => {
      const el = containerRef.current
      const fitted = el
        ? layoutWithinContainer(next, el.getBoundingClientRect().width)
        : next
      setLayout(fitted)
      saveWorkspaceColumnLayout(fitted)
    },
    [containerRef],
  )

  useEffect(() => {
    const el = containerRef.current
    if (!el || typeof ResizeObserver === 'undefined') {
      return
    }
    const observer = new ResizeObserver(() => {
      setLayout((current) => {
        const fitted = layoutWithinContainer(
          current,
          el.getBoundingClientRect().width,
        )
        if (
          fitted.files === current.files &&
          fitted.preview === current.preview
        ) {
          return current
        }
        saveWorkspaceColumnLayout(fitted)
        return fitted
      })
    })
    observer.observe(el)
    return () => observer.disconnect()
  }, [containerRef])

  const endDrag = useCallback(() => {
    dragRef.current = null
    document.body.classList.remove('playground--columnResize')
  }, [])

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current
      const el = containerRef.current
      if (!drag || !el) {
        return
      }
      const dx = event.clientX - drag.startX
      const { files, preview, editor, handle } = WORKSPACE_COLUMN_LIMITS
      const available = Math.max(
        0,
        el.getBoundingClientRect().width - handle * 2,
      )

      if (drag.target === 'files') {
        const maxFiles = Math.min(
          files.max,
          available - editor.min - drag.start.preview,
        )
        applyLayout({
          files: clamp(drag.start.files + dx, files.min, maxFiles),
          preview: drag.start.preview,
        })
        return
      }

      const maxPreview = Math.min(
        preview.max,
        available - editor.min - drag.start.files,
      )
      applyLayout({
        files: drag.start.files,
        preview: clamp(drag.start.preview - dx, preview.min, maxPreview),
      })
    }

    const onPointerUp = () => endDrag()

    document.addEventListener('pointermove', onPointerMove)
    document.addEventListener('pointerup', onPointerUp)
    document.addEventListener('pointercancel', onPointerUp)
    return () => {
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerup', onPointerUp)
      document.removeEventListener('pointercancel', onPointerUp)
    }
  }, [applyLayout, containerRef, endDrag])

  const onResizeStart = useCallback(
    (target: WorkspaceResizeTarget, event: React.PointerEvent) => {
      event.preventDefault()
      event.currentTarget.setPointerCapture(event.pointerId)
      dragRef.current = {
        target,
        startX: event.clientX,
        start: layoutRef.current,
      }
      document.body.classList.add('playground--columnResize')
    },
    [],
  )

  return {
    filesWidth: layout.files,
    previewWidth: layout.preview,
    onResizeStart,
  }
}
