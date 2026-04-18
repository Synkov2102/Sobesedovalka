import { useEffect, useRef, useLayoutEffect, useState } from 'react'
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

function collabWsUrl(): string {
  const raw = import.meta.env.VITE_COLLAB_WS_URL
  return typeof raw === 'string' && raw.length > 0
    ? raw
    : 'http://localhost:3000'
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

export function CollabSync({
  room,
  clientId,
  onRoster,
  onWelcome,
}: {
  room: string
  clientId: string
  onRoster?: (peers: CollabPeerDTO[], count: number) => void
  onWelcome?: (welcome: CollabWelcomePayload) => void
}) {
  const { sandpack, listen } = useSandpack()
  /** Wait for server snapshot before collab-announce (avoids template wiping saves). */
  const [snapshotReady, setSnapshotReady] = useState(false)
  const socketRef = useRef<Socket | null>(null)
  const skipOutbound = useRef(false)
  const debounceTimers = useRef<Map<string, ReturnType<typeof setTimeout>>>(
    new Map(),
  )
  const sandpackRef = useRef(sandpack)
  const lastPresence = useRef({
    file: '',
    anchorLine: 0,
    anchorCol: 0,
    headLine: 0,
    headCol: 0,
  })
  const lastLocalFsTouch = useRef<Map<string, number>>(new Map())
  const onRosterRef = useRef(onRoster)
  const onWelcomeRef = useRef(onWelcome)
  useLayoutEffect(() => {
    sandpackRef.current = sandpack
    onRosterRef.current = onRoster
    onWelcomeRef.current = onWelcome
  }, [sandpack, onRoster, onWelcome])

  useEffect(() => {
    const debounceMap = debounceTimers.current
    let rosterRaf: number | null = null
    const socket = io(collabWsUrl(), {
      transports: ['websocket', 'polling'],
      path: '/socket.io',
    })
    socketRef.current = socket

    const onConnect = () => {
      setSnapshotReady(false)
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

    socket.on('collab-snapshot', (files: Record<string, string>) => {
      skipOutbound.current = true
      const sp = sandpackRef.current
      Object.entries(files).forEach(([path, content]) => {
        lastLocalFsTouch.current.delete(path)
        const cur = getFileCode(sp.files[path])
        if (cur === content) {
          return
        }
        // Avoid wiping local text with stale empty snapshot; real clears use collab-file.
        if (content === '' && cur != null && cur.length > 0) {
          return
        }
        if (
          isStaleShorterPrefix(path, content, cur, lastLocalFsTouch.current)
        ) {
          return
        }
        sp.updateFile(path, content, true)
      })
      skipOutbound.current = false
      setSnapshotReady(true)
    })

    socket.on(
      'collab-file',
      (p: { path: string; content: string; from: string }) => {
        if (p.from === clientId) {
          return
        }
        const cur = getFileCode(sandpackRef.current.files[p.path])
        if (cur === p.content) {
          return
        }
        if (
          isStaleShorterPrefix(p.path, p.content, cur, lastLocalFsTouch.current)
        ) {
          return
        }
        const touched = lastLocalFsTouch.current.get(p.path)
        if (touched != null && Date.now() - touched < REMOTE_FILE_GUARD_MS) {
          return
        }
        skipOutbound.current = true
        sandpackRef.current.updateFile(p.path, p.content, true)
        skipOutbound.current = false
      },
    )

    socket.on('collab-remove', (p: { path: string; from: string }) => {
      if (p.from === clientId) {
        return
      }
      skipOutbound.current = true
      sandpackRef.current.deleteFile(p.path, true)
      skipOutbound.current = false
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
        const { path, content } = message
        lastLocalFsTouch.current.set(path, Date.now())
        const prev = debounceTimers.current.get(path)
        if (prev) {
          clearTimeout(prev)
        }
        debounceTimers.current.set(
          path,
          setTimeout(() => {
            debounceTimers.current.delete(path)
            socketRef.current?.emit('collab-file', {
              room,
              path,
              content,
              from: clientId,
            })
          }, COLLAB_FILE_DEBOUNCE_MS),
        )
      } else if (isFsRemove(message)) {
        socketRef.current?.emit('collab-remove', {
          room,
          path: message.path,
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
    const socket = socketRef.current
    if (!socket?.connected) {
      return
    }
    const sp = sandpackRef.current
    const files: Record<string, string> = {}
    Object.entries(sp.files).forEach(([path, f]) => {
      const code = getFileCode(f)
      if (code !== undefined) {
        files[path] = code
      }
    })
    const t = window.setTimeout(() => {
      if (socket.connected) {
        socket.emit('collab-announce', { room, files })
      }
    }, 400)
    return () => window.clearTimeout(t)
  }, [sandpack.status, room, snapshotReady])

  useEffect(() => {
    lastPresence.current = {
      file: '',
      anchorLine: 0,
      anchorCol: 0,
      headLine: 0,
      headCol: 0,
    }
  }, [sandpack.activeFile])

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

  return null
}
