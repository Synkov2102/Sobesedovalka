import type { CSSProperties } from 'react'
import { useSandpack } from '@codesandbox/sandpack-react'
import type { CollabPeerDTO } from '../collab/collab.types'
import { peerRgbSpace } from '../collab/peerColor'
import { normalizeSandpackFilePath } from '../collab/sandpackPaths'

export function PlaygroundCollabBar({
  room,
  collabPeers,
  collabCount,
  myDisplayName,
}: {
  room: string
  collabPeers: CollabPeerDTO[]
  collabCount: number
  myDisplayName: string | null
}) {
  const { sandpack } = useSandpack()

  return (
    <div className="playground__collabBar" role="status">
      <div className="playground__collabHead">
        <strong>Онлайн: {collabCount}</strong>
        <span className="playground__collabSep">·</span>
        комната <code>{room}</code>
        {myDisplayName ? (
          <>
            <span className="playground__collabSep">·</span>
            вы: <strong>{myDisplayName}</strong>
          </>
        ) : null}
      </div>
      <p className="playground__collabHint">
        Одинаковый <code>?room=…</code> и доступ к API <code>:3000</code>.
        Имена выдаёт сервер (прилагательное + животное).
      </p>
      <ul className="playground__roster">
        {collabPeers.map((p) => {
          const path = normalizeSandpackFilePath(p.activeFile)
          const canOpen = Boolean(path && sandpack.files[path])
          const rosterStyle = {
            '--peer-rgb': peerRgbSpace(p),
          } as CSSProperties
          const summary = `${p.displayName} · ${path || '—'} · ${p.line}:${p.col}`
          return (
            <li
              key={p.clientId}
              className="playground__rosterItem"
              style={rosterStyle}
              title={summary}
            >
              <span className="playground__rosterName">{p.displayName}</span>
              <span className="playground__rosterMeta">
                {path || '—'} · {p.line}:{p.col}
              </span>
              <button
                type="button"
                className="playground__rosterJump"
                disabled={!canOpen}
                title={
                  canOpen
                    ? `Открыть ${path}`
                    : path
                      ? 'Файла нет в проекте'
                      : 'Файл ещё не выбран'
                }
                aria-label={
                  canOpen
                    ? `Перейти к файлу пользователя ${p.displayName}: ${path}`
                    : undefined
                }
                onClick={() => {
                  if (canOpen && path) {
                    sandpack.openFile(path)
                  }
                }}
              >
                К файлу
              </button>
            </li>
          )
        })}
      </ul>
    </div>
  )
}
