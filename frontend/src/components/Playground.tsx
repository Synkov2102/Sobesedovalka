import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  SandpackProvider,
  SandpackLayout,
  SandpackCodeEditor,
  SandpackPreview,
  SandpackFileExplorer,
  useSandpack,
} from '@codesandbox/sandpack-react'
import type { CollabPeerDTO } from '../collab/collab.types'
import { CollabSync } from './CollabSync'
import { PeerCaretsOverlay } from './PeerCaretsOverlay'
import './Playground.css'

const VITE_REACT_TS_PROTECTED = new Set([
  '/App.tsx',
  '/index.tsx',
  '/index.html',
  '/package.json',
  '/tsconfig.json',
  '/tsconfig.node.json',
  '/vite-env.d.ts',
  '/vite.config.ts',
  '/styles.css',
])

/** App entry for the sandbox — \\${n} stays literal in the generated file. */
const STARTER_APP = `import "./styles.css";
import { useState } from "react";

export default function App() {
  const [n, setN] = useState(0);
  return (
    <main className="sandbox-main">
      <h1>React + Vite (TypeScript)</h1>
      <p>
        Create <code>.tsx</code> files with the toolbar, then add an import at the top
        of this file and render your component below.
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

function pathToComponentName(relativePath: string): string {
  const base =
    relativePath
      .replace(/^\/+/, '')
      .replace(/\.tsx?$/i, '')
      .split('/')
      .pop() || 'Item'
  const pascal = base
    .split(/[-_\s]+/)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1))
    .join('')
  const ident = /^[A-Za-z_$]/.test(pascal) ? pascal : `C${pascal}`
  return ident || 'Item'
}

function importPathFromApp(filePath: string): string {
  const normalized = filePath.replace(/^\/+/, '').replace(/\.tsx$/i, '')
  return normalized.startsWith('./') ? normalized : `./${normalized}`
}

function defaultComponentSource(filePath: string): string {
  const name = pathToComponentName(filePath)
  const imp = importPathFromApp(filePath)
  return `export function ${name}() {
  return (
    <section
      style={{
        padding: "0.75rem",
        border: "1px dashed #94a3b8",
        borderRadius: 8,
        marginTop: "0.75rem",
      }}
    >
      <strong>${name}</strong>
      <p style={{ margin: "0.35rem 0 0", fontSize: 14 }}>
        Import in App.tsx: <code>import { ${name} } from "${imp}"</code>
      </p>
    </section>
  );
}
`
}

function normalizeNewFilePath(input: string): string | null {
  let p = input.trim().replace(/\\/g, '/')
  if (!p) {
    return null
  }
  p = p.replace(/^\/+/, '')
  if (!p) {
    return null
  }
  p = `/${p}`
  if (!p.endsWith('.tsx') && !p.endsWith('.ts')) {
    p += '.tsx'
  }
  if (!p.endsWith('.tsx')) {
    return null
  }
  return p
}

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

function PlaygroundToolbar() {
  const { sandpack } = useSandpack()
  const [rawPath, setRawPath] = useState('components/Widget')

  const active = sandpack.activeFile
  const canDelete = Boolean(active && !VITE_REACT_TS_PROTECTED.has(active))

  const handleAdd = () => {
    const path = normalizeNewFilePath(rawPath)
    if (!path) {
      return
    }
    if (sandpack.files[path]) {
      sandpack.openFile(path)
      return
    }
    sandpack.addFile(path, defaultComponentSource(path), true)
    sandpack.openFile(path)
  }

  const handleDelete = () => {
    if (!active || !canDelete) {
      return
    }
    sandpack.deleteFile(active, true)
  }

  return (
    <div className="playground__toolbar">
      <div className="playground__toolbarGroup">
        <label className="playground__label" htmlFor="new-file-path">
          New file
        </label>
        <div className="playground__toolbarRow">
          <input
            id="new-file-path"
            className="playground__input"
            value={rawPath}
            onChange={(e) => setRawPath(e.target.value)}
            placeholder="components/Widget or Button.tsx"
            spellCheck={false}
          />
          <button type="button" className="playground__btn" onClick={handleAdd}>
            Create
          </button>
        </div>
      </div>
      <div className="playground__toolbarGroup playground__toolbarGroup--end">
        <button
          type="button"
          className="playground__btn playground__btn--danger"
          onClick={handleDelete}
          disabled={!canDelete}
          title={
            canDelete
              ? `Delete ${active}`
              : 'Cannot delete entry, config, or styles'
          }
        >
          Delete current file
        </button>
      </div>
    </div>
  )
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

  const onCollabWelcome = useCallback((name: string) => {
    setMyDisplayName(name)
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
        File explorer + tabs; preview is a real Vite build in an iframe. Add{' '}
        <code>.tsx</code> modules and import them from <code>App.tsx</code>.
      </p>

      <div className="playground__collabBar" role="status">
        <div className="playground__collabHead">
          <strong>Онлайн: {collabCount}</strong>
          <span className="playground__collabSep">·</span>
          комната <code>{collabRoom}</code>
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
          {collabPeers.map((p) => (
            <li
              key={p.clientId}
              className={
                p.clientId === collabClientId
                  ? 'playground__rosterItem is-me'
                  : 'playground__rosterItem'
              }
            >
              <span className="playground__rosterName">{p.displayName}</span>
              <span className="playground__rosterMeta">
                {p.activeFile || '—'} · {p.line}:{p.col}
              </span>
            </li>
          ))}
        </ul>
      </div>

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
          />
          <PeerCaretsOverlay selfId={collabClientId} peers={collabPeers} />
          <div className="playground__providerInner">
            <PlaygroundToolbar />
            <SandpackLayout className="playground__sandpack">
              <SandpackFileExplorer />
              <SandpackCodeEditor showTabs showLineNumbers closableTabs />
              <SandpackPreview showNavigator />
            </SandpackLayout>
          </div>
        </SandpackProvider>
      </div>
    </div>
  )
}
