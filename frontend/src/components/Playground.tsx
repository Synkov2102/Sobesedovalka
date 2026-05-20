import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from 'react'
import { useTheme } from '@mui/material/styles'
import {
  SandpackProvider,
  SandpackLayout,
  SandpackCodeEditor,
  SandpackPreview,
  useSandpack,
} from '@codesandbox/sandpack-react'
import { fetchCollabRoomReady } from '../api/taskPresets'
import type { CollabPeerDTO } from '../collab/collab.types'
import { CollabSync } from './CollabSync'
import { PeerCaretsOverlay } from './PeerCaretsOverlay'
import { PlaygroundCollabBar } from './PlaygroundCollabBar'
import { PlaygroundFileExplorer } from './PlaygroundFileExplorer'
import { useCollabPaste } from './collabPasteContext'
import { SANDPACK_TEMPLATE } from '../sandbox/sandpackConfig'
import { useCollabSandpackProvider } from '../sandbox/useCollabSandpackProvider'
import { v4 as uuidv4 } from 'uuid'
import {
  setCodeEditorPasteHandler,
  codeEditorPasteExtension,
} from './codeEditorPasteExtension'
import {
  typescriptAdditionalLanguages,
  typescriptCodeEditorExtensions,
} from './codeEditorExtensions'
import { sandpackYjsBindingExtension } from '../collab/sandpackYjsBinding'
import './Playground.css'

type PlaygroundProps = {
  onInvalidExplicitRoom?: () => void
}

type ParsedCollabRoom =
  | { kind: 'missing' }
  | { kind: 'explicit'; roomId: string }
  | { kind: 'explicit_invalid' }

/** Sandpack/Vite в iframe использует Web Crypto в воркерах — только secure context (HTTPS или localhost). */
function isSandpackCryptoAvailable(): boolean {
  if (typeof window === 'undefined') {
    return true
  }
  return (
    window.isSecureContext === true &&
    typeof globalThis.crypto?.subtle?.digest === 'function'
  )
}

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
        // `crypto.randomUUID` только в secure context (HTTPS или localhost); прод по HTTP на IP — нет.
        id = uuidv4()
        sessionStorage.setItem(k, id)
      }
      return id
    } catch {
      return uuidv4()
    }
  }, [])
}

function PasteTrackingCodeEditor() {
  const { sandpack } = useSandpack()
  const paste = useCollabPaste()
  const activeFileRef = useRef(sandpack.activeFile ?? '')
  const recordPasteRef = useRef(paste?.recordPaste)

  useLayoutEffect(() => {
    activeFileRef.current = sandpack.activeFile ?? ''
    recordPasteRef.current = paste?.recordPaste
  }, [paste?.recordPaste, sandpack.activeFile])

  useLayoutEffect(() => {
    setCodeEditorPasteHandler((event, view) => {
      const content = event.clipboardData?.getData('text/plain') ?? ''
      const recordPaste = recordPasteRef.current
      const path = activeFileRef.current
      if (!content || !recordPaste || !path) {
        return
      }

      const selection = view.state.selection.main
      const insertStartOffset = selection.from
      const insertEndOffset = insertStartOffset + content.length
      const line = view.state.doc.lineAt(insertStartOffset)
      const before = view.state.doc.sliceString(0, selection.from)
      const after = view.state.doc.sliceString(selection.to)
      recordPaste({
        path,
        content,
        fileContent: `${before}${content}${after}`,
        insertStartOffset,
        insertEndOffset,
        line: line.number,
        col: insertStartOffset - line.from + 1,
      })
    })
    return () => setCodeEditorPasteHandler(null)
  })

  const editorExtensions = useMemo(
    () => [
      ...typescriptCodeEditorExtensions,
      codeEditorPasteExtension,
      sandpackYjsBindingExtension,
    ],
    [],
  )

  return (
    <SandpackCodeEditor
      showTabs
      showLineNumbers
      closableTabs
      extensions={editorExtensions}
      additionalLanguages={typescriptAdditionalLanguages}
    />
  )
}

export function Playground({ onInvalidExplicitRoom }: PlaygroundProps) {
  const muiTheme = useTheme()
  const sandpackTheme = muiTheme.palette.mode
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

  const collabRoomId =
    parsedRoom.kind === 'explicit' && roomAccess === 'ready'
      ? parsedRoom.roomId
      : ''
  const { providerKey, providerFiles, requestProviderBoot, sandpackOptions } =
    useCollabSandpackProvider(collabRoomId)

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

  if (!isSandpackCryptoAvailable()) {
    return (
      <div className="playground playground--fill">
        <p className="panel__muted">
          Редактор с живым превью (Sandpack) нуждается в{' '}
          <strong>безопасном контексте</strong> браузера: откройте приложение по{' '}
          <strong>HTTPS</strong> или с хоста <strong>localhost</strong>. На
          адресе вида <code>http://IP:порт</code> у страницы нет доступа к{' '}
          <code>crypto.subtle</code>, поэтому сборка превью падает с ошибкой про{' '}
          <code>digest</code>.
        </p>
        <p className="panel__muted">
          Для VPS обычно ставят TLS (Let&apos;s Encrypt, сертификат за обратным
          прокси) и заходят на <code>https://ваш-домен</code>.
        </p>
      </div>
    )
  }

  if (parsedRoom.kind !== 'explicit' || roomAccess !== 'ready') {
    return null
  }

  const roomId = parsedRoom.roomId

  return (
    <div className="playground playground--fill">
      <div className="playground__spWrap">
        <SandpackProvider
          key={providerKey}
          template={SANDPACK_TEMPLATE}
          theme={sandpackTheme}
          files={providerFiles}
          options={sandpackOptions}
        >
          <CollabSync
            room={roomId}
            clientId={collabClientId}
            onRoster={onCollabRoster}
            requestProviderBoot={requestProviderBoot}
          >
            <PlaygroundCollabBar
              collabPeers={collabPeers}
              selfClientId={collabClientId}
            />
            <PeerCaretsOverlay selfId={collabClientId} peers={collabPeers} />
            <div className="playground__providerInner">
              <SandpackLayout className="playground__sandpack">
                <PlaygroundFileExplorer collabPeers={collabPeers} />
                <PasteTrackingCodeEditor />
                <SandpackPreview showNavigator showOpenInCodeSandbox={false} />
              </SandpackLayout>
            </div>
          </CollabSync>
        </SandpackProvider>
      </div>
    </div>
  )
}
