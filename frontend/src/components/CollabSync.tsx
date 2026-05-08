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
import { normalizeSandpackFilePath } from '../collab/sandpackPaths'
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

function collabWsUrl(): string {
  const raw = import.meta.env.VITE_COLLAB_WS_URL
  if (typeof raw === 'string' && raw.length > 0) {
    return raw
  }
  if (typeof window !== 'undefined' && window.location?.origin) {
    return window.location.origin
  }
  return 'http://localhost:3000'
}

function getFileCode(f: unknown): string | undefined {
  if (f == null) {
    return undefined
  }
  if (typeof f === 'string') {
    return f
  }
  if (typeof f === 'object' && f !== null && 'code' in f) {
    const c = (f as { code: unknown }).code
    return typeof c === 'string' ? c : undefined
  }
  return undefined
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

/** Ignore remote full-file updates shortly after local keystrokes — avoids
 * stale snapshots from debounced peers overwriting fast typing. */
const REMOTE_FILE_GUARD_MS = 420
const COLLAB_FILE_DEBOUNCE_MS = 320

/** Drop stale peer payloads: local doc strictly extended what remote still has. */
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

function normalizeSnapshotFiles(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== 'object') {
    return {}
  }

  const out: Record<string, string> = {}
  Object.entries(raw as Record<string, unknown>).forEach(([path, content]) => {
    const normalizedPath = normalizeSandpackFilePath(path)
    if (!normalizedPath || typeof content !== 'string') {
      return
    }
    out[normalizedPath] = content
  })
  return out
}

function syncSandpackSnapshot(
  sandpack: ReturnType<typeof useSandpack>['sandpack'],
  files: Record<string, string>,
) {
  let touched = false

  Object.entries(files).forEach(([path, content]) => {
    const cur = getFileCode(sandpack.files[path])
    if (cur !== content) {
      sandpack.updateFile(path, content, false)
      touched = true
    }
  })

  const pathsToDelete = Object.keys(sandpack.files)
    .filter((path) => !(path in files))
    .sort((a, b) => b.length - a.length)

  pathsToDelete.forEach((path) => {
    sandpack.deleteFile(path, false)
    touched = true
  })

  const nextActive = normalizeSandpackFilePath(sandpack.activeFile ?? '')
  if (!files[nextActive]) {
    const firstPath = Object.keys(files).sort((a, b) => a.localeCompare(b))[0]
    if (firstPath) {
      sandpack.openFile(firstPath)
    }
  }

  if (touched) {
    queueMicrotask(() => {
      void sandpack.runSandpack()
    })
  }
}

function sortPaths(paths: string[]): string[] {
  return Array.from(new Set(paths)).sort((a, b) => a.localeCompare(b))
}

