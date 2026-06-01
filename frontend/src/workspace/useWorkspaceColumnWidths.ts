import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { isWorkspaceStackedLayout } from './useWorkspaceStackedLayout'
import {
  loadWorkspaceColumnLayout,
  saveWorkspaceColumnLayout,
  WORKSPACE_COLUMN_LIMITS,
  WORKSPACE_STACKED_MAX_WIDTH_PX,
  type WorkspaceColumnLayout,
} from './workspaceLayoutStorage'

export type WorkspaceResizeTarget = 'files' | 'preview'

type DragState = {
  target: WorkspaceResizeTarget
  startX: number
  startY: number
  start: WorkspaceColumnLayout
  previewAxis: 'width' | 'height'
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function layoutWithinContainerWidth(
  layout: WorkspaceColumnLayout,
  containerWidth: number,
  fitPreviewWidth: boolean,
): WorkspaceColumnLayout {
  const { handle, editor, files, preview } = WORKSPACE_COLUMN_LIMITS
  const available = Math.max(0, containerWidth - handle * 2)
  let nextFiles = clamp(
    layout.files,
    files.min,
    Math.min(
      files.max,
      fitPreviewWidth
        ? available - editor.min - preview.min
        : available - editor.min,
    ),
  )

  if (!fitPreviewWidth) {
    return { files: nextFiles, preview: layout.preview }
  }

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

function layoutWithinContainerHeight(
  layout: WorkspaceColumnLayout,
  containerHeight: number,
): WorkspaceColumnLayout {
  const { handle, previewHeight, editorHeightMin } = WORKSPACE_COLUMN_LIMITS
  const available = Math.max(0, containerHeight - handle)
  const nextPreview = clamp(
    layout.preview,
    previewHeight.min,
    Math.max(previewHeight.min, available - editorHeightMin),
  )
  return { ...layout, preview: nextPreview }
}

function layoutWithinContainer(
  layout: WorkspaceColumnLayout,
  width: number,
  height: number,
): WorkspaceColumnLayout {
  const stacked = isWorkspaceStackedLayout()
  let next = layoutWithinContainerWidth(layout, width, !stacked)
  if (stacked) {
    next = layoutWithinContainerHeight(next, height)
  }
  return next
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
        ? layoutWithinContainer(
            next,
            el.getBoundingClientRect().width,
            el.getBoundingClientRect().height,
          )
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
        const rect = el.getBoundingClientRect()
        const fitted = layoutWithinContainer(current, rect.width, rect.height)
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

  useEffect(() => {
    const mq = window.matchMedia(
      `(max-width: ${WORKSPACE_STACKED_MAX_WIDTH_PX}px)`,
    )
    const onLayoutModeChange = () => {
      const el = containerRef.current
      if (!el) {
        return
      }
      setLayout((current) => {
        const rect = el.getBoundingClientRect()
        const fitted = layoutWithinContainer(current, rect.width, rect.height)
        if (
          fitted.files === current.files &&
          fitted.preview === current.preview
        ) {
          return current
        }
        saveWorkspaceColumnLayout(fitted)
        return fitted
      })
    }
    mq.addEventListener('change', onLayoutModeChange)
    return () => mq.removeEventListener('change', onLayoutModeChange)
  }, [containerRef])

  const endDrag = useCallback(() => {
    dragRef.current = null
    document.body.classList.remove(
      'playground--columnResize',
      'playground--rowResize',
    )
  }, [])

  useEffect(() => {
    const onPointerMove = (event: PointerEvent) => {
      const drag = dragRef.current
      const el = containerRef.current
      if (!drag || !el) {
        return
      }
      const { files, preview, editor, handle } = WORKSPACE_COLUMN_LIMITS

      if (drag.target === 'files') {
        const dx = event.clientX - drag.startX
        const available = Math.max(
          0,
          el.getBoundingClientRect().width - handle * 2,
        )
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

      if (drag.previewAxis === 'height') {
        const dy = event.clientY - drag.startY
        const { previewHeight, editorHeightMin } = WORKSPACE_COLUMN_LIMITS
        const available = Math.max(
          0,
          el.getBoundingClientRect().height - handle,
        )
        const maxPreview = Math.max(
          previewHeight.min,
          available - editorHeightMin,
        )
        applyLayout({
          files: drag.start.files,
          preview: clamp(
            drag.start.preview - dy,
            previewHeight.min,
            maxPreview,
          ),
        })
        return
      }

      const dx = event.clientX - drag.startX
      const available = Math.max(
        0,
        el.getBoundingClientRect().width - handle * 2,
      )
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
      const previewAxis =
        target === 'preview' && isWorkspaceStackedLayout() ? 'height' : 'width'
      dragRef.current = {
        target,
        startX: event.clientX,
        startY: event.clientY,
        start: layoutRef.current,
        previewAxis,
      }
      document.body.classList.add(
        previewAxis === 'height'
          ? 'playground--rowResize'
          : 'playground--columnResize',
      )
    },
    [],
  )

  return {
    filesWidth: layout.files,
    previewWidth: layout.preview,
    onResizeStart,
  }
}
