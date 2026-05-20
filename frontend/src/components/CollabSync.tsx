import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { useSandpack } from '@codesandbox/sandpack-react'
import { io, type Socket } from 'socket.io-client'
import type {
  CollabPeerDTO,
  CollabWelcomePayload,
} from '../collab/collab.types'
import {
  normalizePeerColorHexWire,
  normalizePeerHueWire,
} from '../collab/peerColor'
import {
  parseRemoteFileWire,
  parseRemoteRemoveWire,
  validateOutboundFile,
  validateOutboundRemove,
  type RemoteFilePayload,
  type RemoteFileWire,
  type RemoteRemoveWire,
} from '../collab/collabFileGuard'
import { normalizeSandpackFilePath } from '../collab/sandpackPaths'
import {
  collabSyncLog,
  collabSyncTextMeta,
  collabSyncWarn,
} from '../collab/collabSyncLog'
import { readSandpackSelection } from '../collab/sandpackCursor'
import { getAccessToken } from '../auth/tokenStorage'
import { CollabFsContext } from './collabFsContext'
import {
  CollabPasteContext,
  type CollabPasteEventInput,
} from './collabPasteContext'
import {
  getFoldersForFile,
  normalizeNewFolderPath,
} from './PlaygroundFileExplorer/utils/paths'
import { readSandpackFileCode } from '../sandbox/sandpackCode'
import { handleCollabSnapshot } from '../sandbox/sandpackSnapshot'

