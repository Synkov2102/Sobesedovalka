import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  SandpackProvider,
  SandpackLayout,
  SandpackCodeEditor,
  SandpackPreview,
} from '@codesandbox/sandpack-react'
import type { CollabWelcomePayload, CollabPeerDTO } from '../collab/collab.types'
import { CollabSync } from './CollabSync'
import { PeerCaretsOverlay } from './PeerCaretsOverlay'
import { PlaygroundCollabBar } from './PlaygroundCollabBar'
import { PlaygroundFileExplorer } from './PlaygroundFileExplorer'
import './Playground.css'

/** App entry for the sandbox — \\${n} stays literal in the generated file. */
const STARTER_APP = `import "./styles.css";
import { useState } from "react";

export default function App() {
  const [n, setN] = useState(0);
  return (
    <main className="sandbox-main">
      <h1>React + Vite (TypeScript)</h1>
      <p>
        Create folders and <code>.tsx</code> files in the file explorer, then add an
        import at the top of this file and render your component below.
      </p>
      <button type="button" onClick={() => setN((c) => c + 1)}>
        Clicks: \${n}
      </button>
    </main>
  );
}
`

const STARTER_STYLES = `.sandbox-main {
  font-family: system-ui, sans-serif;
  max-width: 36rem;
  padding: 1rem;
  line-height: 1.5;
}

.sandbox-main h1 {
  font-size: 1.35rem;
  margin: 0 0 0.5rem;
}

.sandbox-main p {
  margin: 0 0 1rem;
  opacity: 0.9;
}

.sandbox-main code {
  font-size: 0.9em;
}

.sandbox-main button {
  padding: 0.4rem 0.75rem;
  border-radius: 6px;
  border: 1px solid #64748b;
  background: #0f172a;
  color: #f8fafc;
  cursor: pointer;
}

.sandbox-main button:hover {
  opacity: 0.92;
}
`


function useCollabRoom(): string {
  return useMemo(() => {
    const raw = new URLSearchParams(window.location.search).get('room')?.trim()
    const base = raw && raw.length > 0 ? raw : 'default'
    const safe = base.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64)
    return safe.length > 0 ? safe : 'default'
  }, [])
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

export function Playground() {
  const theme = useSystemTheme()
  const collabRoom = useCollabRoom()
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
      '/App.tsx': { code: STARTER_APP },
      '/styles.css': { code: STARTER_STYLES },
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
          <PlaygroundCollabBar
            room={collabRoom}
            collabPeers={collabPeers}
            collabCount={collabCount}
            myDisplayName={myDisplayName}
          />
          <CollabSync
            room={collabRoom}
            clientId={collabClientId}
            onRoster={onCollabRoster}
            onWelcome={onCollabWelcome}
          />
          <PeerCaretsOverlay selfId={collabClientId} peers={collabPeers} />
          <div className="playground__providerInner">
            <SandpackLayout className="playground__sandpack">
              <PlaygroundFileExplorer collabPeers={collabPeers} />
              <SandpackCodeEditor showTabs showLineNumbers closableTabs />
              <SandpackPreview showNavigator />
            </SandpackLayout>
          </div>
        </SandpackProvider>
      </div>
    </div>
  )
}
