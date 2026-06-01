import { Children, useRef, type CSSProperties, type ReactNode } from 'react'
import { useWorkspaceColumnWidths } from './useWorkspaceColumnWidths'
import { useWorkspaceStackedLayout } from './useWorkspaceStackedLayout'

type ResizableWorkspaceProps = {
  children: ReactNode
}

function ResizeHandle({
  label,
  orientation,
  onPointerDown,
}: {
  label: string
  orientation: 'vertical' | 'horizontal'
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void
}) {
  return (
    <div
      className={
        orientation === 'horizontal'
          ? 'playground__resizeHandle playground__resizeHandle--horizontal'
          : 'playground__resizeHandle'
      }
      role="separator"
      aria-orientation={orientation}
      aria-label={label}
      onPointerDown={onPointerDown}
    />
  )
}

export function ResizableWorkspace({ children }: ResizableWorkspaceProps) {
  const items = Children.toArray(children)
  if (items.length !== 3) {
    throw new Error('ResizableWorkspace expects exactly 3 children')
  }
  const [filesPane, editorPane, previewPane] = items
  const containerRef = useRef<HTMLDivElement>(null)
  const previewStacked = useWorkspaceStackedLayout()
  const { filesWidth, previewWidth, onResizeStart } =
    useWorkspaceColumnWidths(containerRef)

  return (
    <div
      ref={containerRef}
      className={
        previewStacked
          ? 'playground__workspace playground__workspace--resizable playground__workspace--stacked'
          : 'playground__workspace playground__workspace--resizable'
      }
      style={
        {
          '--ws-files': `${filesWidth}px`,
          '--ws-preview': `${previewWidth}px`,
        } as CSSProperties
      }
    >
      {filesPane}
      <ResizeHandle
        label="Ширина списка файлов"
        orientation="vertical"
        onPointerDown={(event) => onResizeStart('files', event)}
      />
      {editorPane}
      <ResizeHandle
        label={previewStacked ? 'Высота превью' : 'Ширина превью'}
        orientation={previewStacked ? 'horizontal' : 'vertical'}
        onPointerDown={(event) => onResizeStart('preview', event)}
      />
      {previewPane}
    </div>
  )
}