/** На проде без VITE_* клиент ходит на тот же origin, что и страница (nginx → backend). */
function collabWsUrl(): string {
  const raw = import.meta.env.VITE_COLLAB_WS_URL
  if (typeof raw === 'string' && raw.trim().length > 0) {
    return raw.trim()
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return 'http://localhost:3000'
}

type FsChange = { type: 'fs/change'; path: string; content: string }
type FsRemove = { type: 'fs/remove'; path: string }
type CollabSnapshotPayload = {
  files?: Record<string, string>
  folders?: string[]
}

function isFsChange(m: unknown): m is FsChange {
  return (
    typeof m === 'object' &&
    m !== null &&
    (m as FsChange).type === 'fs/change' &&
    typeof (m as FsChange).path === 'string' &&
    typeof (m as FsChange).content === 'string'
  )
}

function isFsRemove(m: unknown): m is FsRemove {
  return (
    typeof m === 'object' &&
    m !== null &&
    (m as FsRemove).type === 'fs/remove' &&
    typeof (m as FsRemove).path === 'string'
  )
}

const REMOTE_FILE_GUARD_MS = 420
const COLLAB_FILE_DEBOUNCE_MS = 320
/** После snapshot Sandpack на проде дольше шумит fs/change — не считаем это вводом. */
const COLLAB_OUTBOUND_GRACE_MS = 3000
const PAGE_LEAVE_EVENT_COOLDOWN_MS = 5000

/** Устаревший debounced snapshot пира — только если недавно печатали сами. */
function isStaleShorterPrefix(
  path: string,
  incoming: string,
  cur: string | undefined,
  lastLocalFsTouch: Map<string, number>,
): boolean {
  if (cur == null || cur.length <= incoming.length) {
    return false
  }
  if (!cur.startsWith(incoming)) {
    return false
  }
  const t = lastLocalFsTouch.get(path)
  return t != null && Date.now() - t < REMOTE_FILE_GUARD_MS * 2
}

function normalizeFolderList(
  filePaths: string[],
  folders: readonly string[],
): string[] {
  const normalized = new Set<string>()

  folders.forEach((folderPath) => {
    const path = normalizeNewFolderPath(folderPath)
    if (path) {
      normalized.add(path)
    }
  })

  filePaths.forEach((filePath) => {
    getFoldersForFile(filePath).forEach((folderPath) => {
      normalized.add(folderPath)
    })
  })

  return Array.from(normalized).sort((a, b) => a.localeCompare(b))
}

function sortPaths(paths: string[]): string[] {
  return Array.from(new Set(paths)).sort((a, b) => a.localeCompare(b))
}

function isMouseLeavingViewport(event: MouseEvent): boolean {
  const nextTarget =
    event.relatedTarget ??
    (
      event as MouseEvent & {
        toElement?: EventTarget | null
      }
    ).toElement
  if (nextTarget) {
    return false
  }

  return (
    event.clientX <= 0 ||
    event.clientY <= 0 ||
    event.clientX >= window.innerWidth ||
    event.clientY >= window.innerHeight
  )
}

export function CollabSync({
  room,
  clientId,
  onRoster,
  onWelcome,
  requestProviderBoot,
  children,
}: {
  room: string
  clientId: string
  onRoster?: (peers: CollabPeerDTO[], count: number) => void
  onWelcome?: (welcome: CollabWelcomePayload) => void
  /** Первый snapshot с кастомным пресетом — remount `SandpackProvider` в Playground. */
  requestProviderBoot?: (merged: Record<string, string>) => boolean
  children?: ReactNode
}) {
  const { sandpack, listen } = useSandpack()
  const [snapshotReady, setSnapshotReady] = useState(false)
  const [filePaths, setFilePaths] = useState<string[]>([])
  const [folderPaths, setFolderPaths] = useState<string[]>([])
  const socketRef = useRef<Socket | null>(null)
  const skipOutbound = useRef(false)
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  )
  const sandpackRef = useRef(sandpack)
  const filePathsRef = useRef<string[]>([])
  const folderPathsRef = useRef<string[]>([])
  /** Пути, реально переданные в Sandpack при последнем snapshot (≠ полный merged из Mongo). */
  const sandpackSyncedPathsRef = useRef<string[]>([])
  const lastPresence = useRef({
    file: '',
    anchorLine: 0,
    anchorCol: 0,
    headLine: 0,
    headCol: 0,
  })
  const lastRemoteRevision = useRef<Map<string, number>>(new Map())
  const lastLocalFsTouch = useRef<Map<string, number>>(new Map())
  /** Реальный ввод с клавиатуры — guard/stale-prefix только для этих путей. */
  const userEditedPaths = useRef<Set<string>>(new Set())
  const hasSnapshotRef = useRef(false)
  const outboundGraceUntilRef = useRef(0)
  const pendingRemoteApplyRef = useRef<Map<string, RemoteFilePayload>>(new Map())
  const flushPendingRemoteApplyRef = useRef<() => void>(() => {})
  const onRosterRef = useRef(onRoster)
  const onWelcomeRef = useRef(onWelcome)
  const requestProviderBootRef = useRef(requestProviderBoot)
  useLayoutEffect(() => {
    sandpackRef.current = sandpack
    onRosterRef.current = onRoster
    onWelcomeRef.current = onWelcome
    requestProviderBootRef.current = requestProviderBoot
  }, [sandpack, onRoster, onWelcome, requestProviderBoot])

  useEffect(() => {
    filePathsRef.current = filePaths
    folderPathsRef.current = folderPaths
  }, [filePaths, folderPaths])

  const syncFolders = useCallback(
    (folders: string[], nextFilePaths?: string[]) => {
      const baseFiles = nextFilePaths ?? filePathsRef.current
      const nextFolders = normalizeFolderList(baseFiles, folders)
      folderPathsRef.current = nextFolders
      setFolderPaths(nextFolders)
      socketRef.current?.emit('collab-folders-sync', {
        room,
        folders: nextFolders,
      })
    },
    [room],
  )

  const saveFile = useCallback(
    (path: string, content: string) => {
      const normalizedPath = normalizeSandpackFilePath(path)
      if (!normalizedPath) {
        return
      }

      const nextFilePaths = sortPaths([...filePathsRef.current, normalizedPath])
      filePathsRef.current = nextFilePaths
      setFilePaths(nextFilePaths)

      const nextFolders = normalizeFolderList(
        nextFilePaths,
        folderPathsRef.current,
      )
      folderPathsRef.current = nextFolders
      setFolderPaths(nextFolders)

      userEditedPaths.current.add(normalizedPath)
      lastLocalFsTouch.current.set(normalizedPath, Date.now())
      const outbound = validateOutboundFile({
        path: normalizedPath,
        content,
        clientId,
      })
      if (!outbound.ok) {
        collabSyncLog('editor', 'local-file-skip', {
          reason: outbound.reason,
          path: normalizedPath,
        })
        return
      }
      collabSyncLog('editor', 'save-file-emit', {
        path: outbound.path,
        room,
        ...collabSyncTextMeta(outbound.content),
      })
      socketRef.current?.emit('collab-file', {
        room,
        path: outbound.path,
        content: outbound.content,
        from: outbound.from,
      })
    },
    [clientId, room],
  )

  const recordPaste = useCallback(
    (event: CollabPasteEventInput) => {
      const normalizedPath = normalizeSandpackFilePath(event.path)
      if (!normalizedPath || !event.content) {
        return
      }
      socketRef.current?.emit('collab-paste', {
        room,
        clientId,
        path: normalizedPath,
        content: event.content,
        fileContent: event.fileContent,
        insertStartOffset: event.insertStartOffset,
        insertEndOffset: event.insertEndOffset,
        line: event.line,
        col: event.col,
      })
    },
    [clientId, room],
  )

  const removeFile = useCallback(
    (path: string) => {
      const normalizedPath = normalizeSandpackFilePath(path)
      if (!normalizedPath) {
        return
      }
      const pending = debounceTimers.current.get(normalizedPath)
      if (pending) {
        clearTimeout(pending)
        debounceTimers.current.delete(normalizedPath)
      }

      const nextFilePaths = filePathsRef.current.filter(
        (entry) => entry !== normalizedPath,
      )
      filePathsRef.current = nextFilePaths
      setFilePaths(nextFilePaths)

      const nextFolders = normalizeFolderList(
        nextFilePaths,
        folderPathsRef.current,
      )
      folderPathsRef.current = nextFolders
      setFolderPaths(nextFolders)

      const outbound = validateOutboundRemove({
        path: normalizedPath,
        clientId,
      })
      if (!outbound.ok) {
        collabSyncLog('editor', 'local-remove-skip', {
          reason: outbound.reason,
          path: normalizedPath,
        })
        return
      }
      userEditedPaths.current.delete(outbound.path)
      lastLocalFsTouch.current.delete(outbound.path)
      socketRef.current?.emit('collab-remove', {
        room,
        path: outbound.path,
        from: outbound.from,
      })
    },
    [clientId, room],
  )

  useEffect(() => {
    const debounceMap = debounceTimers.current
    let rosterRaf: number | null = null
    const wsUrl = collabWsUrl()
    const socket = io(wsUrl, {
      path: '/socket.io',
      /** polling первым — часть прод-прокси режет upgrade WebSocket. */
      transports: ['polling', 'websocket'],
      reconnection: true,
      reconnectionAttempts: Infinity,
      reconnectionDelay: 800,
      reconnectionDelayMax: 5000,
      timeout: 20000,
      auth: (cb) => {
        cb({ token: getAccessToken() ?? '' })
      },
    })
    socketRef.current = socket

    socket.on('connect_error', (err: Error) => {
      collabSyncWarn('socket', 'connect_error', {
        message: err.message,
        wsUrl,
      })
    })
    socket.on('disconnect', (reason: string) => {
      collabSyncWarn('socket', 'disconnect', { reason, room })
    })

    const applyRemotePayload = (path: string, p: RemoteFilePayload) => {
      if (sandpackRef.current.status !== 'running') {
        pendingRemoteApplyRef.current.set(path, p)
        collabSyncLog('editor', 'remote-file-defer', {
          reason: 'sandpack-not-ready',
          path,
          from: p.from,
        })
        return
      }
      pendingRemoteApplyRef.current.delete(path)
      skipOutbound.current = true
      collabSyncLog('editor', 'remote-file-apply', {
        path,
        from: p.from,
        rev: p.rev,
        ...collabSyncTextMeta(p.content),
      })
      sandpackRef.current.updateFile(path, p.content, true)
      skipOutbound.current = false
    }

    flushPendingRemoteApplyRef.current = () => {
      if (pendingRemoteApplyRef.current.size === 0) {
        return
      }
      for (const [path, p] of [...pendingRemoteApplyRef.current.entries()]) {
        applyRemotePayload(path, p)
      }
    }

    const onConnect = () => {
      collabSyncLog('socket', 'connect', { room, clientId, wsUrl })
      if (!hasSnapshotRef.current) {
        setSnapshotReady(false)
      }
      lastRemoteRevision.current.clear()
      lastLocalFsTouch.current.clear()
      userEditedPaths.current.clear()
      lastPresence.current = {
        file: '',
        anchorLine: 0,
        anchorCol: 0,
        headLine: 0,
        headCol: 0,
      }
      socket.emit('collab-join', { room, clientId })
    }
    socket.on('connect', onConnect)
    if (socket.connected) {
      onConnect()
    }

    socket.on(
      'collab-welcome',
      (p: {
        displayName?: string
        clientId?: string
        hue?: unknown
        colorHex?: unknown
      }) => {
        lastPresence.current = {
          file: '',
          anchorLine: 0,
          anchorCol: 0,
          headLine: 0,
          headCol: 0,
        }
        if (typeof p?.displayName !== 'string') {
          return
        }
        const hue = normalizePeerHueWire(p.hue)
        const colorHex = normalizePeerColorHexWire(p.colorHex)
        if (hue === undefined || colorHex === undefined) {
          return
        }
        const cid =
          typeof p.clientId === 'string' && p.clientId.length > 0
            ? p.clientId
            : clientId
        onWelcomeRef.current?.({
          clientId: cid,
          displayName: p.displayName,
          hue,
          colorHex,
        })
      },
    )

    socket.on(
      'collab-roster',
      (payload: { peers?: CollabPeerDTO[]; count?: number }) => {
        const raw = Array.isArray(payload?.peers) ? payload.peers : []
        const peers: CollabPeerDTO[] = raw.map((p) => {
          const typed = p as CollabPeerDTO & {
            hue?: unknown
            colorHex?: unknown
          }
          const hue = normalizePeerHueWire(typed.hue)
          const colorHex = normalizePeerColorHexWire(typed.colorHex)
          let next: CollabPeerDTO = { ...typed }
          if (hue !== undefined) {
            next = { ...next, hue }
          }
          if (colorHex !== undefined) {
            next = { ...next, colorHex }
          }
          return next
        })
        const count =
          typeof payload?.count === 'number' ? payload.count : peers.length
        if (rosterRaf !== null) {
          cancelAnimationFrame(rosterRaf)
        }
        rosterRaf = requestAnimationFrame(() => {
          rosterRaf = null
          onRosterRef.current?.(peers, count)
        })
      },
    )

    socket.on('collab-snapshot', (payload: CollabSnapshotPayload) => {
      collabSyncLog('snapshot', 'inbound', {
        room,
        fileCount: Object.keys(payload?.files ?? {}).length,
        folderCount: Array.isArray(payload?.folders)
          ? payload.folders.length
          : 0,
        prevSyncedPaths: sandpackSyncedPathsRef.current.length,
      })
      skipOutbound.current = true
      debounceTimers.current.forEach((t) => clearTimeout(t))
      debounceTimers.current.clear()
      lastRemoteRevision.current.clear()
      lastLocalFsTouch.current.clear()
      userEditedPaths.current.clear()

      const result = handleCollabSnapshot({
        payload,
        sandpack: sandpackRef.current,
        previousSyncedPaths: sandpackSyncedPathsRef.current,
        requestProviderBoot: requestProviderBootRef.current,
      })

      const nextFolders = normalizeFolderList(
        result.explorerPaths,
        Array.isArray(payload?.folders) ? payload.folders : [],
      )

      sandpackSyncedPathsRef.current = result.syncPaths
      filePathsRef.current = result.explorerPaths
      folderPathsRef.current = nextFolders
      setFilePaths(result.explorerPaths)
      setFolderPaths(nextFolders)
      skipOutbound.current = false
      hasSnapshotRef.current = true
      outboundGraceUntilRef.current = Date.now() + COLLAB_OUTBOUND_GRACE_MS
      setSnapshotReady(true)
      queueMicrotask(() => flushPendingRemoteApplyRef.current())
      collabSyncLog('snapshot', 'applied', {
        room,
        skippedSandpackApply: result.skippedSandpackApply,
        explorerPaths: result.explorerPaths.length,
        syncPaths: result.syncPaths.length,
      })
    })

    socket.on('collab-file', (wire: RemoteFileWire) => {
      const parsed = parseRemoteFileWire(wire)
      if (!parsed.ok) {
        collabSyncLog('editor', 'remote-file-skip', { reason: parsed.reason })
        return
      }
      const p = parsed.value
      if (p.from === clientId) {
        return
      }
      const path = p.path
      if (typeof p.rev === 'number' && Number.isFinite(p.rev)) {
        const currentRev = lastRemoteRevision.current.get(path) ?? 0
        const nextRev = Math.floor(p.rev)
        if (nextRev <= currentRev) {
          collabSyncLog('editor', 'remote-file-skip', {
            reason: 'stale-rev',
            path,
            rev: nextRev,
            currentRev,
            from: p.from,
          })
          return
        }
        lastRemoteRevision.current.set(path, nextRev)
      }
      setFilePaths((prev) => {
        const next = prev.includes(path)
          ? prev
          : [...prev, path].sort((a, b) => a.localeCompare(b))
        filePathsRef.current = next
        setFolderPaths((currentFolders) => {
          const nextFolders = normalizeFolderList(next, currentFolders)
          folderPathsRef.current = nextFolders
          return nextFolders
        })
        return next
      })

      const cur = readSandpackFileCode(sandpackRef.current.files[path])
      if (cur === p.content) {
        return
      }
      if (
        userEditedPaths.current.has(path) &&
        isStaleShorterPrefix(path, p.content, cur, lastLocalFsTouch.current)
      ) {
        collabSyncLog('editor', 'remote-file-skip', {
          reason: 'stale-shorter-prefix',
          path,
          from: p.from,
        })
        return
      }
      const touched = lastLocalFsTouch.current.get(path)
      if (
        userEditedPaths.current.has(path) &&
        touched != null &&
        Date.now() - touched < REMOTE_FILE_GUARD_MS
      ) {
        collabSyncLog('editor', 'remote-file-skip', {
          reason: 'local-guard',
          path,
          from: p.from,
          msSinceLocal: Date.now() - touched,
        })
        return
      }
      applyRemotePayload(path, p)
    })

    socket.on('collab-remove', (wire: RemoteRemoveWire) => {
      const parsed = parseRemoteRemoveWire(wire)
      if (!parsed.ok) {
        collabSyncLog('editor', 'remote-remove-skip', {
          reason: parsed.reason,
        })
        return
      }
      const { path, from, rev } = parsed.value
      if (from === clientId) {
        collabSyncLog('editor', 'remote-remove-skip', { reason: 'self-echo' })
        return
      }
      if (rev !== undefined) {
        const currentRev = lastRemoteRevision.current.get(path) ?? 0
        if (rev <= currentRev) {
          collabSyncLog('editor', 'remote-remove-skip', {
            reason: 'stale-rev',
            path,
            rev,
            currentRev,
          })
          return
        }
        lastRemoteRevision.current.set(path, rev)
      }
      if (!sandpackRef.current.files[path]) {
        collabSyncLog('editor', 'remote-remove-skip', {
          reason: 'unchanged',
          path,
        })
        return
      }
      const pending = debounceTimers.current.get(path)
      if (pending) {
        clearTimeout(pending)
        debounceTimers.current.delete(path)
      }
      setFilePaths((prev) => {
        const next = prev.filter((entry) => entry !== path)
        filePathsRef.current = next
        setFolderPaths((currentFolders) => {
          const nextFolders = normalizeFolderList(next, currentFolders)
          folderPathsRef.current = nextFolders
          return nextFolders
        })
        return next
      })
      userEditedPaths.current.delete(path)
      lastLocalFsTouch.current.delete(path)
      skipOutbound.current = true
      sandpackRef.current.deleteFile(path, true)
      skipOutbound.current = false
    })

    socket.on('collab-folders', (folders: string[]) => {
      const nextFolders = normalizeFolderList(
        filePathsRef.current,
        Array.isArray(folders) ? folders : [],
      )
      folderPathsRef.current = nextFolders
      setFolderPaths(nextFolders)
    })

    return () => {
      if (rosterRaf !== null) {
        cancelAnimationFrame(rosterRaf)
      }
      debounceMap.forEach((t) => clearTimeout(t))
      debounceMap.clear()
      socket.off('connect', onConnect)
      socket.disconnect()
      socketRef.current = null
    }
  }, [room, clientId])

  useEffect(() => {
    if (sandpack.status !== 'running') {
      return
    }
    const unsub = listen((message) => {
      if (skipOutbound.current) {
        if (isFsChange(message) || isFsRemove(message)) {
          collabSyncLog('editor', 'local-fs-suppressed', {
            type: (message as FsChange | FsRemove).type,
            path: (message as FsChange | FsRemove).path,
          })
        }
        return
      }
      if (isFsChange(message)) {
        const normalizedPath = normalizeSandpackFilePath(message.path)
        if (!normalizedPath) {
          return
        }
        if (Date.now() < outboundGraceUntilRef.current) {
          collabSyncLog('editor', 'local-fs-suppressed', {
            reason: 'outbound-grace',
            path: normalizedPath,
          })
          return
        }
        userEditedPaths.current.add(normalizedPath)
        lastLocalFsTouch.current.set(normalizedPath, Date.now())
        const prev = debounceTimers.current.get(normalizedPath)
        if (prev) {
          clearTimeout(prev)
          collabSyncLog('editor', 'local-file-debounce-reset', {
            path: normalizedPath,
          })
        } else {
          collabSyncLog('editor', 'local-file-debounce-start', {
            path: normalizedPath,
            debounceMs: COLLAB_FILE_DEBOUNCE_MS,
          })
        }
        debounceTimers.current.set(
          normalizedPath,
          setTimeout(() => {
            debounceTimers.current.delete(normalizedPath)
            const content =
              readSandpackFileCode(
                sandpackRef.current.files[normalizedPath],
              ) ?? ''
            const outbound = validateOutboundFile({
              path: normalizedPath,
              content,
              clientId,
            })
            if (!outbound.ok) {
              collabSyncLog('editor', 'local-file-skip', {
                reason: outbound.reason,
                path: normalizedPath,
              })
              return
            }
            collabSyncLog('editor', 'local-file-emit', {
              path: outbound.path,
              room,
              ...collabSyncTextMeta(outbound.content),
            })
            socketRef.current?.emit('collab-file', {
              room,
              path: outbound.path,
              content: outbound.content,
              from: outbound.from,
            })
          }, COLLAB_FILE_DEBOUNCE_MS),
        )
      } else if (isFsRemove(message)) {
        const normalizedPath = normalizeSandpackFilePath(message.path)
        if (!normalizedPath) {
          return
        }
        userEditedPaths.current.delete(normalizedPath)
        lastLocalFsTouch.current.delete(normalizedPath)
        const pending = debounceTimers.current.get(normalizedPath)
        if (pending) {
          clearTimeout(pending)
          debounceTimers.current.delete(normalizedPath)
        }
        const outboundRemove = validateOutboundRemove({
          path: normalizedPath,
          clientId,
        })
        if (!outboundRemove.ok) {
          collabSyncLog('editor', 'local-remove-skip', {
            reason: outboundRemove.reason,
            path: normalizedPath,
          })
          return
        }
        socketRef.current?.emit('collab-remove', {
          room,
          path: outboundRemove.path,
          from: outboundRemove.from,
        })
      }
    })
    return unsub
  }, [listen, room, clientId, sandpack.status])

  useEffect(() => {
    if (sandpack.status === 'running') {
      flushPendingRemoteApplyRef.current()
    }
  }, [sandpack.status])

  useEffect(() => {
    hasSnapshotRef.current = false
    outboundGraceUntilRef.current = 0
    pendingRemoteApplyRef.current.clear()
    setSnapshotReady(false)
  }, [room])

  useEffect(() => {
    if (sandpack.status !== 'running' || !snapshotReady) {
      return
    }
    collabSyncLog('presence', 'reset-on-active-file', {
      activeFile: normalizeSandpackFilePath(sandpack.activeFile ?? ''),
    })
    lastPresence.current = {
      file: '',
      anchorLine: 0,
      anchorCol: 0,
      headLine: 0,
      headCol: 0,
    }
  }, [sandpack.activeFile, sandpack.status, snapshotReady])

  useEffect(() => {
    if (sandpack.status !== 'running') {
      return
    }
    /** Must not bail when socket is still connecting — otherwise this effect
     * never re-runs and presence never starts (peers see no remote cursor). */
    const id = window.setInterval(() => {
      const socket = socketRef.current
      if (!socket?.connected) {
        return
      }
      const file = normalizeSandpackFilePath(
        sandpackRef.current.activeFile ?? '',
      )
      const sel = readSandpackSelection()
      const anchorLine = sel?.anchor.line ?? 1
      const anchorCol = sel?.anchor.col ?? 1
      const headLine = sel?.head.line ?? 1
      const headCol = sel?.head.col ?? 1
      const prev = lastPresence.current
      if (
        prev.file === file &&
        prev.anchorLine === anchorLine &&
        prev.anchorCol === anchorCol &&
        prev.headLine === headLine &&
        prev.headCol === headCol
      ) {
        return
      }
      lastPresence.current = {
        file,
        anchorLine,
        anchorCol,
        headLine,
        headCol,
      }
      collabSyncLog('presence', 'emit', {
        room,
        file,
        anchorLine,
        anchorCol,
        headLine,
        headCol,
      })
      socket.emit('collab-presence', {
        room,
        clientId,
        activeFile: file,
        anchorLine,
        anchorCol,
        headLine,
        headCol,
      })
    }, 120)
    return () => window.clearInterval(id)
  }, [sandpack.status, room, clientId])

  useEffect(() => {
    if (sandpack.status !== 'running') {
      return
    }

    let cursorInsidePage = true
    let lastPageLeaveAt = 0

    const emitPageLeave = () => {
      const now = Date.now()
      if (now - lastPageLeaveAt < PAGE_LEAVE_EVENT_COOLDOWN_MS) {
        return
      }
      lastPageLeaveAt = now
      socketRef.current?.emit('collab-page-leave', { room, clientId })
    }

    const onMouseOut = (event: MouseEvent) => {
      if (!cursorInsidePage || !isMouseLeavingViewport(event)) {
        return
      }
      cursorInsidePage = false
      emitPageLeave()
    }

    const onMouseOver = () => {
      cursorInsidePage = true
    }

    document.addEventListener('mouseout', onMouseOut)
    document.addEventListener('mouseover', onMouseOver)
    return () => {
      document.removeEventListener('mouseout', onMouseOut)
      document.removeEventListener('mouseover', onMouseOver)
    }
  }, [sandpack.status, room, clientId])

  const contextValue = useMemo(
    () => ({
      filePaths,
      folderPaths,
      snapshotReady,
      syncFolders,
      saveFile,
      removeFile,
    }),
    [filePaths, folderPaths, removeFile, saveFile, snapshotReady, syncFolders],
  )

  const pasteContextValue = useMemo(
    () => ({
      recordPaste,
    }),
    [recordPaste],
  )

  return (
    <CollabFsContext.Provider value={contextValue}>
      <CollabPasteContext.Provider value={pasteContextValue}>
        {children ?? null}
      </CollabPasteContext.Provider>
    </CollabFsContext.Provider>
  )
}
