import { Children, useRef, type CSSProperties, type ReactNode } from 'react'
import { useWorkspaceColumnWidths } from './useWorkspaceColumnWidths'

type ResizableWorkspaceProps = {
  children: ReactNode
}

function ResizeHandle({
  label,
  onPointerDown,
}: {
  label: string
  onPointerDown: (event: React.PointerEvent<HTMLDivElement>) => void
}) {
  return (
    <div
      className="playground__resizeHandle"
      role="separator"
      aria-orientation="vertical"
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
  const { filesWidth, previewWidth, onResizeStart } =
    useWorkspaceColumnWidths(containerRef)

  return (
    <div
      ref={containerRef}
      className="playground__workspace playground__workspace--resizable"
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
        onPointerDown={(event) => onResizeStart('files', event)}
      />
      {editorPane}
      <ResizeHandle
        label="Ширина превью"
        onPointerDown={(event) => onResizeStart('preview', event)}
      />
      {previewPane}
    </div>
  )
}
