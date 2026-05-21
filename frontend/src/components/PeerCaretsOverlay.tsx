import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import type { CollabPeerDTO } from '../collab/collab.types'
import { peerAccentRgbCss, peerAccentRgbaCss } from '../collab/peerColor'
import { normalizeSandpackFilePath } from '../collab/sandpackPaths'
import { getActiveMonacoEditor } from '../workspace/monacoPresence'
import { useWorkspace } from '../workspace/WorkspaceContext'

type PeerMark = {
  id: string
  name: string
  color: string
  colorRing: string
  caret: { left: number; top: number; height: number } | null
}

function marksKey(marks: PeerMark[]): string {
  return marks
    .map((m) =>
      [
        m.id,
        m.name,
        m.color,
        m.caret?.left.toFixed(1) ?? '',
        m.caret?.top.toFixed(1) ?? '',
        m.caret?.height.toFixed(1) ?? '',
      ].join(':'),
    )
    .join('|')
}

export function PeerCaretsOverlay({
  selfId,
  peers,
}: {
  selfId: string
  peers: CollabPeerDTO[]
}) {
  const workspace = useWorkspace()
  const [marks, setMarks] = useState<PeerMark[]>([])
  const keyRef = useRef('')

  useEffect(() => {
    let raf = 0
    const tick = () => {
      const editor = getActiveMonacoEditor()
      const active = normalizeSandpackFilePath(workspace.activeFile)
      const next: PeerMark[] = []
      if (editor && active) {
        for (const peer of peers) {
          if (
            peer.clientId === selfId ||
            normalizeSandpackFilePath(peer.activeFile) !== active
          ) {
            continue
          }
          const position = {
            lineNumber: peer.headLine ?? peer.line,
            column: peer.headCol ?? peer.col,
          }
          const coords = editor.getScrolledVisiblePosition(position)
          if (!coords) {
            continue
          }
          const container = editor.getDomNode()?.getBoundingClientRect()
          if (!container) {
            continue
          }
          next.push({
            id: peer.clientId,
            name: peer.displayName,
            color: peerAccentRgbCss(peer),
            colorRing: peerAccentRgbaCss(peer, 0.55),
            caret: {
              left: container.left + coords.left,
              top: container.top + coords.top,
              height: coords.height,
            },
          })
        }
      }
      const nextKey = marksKey(next)
      if (nextKey !== keyRef.current) {
        keyRef.current = nextKey
        setMarks(next)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [peers, selfId, workspace.activeFile])

  if (typeof document === 'undefined') {
    return null
  }

  return createPortal(
    <div className="peer-carets-root" aria-hidden>
      {marks.map((m) =>
        m.caret ? (
          <div key={m.id} className="peer-caret-wrap">
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
                boxShadow: `0 0 0 1px ${m.colorRing}`,
              }}
              title={m.name}
            />
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
              }}
            >
              {m.name}
            </div>
          </div>
        ) : null,
      )}
    </div>,
    document.body,
  )
}

