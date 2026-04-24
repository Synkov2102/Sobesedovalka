import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  SandpackProvider,
  SandpackLayout,
  SandpackCodeEditor,
  SandpackPreview,
} from '@codesandbox/sandpack-react'
import { fetchCollabRoomReady } from '../api/taskPresets'
import type { CollabWelcomePayload, CollabPeerDTO } from '../collab/collab.types'
import { CollabSync } from './CollabSync'
import { PeerCaretsOverlay } from './PeerCaretsOverlay'
import { PlaygroundCollabBar } from './PlaygroundCollabBar'
import { PlaygroundFileExplorer } from './PlaygroundFileExplorer'
import {
  DEFAULT_SANDBOX_APP,
  DEFAULT_SANDBOX_STYLES,
} from '../sandbox/defaultFiles'
import './Playground.css'

type PlaygroundProps = {
  onInvalidExplicitRoom?: () => void
}

type ParsedCollabRoom =
  | { kind: 'implicit'; roomId: string }
  | { kind: 'explicit'; roomId: string }
  | { kind: 'explicit_invalid' }

function parseCollabRoomFromLocation(): ParsedCollabRoom {
  const raw = new URLSearchParams(window.location.search).get('room')?.trim()
  if (!raw) {
    return { kind: 'implicit', roomId: 'default' }
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
        id = crypto.randomUUID()
        sessionStorage.setItem(k, id)
      }
      return id
    } catch {
      return crypto.randomUUID()
    }
  }, [])
}

function useSystemTheme(): 'light' | 'dark' {
  const [mode, setMode] = useState<'light' | 'dark'>(() =>
    typeof window !== 'undefined' &&
    window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light',
  )
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const go = () => setMode(mq.matches ? 'dark' : 'light')
    mq.addEventListener('change', go)
    return () => mq.removeEventListener('change', go)
  }, [])
  return mode
}

export function Playground({ onInvalidExplicitRoom }: PlaygroundProps) {
  const theme = useSystemTheme()
  const parsedRoom = useMemo(() => parseCollabRoomFromLocation(), [])
  const [roomAccess, setRoomAccess] = useState<'ready' | 'checking' | 'blocked'>(() => {
    if (parsedRoom.kind === 'implicit') {
      return 'ready'
    }
    if (parsedRoom.kind === 'explicit_invalid') {
      return 'blocked'
    }
    return 'checking'
  })

  useEffect(() => {
    if (parsedRoom.kind === 'implicit') {
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

  const collabRoom =
    parsedRoom.kind === 'implicit'
      ? parsedRoom.roomId
      : parsedRoom.kind === 'explicit' && roomAccess === 'ready'
        ? parsedRoom.roomId
        : 'default'

  const collabClientId = useStableCollabClientId()
  const [collabPeers, setCollabPeers] = useState<CollabPeerDTO[]>([])
  const [collabCount, setCollabCount] = useState(0)
  const [myDisplayName, setMyDisplayName] = useState<string | null>(null)

  const onCollabRoster = useCallback(
    (peers: CollabPeerDTO[], count: number) => {
      setCollabPeers(peers)
      setCollabCount(count)
    },
    [],
  )

  const onCollabWelcome = useCallback((welcome: CollabWelcomePayload) => {
    setMyDisplayName(welcome.displayName)
  }, [])

  /** Stable refs — Sandpack resets all file state whenever `files` identity changes. */
  const sandpackFiles = useMemo(
    () => ({
      '/App.tsx': { code: DEFAULT_SANDBOX_APP },
      '/styles.css': { code: DEFAULT_SANDBOX_STYLES },
    }),
    [],
  )
  const sandpackOptions = useMemo(
    () => ({
      autorun: true,
      autoReload: true,
      recompileMode: 'immediate' as const,
    }),
    [],
  )

  if (parsedRoom.kind !== 'implicit' && roomAccess === 'checking') {
    return (
      <div className="playground playground--fill">
        <p className="panel__muted">Проверка ссылки комнаты…</p>
      </div>
    )
  }

  if (roomAccess === 'blocked') {
    return (
      <div className="playground playground--fill">
        <p className="panel__muted">Комната не найдена. Открываем пресеты…</p>
      </div>
    )
  }

  return (
    <div className="playground playground--fill">
      <p className="playground__intro">
        Multi-file <strong>React + TypeScript</strong> sandbox (Vite template).
        File explorer + tabs; preview is a real Vite build in an iframe. Create
        folders or add <code>.tsx</code> modules and import them from{' '}
        <code>App.tsx</code>.
      </p>

      <div className="playground__spWrap">
        <SandpackProvider
          template="vite-react-ts"
          theme={theme}
          files={sandpackFiles}
          options={sandpackOptions}
        >
          <CollabSync
            room={collabRoom}
            clientId={collabClientId}
            onRoster={onCollabRoster}
            onWelcome={onCollabWelcome}
          >
            <PlaygroundCollabBar
              room={collabRoom}
              collabPeers={collabPeers}
              collabCount={collabCount}
              myDisplayName={myDisplayName}
            />
            <PeerCaretsOverlay selfId={collabClientId} peers={collabPeers} />
            <div className="playground__providerInner">
              <SandpackLayout className="playground__sandpack">
                <PlaygroundFileExplorer collabPeers={collabPeers} />
                <SandpackCodeEditor showTabs showLineNumbers closableTabs />
                <SandpackPreview showNavigator />
              </SandpackLayout>
            </div>
          </CollabSync>
        </SandpackProvider>
      </div>
    </div>
  )
}
