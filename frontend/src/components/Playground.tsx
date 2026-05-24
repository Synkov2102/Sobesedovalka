import { useCallback, useEffect, useMemo, useState } from 'react'
import { fetchCollabRoomReady } from '../api/taskPresets'
import type { CollabPeerDTO } from '../collab/collab.types'
import { CollabSync } from './CollabSync'
import { PeerCaretsOverlay } from './PeerCaretsOverlay'
import { PlaygroundCollabBar } from './PlaygroundCollabBar'
import { PlaygroundFileExplorer } from './PlaygroundFileExplorer'
import { v4 as uuidv4 } from 'uuid'
import { WorkspaceProvider } from '../workspace/WorkspaceContext'
import { mergeWorkspaceFiles } from '../workspace/workspaceDefaults'
import { MonacoCodeEditor } from '../workspace/MonacoCodeEditor'
import { ClientPreview } from '../workspace/ClientPreview'
import { ResizableWorkspace } from '../workspace/ResizableWorkspace'
import './Playground.css'

type PlaygroundProps = {
  onInvalidExplicitRoom?: () => void
}

type ParsedCollabRoom =
  | { kind: 'missing' }
  | { kind: 'explicit'; roomId: string }
  | { kind: 'explicit_invalid' }

function parseCollabRoomFromLocation(): ParsedCollabRoom {
  const raw = new URLSearchParams(window.location.search).get('room')?.trim()
  if (!raw) {
    return { kind: 'missing' }
  }
  const safe = raw.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64)
  if (!safe) {
    return { kind: 'explicit_invalid' }
  }
  return { kind: 'explicit', roomId: safe }
}

function useStableCollabClientId(): string {
  return useMemo(() => {
    const k = 'live-coding-collab-client-id'
    try {
      let id = sessionStorage.getItem(k)
      if (!id) {
        id = uuidv4()
        sessionStorage.setItem(k, id)
      }
      return id
    } catch {
      return uuidv4()
    }
  }, [])
}

export function Playground({ onInvalidExplicitRoom }: PlaygroundProps) {
  const parsedRoom = useMemo(() => parseCollabRoomFromLocation(), [])
  const [roomAccess, setRoomAccess] = useState<
    'ready' | 'checking' | 'blocked'
  >(() => {
    if (parsedRoom.kind === 'explicit_invalid') {
      return 'blocked'
    }
    return 'checking'
  })

  useEffect(() => {
    if (parsedRoom.kind === 'missing') {
      return
    }
    if (parsedRoom.kind === 'explicit_invalid') {
      onInvalidExplicitRoom?.()
      return
    }
    let alive = true
    void (async () => {
      try {
        const ok = await fetchCollabRoomReady(parsedRoom.roomId)
        if (!alive) {
          return
        }
        if (!ok) {
          onInvalidExplicitRoom?.()
          setRoomAccess('blocked')
          return
        }
        setRoomAccess('ready')
      } catch {
        if (!alive) {
          return
        }
        setRoomAccess('ready')
      }
    })()
    return () => {
      alive = false
    }
  }, [parsedRoom, onInvalidExplicitRoom])

  const collabClientId = useStableCollabClientId()
  const [collabPeers, setCollabPeers] = useState<CollabPeerDTO[]>([])
  const onCollabRoster = useCallback((peers: CollabPeerDTO[]) => {
    setCollabPeers(peers)
  }, [])

  if (parsedRoom.kind === 'missing') {
    return (
      <div className="playground playground--fill">
        <p className="panel__muted">
          Откройте комнату из списка «Комнаты» или по прямой ссылке с параметром{' '}
          <code>?room=…</code>. Редактор без id комнаты не запускается.
        </p>
      </div>
    )
  }

  if (parsedRoom.kind === 'explicit_invalid') {
    return (
      <div className="playground playground--fill">
        <p className="panel__muted">Некорректный id комнаты.</p>
      </div>
    )
  }

  if (parsedRoom.kind === 'explicit' && roomAccess === 'checking') {
    return (
      <div className="playground playground--fill">
        <p className="panel__muted">Проверка ссылки комнаты…</p>
      </div>
    )
  }

  if (parsedRoom.kind === 'explicit' && roomAccess === 'blocked') {
    return (
      <div className="playground playground--fill">
        <p className="panel__muted">
          Комната не найдена или недоступна. Возврат к списку комнат…
        </p>
      </div>
    )
  }

  if (parsedRoom.kind !== 'explicit' || roomAccess !== 'ready') {
    return null
  }

  const roomId = parsedRoom.roomId

  return (
    <WorkspaceProvider initialFiles={mergeWorkspaceFiles()}>
      <CollabSync room={roomId} clientId={collabClientId} onRoster={onCollabRoster}>
        <div className="playground playground--fill">
          <PlaygroundCollabBar
            collabPeers={collabPeers}
            selfClientId={collabClientId}
          />
          <PeerCaretsOverlay selfId={collabClientId} peers={collabPeers} />
          <div className="playground__providerInner">
            <ResizableWorkspace>
              <PlaygroundFileExplorer collabPeers={collabPeers} />
              <MonacoCodeEditor />
              <ClientPreview />
            </ResizableWorkspace>
          </div>
        </div>
      </CollabSync>
    </WorkspaceProvider>
  )
}