export function CollabSync({
  room,
  clientId,
  onRoster,
  onWelcome,
  children,
}: {
  room: string
  clientId: string
  onRoster?: (peers: CollabPeerDTO[], count: number) => void
  onWelcome?: (welcome: CollabWelcomePayload) => void
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
  const lastPresence = useRef({
    file: '',
    anchorLine: 0,
    anchorCol: 0,
    headLine: 0,
    headCol: 0,
  })
  const lastLocalFsTouch = useRef<Map<string, number>>(new Map())
  const lastRemoteRevision = useRef<Map<string, number>>(new Map())
  const onRosterRef = useRef(onRoster)
  const onWelcomeRef = useRef(onWelcome)
  useLayoutEffect(() => {
    sandpackRef.current = sandpack
    onRosterRef.current = onRoster
    onWelcomeRef.current = onWelcome
  }, [sandpack, onRoster, onWelcome])

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

      socketRef.current?.emit('collab-file', {
        room,
        path: normalizedPath,
        content,
        from: clientId,
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

      socketRef.current?.emit('collab-remove', {
        room,
        path: normalizedPath,
        from: clientId,
      })
    },
    [clientId, room],
  )

  useEffect(() => {
    const debounceMap = debounceTimers.current
    let rosterRaf: number | null = null
    const socket = io(collabWsUrl(), {
      transports: ['websocket', 'polling'],
      path: '/socket.io',
      auth: (cb) => {
        cb({ token: getAccessToken() ?? '' })
      },
    })
    socketRef.current = socket

    const onConnect = () => {
      setSnapshotReady(false)
      lastRemoteRevision.current.clear()
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
      const files = normalizeSnapshotFiles(payload?.files)
      const nextFilePaths = Object.keys(files).sort((a, b) =>
        a.localeCompare(b),
      )
      const nextFolders = normalizeFolderList(
        nextFilePaths,
        Array.isArray(payload?.folders) ? payload.folders : [],
      )

      skipOutbound.current = true
      debounceTimers.current.forEach((t) => clearTimeout(t))
      debounceTimers.current.clear()
      lastLocalFsTouch.current.clear()
      lastRemoteRevision.current.clear()
      filePathsRef.current = nextFilePaths
      folderPathsRef.current = nextFolders
      setFilePaths(nextFilePaths)
      setFolderPaths(nextFolders)
      syncSandpackSnapshot(sandpackRef.current, files)
      skipOutbound.current = false
      setSnapshotReady(true)
    })

    socket.on(
      'collab-file',
      (p: { path: string; content: string; from: string; rev?: number }) => {
        if (p.from === clientId) {
          return
        }
        const path = normalizeSandpackFilePath(p.path)
        if (!path) {
          return
        }
        if (typeof p.rev === 'number' && Number.isFinite(p.rev)) {
          const currentRev = lastRemoteRevision.current.get(path) ?? 0
          const nextRev = Math.floor(p.rev)
          if (nextRev <= currentRev) {
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

        const cur = getFileCode(sandpackRef.current.files[path])
        if (cur === p.content) {
          return
        }
        if (
          p.from !== clientId &&
          isStaleShorterPrefix(path, p.content, cur, lastLocalFsTouch.current)
        ) {
          return
        }
        const touched = lastLocalFsTouch.current.get(path)
        if (
          p.from !== clientId &&
          touched != null &&
          Date.now() - touched < REMOTE_FILE_GUARD_MS
        ) {
          return
        }
        skipOutbound.current = true
        sandpackRef.current.updateFile(path, p.content, true)
        skipOutbound.current = false
      },
    )

    socket.on(
      'collab-remove',
      (p: { path: string; from: string; rev?: number }) => {
        if (p.from === clientId) {
          return
        }
        const path = normalizeSandpackFilePath(p.path)
        if (!path) {
          return
        }
        if (typeof p.rev === 'number' && Number.isFinite(p.rev)) {
          const currentRev = lastRemoteRevision.current.get(path) ?? 0
          const nextRev = Math.floor(p.rev)
          if (nextRev <= currentRev) {
            return
          }
          lastRemoteRevision.current.set(path, nextRev)
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
        skipOutbound.current = true
        if (sandpackRef.current.files[path]) {
          sandpackRef.current.deleteFile(path, true)
        }
        skipOutbound.current = false
      },
    )

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
        return
      }
      if (isFsChange(message)) {
        const normalizedPath = normalizeSandpackFilePath(message.path)
        if (!normalizedPath) {
          return
        }
        const { content } = message
        lastLocalFsTouch.current.set(normalizedPath, Date.now())
        const prev = debounceTimers.current.get(normalizedPath)
        if (prev) {
          clearTimeout(prev)
        }
        debounceTimers.current.set(
          normalizedPath,
          setTimeout(() => {
            debounceTimers.current.delete(normalizedPath)
            socketRef.current?.emit('collab-file', {
              room,
              path: normalizedPath,
              content,
              from: clientId,
            })
          }, COLLAB_FILE_DEBOUNCE_MS),
        )
      } else if (isFsRemove(message)) {
        const normalizedPath = normalizeSandpackFilePath(message.path)
        if (!normalizedPath) {
          return
        }
        const pending = debounceTimers.current.get(normalizedPath)
        if (pending) {
          clearTimeout(pending)
          debounceTimers.current.delete(normalizedPath)
        }
        socketRef.current?.emit('collab-remove', {
          room,
          path: normalizedPath,
          from: clientId,
        })
      }
    })
    return unsub
  }, [listen, room, clientId, sandpack.status])

  useEffect(() => {
    if (sandpack.status !== 'running' || !snapshotReady) {
      return
    }
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
