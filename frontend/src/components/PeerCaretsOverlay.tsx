import type { Text } from '@codemirror/state'
import { EditorView } from '@codemirror/view'
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useSandpack } from '@codesandbox/sandpack-react'
import type { CollabPeerDTO } from '../collab/collab.types'

function lineColToPos(doc: Text, line: number, col: number): number {
  const ln = Math.min(Math.max(1, line), doc.lines)
  const lineObj = doc.line(ln)
  const c = Math.max(1, col)
  return Math.min(lineObj.from + c - 1, lineObj.to)
}

function peerAnchorHead(p: CollabPeerDTO): {
  anchorLine: number
  anchorCol: number
  headLine: number
  headCol: number
} {
  const headLine = p.headLine ?? p.line
  const headCol = p.headCol ?? p.col
  const anchorLine = p.anchorLine ?? p.line
  const anchorCol = p.anchorCol ?? p.col
  return { anchorLine, anchorCol, headLine, headCol }
}

/** Screen-space rectangles for [from, to) in document positions. */
function selectionScreenRects(
  view: EditorView,
  doc: Text,
  from: number,
  to: number,
): Array<{ left: number; top: number; width: number; height: number }> {
  const rects: Array<{
    left: number
    top: number
    width: number
    height: number
  }> = []
  if (from === to) {
    return rects
  }
  let pos = Math.min(from, to)
  const end = Math.max(from, to)
  while (pos < end) {
    const line = doc.lineAt(pos)
    const segStart = Math.max(pos, line.from)
    const segEnd = Math.min(end, line.to)
    if (segStart < segEnd) {
      const c0 = view.coordsAtPos(segStart, 1)
      const lastChar = Math.max(segStart, segEnd - 1)
      const c1 = view.coordsAtPos(lastChar, 1)
      if (c0 && c1) {
        const left = Math.min(c0.left, c1.left, c0.right, c1.right)
        const right = Math.max(c0.left, c1.left, c0.right, c1.right)
        const top = Math.min(c0.top, c1.top)
        const bottom = Math.max(c0.bottom, c1.bottom)
        const h = Math.max(bottom - top, 12)
        rects.push({
          left,
          top,
          width: Math.max(right - left, 3),
          height: h,
        })
      }
    }
    const next = line.to + 1
    if (next <= pos) {
      break
    }
    pos = next
  }
  return rects
}

function hueFromId(id: string): number {
  let h = 0
  for (let i = 0; i < id.length; i++) {
    h = (h * 31 + id.charCodeAt(i)) % 360
  }
  return h
}

type PeerMark = {
  id: string
  name: string
  color: string
  caret: { left: number; top: number; height: number } | null
  selection: Array<{ left: number; top: number; width: number; height: number }>
}

export function PeerCaretsOverlay({
  selfId,
  peers,
}: {
  selfId: string
  peers: CollabPeerDTO[]
}) {
  const { sandpack } = useSandpack()
  const [marks, setMarks] = useState<PeerMark[]>([])

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const cm = document.querySelector(
        '.playground__sandpack .sp-editor .cm-content',
      )
      if (!cm || !(cm instanceof HTMLElement)) {
        setMarks([])
        raf = requestAnimationFrame(tick)
        return
      }
      const view = EditorView.findFromDOM(cm)
      const active = sandpack.activeFile
      const next: PeerMark[] = []
      if (view && active) {
        const doc = view.state.doc
        for (const p of peers) {
          if (p.clientId === selfId || p.activeFile !== active) {
            continue
          }
          const { anchorLine, anchorCol, headLine, headCol } = peerAnchorHead(p)
          const a = lineColToPos(doc, anchorLine, anchorCol)
          const h = lineColToPos(doc, headLine, headCol)
          const from = Math.min(a, h)
          const to = Math.max(a, h)
          const hue = hueFromId(p.clientId)
          const color = `hsl(${hue} 72% 40%)`
          const selection =
            from < to ? selectionScreenRects(view, doc, from, to) : []
          const headPos = h
          const c = view.coordsAtPos(headPos)
          const caret =
            c != null
              ? {
                  left: c.left,
                  top: c.top,
                  height: Math.max(14, c.bottom - c.top),
                }
              : null
          if (caret != null || selection.length > 0) {
            next.push({
              id: p.clientId,
              name: p.displayName,
              color,
              caret,
              selection,
            })
          }
        }
      }
      setMarks(next)
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [peers, sandpack.activeFile, selfId])

  if (typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div className="peer-carets-root" aria-hidden>
      {marks.map((m) => (
        <div key={m.id} className="peer-caret-wrap">
          {m.selection.map((r, i) => (
            <div
              key={`s-${i}`}
              className="peer-selection"
              style={{
                position: 'fixed',
                left: r.left,
                top: r.top,
                width: r.width,
                height: r.height,
                background: `color-mix(in srgb, ${m.color} 22%, transparent)`,
                borderRadius: 2,
                pointerEvents: 'none',
                zIndex: 9998,
                boxSizing: 'border-box',
                border: `1px solid color-mix(in srgb, ${m.color} 45%, transparent)`,
              }}
            />
          ))}
          {m.caret ? (
            <div
              className="peer-caret"
              style={{
                position: 'fixed',
                left: m.caret.left,
                top: m.caret.top,
                height: m.caret.height,
                width: 2,
                background: m.color,
                pointerEvents: 'none',
                zIndex: 9999,
                boxShadow: `0 0 0 1px color-mix(in srgb, ${m.color} 35%, white)`,
              }}
              title={m.name}
            />
          ) : null}
          {m.caret ? (
            <div
              className="peer-caret-tag"
              style={{
                position: 'fixed',
                left: m.caret.left + 4,
                top: m.caret.top - 18,
                fontSize: 10,
                lineHeight: 1.2,
                padding: '2px 6px',
                borderRadius: 4,
                background: m.color,
                color: '#fff',
                pointerEvents: 'none',
                zIndex: 10000,
                whiteSpace: 'nowrap',
                maxWidth: '14rem',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {m.name}
            </div>
          ) : null}
        </div>
      ))}
    </div>,
    document.body,
  )
}
