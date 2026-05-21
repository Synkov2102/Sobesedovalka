import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { io, type Socket } from 'socket.io-client'
import * as Y from 'yjs'
import type {
  CollabPeerDTO,
  CollabWelcomePayload,
} from '../collab/collab.types'
import {
  normalizePeerColorHexWire,
  normalizePeerHueWire,
} from '../collab/peerColor'
import { normalizeSandpackFilePath } from '../collab/sandpackPaths'
import {
  getYFileText,
  getYFilesMap,
  getYFoldersArray,
  readYjsFiles,
  readYjsFolders,
  replaceYArray,
  replaceYText,
} from '../collab/collabYjsModel'
import {
  collabSyncLog,
  collabSyncTextMeta,
  collabSyncWarn,
} from '../collab/collabSyncLog'
import { createYjsSocketProvider } from '../collab/yjsCollabProvider'
import { getAccessToken } from '../auth/tokenStorage'
import {
  CollabPasteContext,
  type CollabPasteEventInput,
} from './collabPasteContext'
import {
  getFoldersForFile,
  normalizeNewFolderPath,
} from './PlaygroundFileExplorer/utils/paths'
import { CollabYDocContext } from '../collab/collabYDocContext'
import { CollabFileSyncContext } from '../collab/collabFileSyncContext'
import { WorkspaceCollabFsBridge } from '../workspace/WorkspaceCollabFsBridge'
import { useWorkspace } from '../workspace/WorkspaceContext'
import { mergeWorkspaceFiles } from '../workspace/workspaceDefaults'
import { readMonacoSelection } from '../workspace/monacoPresence'

type CollabSnapshotPayload = {
  files?: Record<string, string>
  folders?: string[]
}
type CollabFilePayload = {
  path?: string
  content?: string
  from?: string
}

const PAGE_LEAVE_EVENT_COOLDOWN_MS = 5000
const YJS_ORIGIN_FILE_TREE = 'file-tree'
const YJS_ORIGIN_REMOTE_FILE = 'remote'

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
  children,
}: {
  room: string
  clientId: string
  onRoster?: (peers: CollabPeerDTO[], count: number) => void
  onWelcome?: (welcome: CollabWelcomePayload) => void
  children?: ReactNode
}) {
  const workspace = useWorkspace()
  const [docState, setDocState] = useState<Y.Doc | null>(null)
  const [yjsReady, setYjsReady] = useState(false)
  const workspaceRef = useRef(workspace)
  const socketRef = useRef<Socket | null>(null)
  const ydocRef = useRef<Y.Doc | null>(null)
  const yjsSyncedRef = useRef(false)
  const latestSnapshotRef = useRef<{
    files: Record<string, string>
    folders: string[]
  } | null>(null)
  const fileEmitTimersRef = useRef<Map<string, number>>(new Map())
  const onRosterRef = useRef(onRoster)
  const onWelcomeRef = useRef(onWelcome)
  const lastPresence = useRef({
    file: '',
    anchorLine: 0,
    anchorCol: 0,
    headLine: 0,
    headCol: 0,
  })

  useEffect(() => {
    onRosterRef.current = onRoster
    onWelcomeRef.current = onWelcome
    workspaceRef.current = workspace
  }, [onRoster, onWelcome])

  useEffect(() => {
    workspaceRef.current = workspace
  }, [workspace])

  const refreshWorkspaceFromYDoc = useCallback(() => {
    const doc = ydocRef.current
    if (!doc) {
      return
    }
    const files = readYjsFiles(doc)
    const paths = sortPaths(Object.keys(files))
    const folders = normalizeFolderList(paths, readYjsFolders(doc))
    workspaceRef.current.setWorkspaceSnapshot(files, folders)
    collabSyncLog('yjs-model', 'refresh-workspace-from-doc', {
      fileCount: paths.length,
      folderCount: folders.length,
    })
  }, [])

  const seedYDocFromSnapshotIfEmpty = useCallback(() => {
    const doc = ydocRef.current
    const snapshot = latestSnapshotRef.current
    if (!doc || !snapshot || Object.keys(readYjsFiles(doc)).length > 0) {
      return
    }
    const paths = sortPaths(Object.keys(snapshot.files))
    const folders = normalizeFolderList(paths, snapshot.folders)
    doc.transact(() => {
      const yFiles = getYFilesMap(doc)
      for (const [path, content] of Object.entries(snapshot.files)) {
        yFiles.set(path, true)
        replaceYText(getYFileText(doc, path), content)
      }
      replaceYArray(getYFoldersArray(doc), folders)
    }, YJS_ORIGIN_FILE_TREE)
    collabSyncLog('yjs-model', 'seed-doc-from-snapshot', {
      fileCount: paths.length,
      folderCount: folders.length,
    })
  }, [])

  const syncFolders = useCallback(
    (folders: string[], nextFilePaths?: string[]) => {
      const doc = ydocRef.current
      if (!doc) {
        return
      }
      const baseFiles = nextFilePaths ?? workspace.filePaths
      const nextFolders = normalizeFolderList(baseFiles, folders)
      doc.transact(() => {
        replaceYArray(getYFoldersArray(doc), nextFolders)
      }, YJS_ORIGIN_FILE_TREE)
      workspace.syncFolders(nextFolders, baseFiles)
    },
    [workspace],
  )

  const saveFile = useCallback(
    (path: string, content: string) => {
      const normalizedPath = normalizeSandpackFilePath(path)
      const doc = ydocRef.current
      if (!normalizedPath || !doc) {
        return
      }
      if (!yjsSyncedRef.current) {
        collabSyncWarn('editor', 'skip-save-before-yjs-sync', {
          path: normalizedPath,
          ...collabSyncTextMeta(content),
        })
        return
      }
      doc.transact(() => {
        getYFilesMap(doc).set(normalizedPath, true)
        replaceYText(getYFileText(doc, normalizedPath), content)
      }, YJS_ORIGIN_FILE_TREE)
      workspace.updateWorkspaceFile(normalizedPath, content)
      const nextFilePaths = sortPaths([...workspace.filePaths, normalizedPath])
      syncFolders(workspace.folderPaths, nextFilePaths)
    },
    [syncFolders, workspace],
  )

  const removeFile = useCallback(
    (path: string) => {
      const normalizedPath = normalizeSandpackFilePath(path)
      const doc = ydocRef.current
      if (!normalizedPath || !doc) {
        return
      }
      if (!yjsSyncedRef.current) {
        collabSyncWarn('file-tree', 'skip-remove-before-yjs-sync', {
          path: normalizedPath,
        })
        return
      }
      doc.transact(() => {
        getYFilesMap(doc).delete(normalizedPath)
      }, YJS_ORIGIN_FILE_TREE)
      workspace.deleteWorkspaceFile(normalizedPath)
      const nextFilePaths = workspace.filePaths.filter(
        (entry) => entry !== normalizedPath,
      )
      syncFolders(workspace.folderPaths, nextFilePaths)
    },
    [syncFolders, workspace],
  )

  const recordPaste = useCallback(
    (event: CollabPasteEventInput) => {
      const normalizedPath = normalizeSandpackFilePath(event.path)
      if (!normalizedPath || !event.content) {
        collabSyncLog('paste', 'skip-invalid-paste', {
          path: event.path,
          contentLen: event.content?.length ?? 0,
        })
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

  const emitFileChange = useCallback(
    (path: string, content: string) => {
      const normalizedPath = normalizeSandpackFilePath(path)
      const socket = socketRef.current
      if (!normalizedPath || !socket?.connected) {
        return
      }
      const prev = fileEmitTimersRef.current.get(normalizedPath)
      if (prev) {
        window.clearTimeout(prev)
      }
      const timer = window.setTimeout(() => {
        fileEmitTimersRef.current.delete(normalizedPath)
        socket.emit('collab-file', {
          room,
          path: normalizedPath,
          content,
          from: clientId,
        })
      }, 80)
      fileEmitTimersRef.current.set(normalizedPath, timer)
    },
    [clientId, room],
  )

  useEffect(() => {
    const doc = new Y.Doc()
    ydocRef.current = doc
    setDocState(doc)
    let rosterRaf: number | null = null
    const wsUrl = collabWsUrl()
    const socket = io(wsUrl, {
      path: '/socket.io',
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

    const destroyProvider = createYjsSocketProvider({
      doc,
      socket,
      room,
      clientId,
      canEmitUpdate: () => yjsSyncedRef.current && socket.connected,
      onSynced: () => {
        yjsSyncedRef.current = true
        seedYDocFromSnapshotIfEmpty()
        setYjsReady(true)
        refreshWorkspaceFromYDoc()
      },
    })

    const onDocUpdate = () => {
      refreshWorkspaceFromYDoc()
    }
    doc.on('update', onDocUpdate)

    const onConnect = () => {
      collabSyncLog('socket', 'connect', { room, clientId, wsUrl })
      yjsSyncedRef.current = false
      setYjsReady(false)
      socket.emit('collab-join', { room, clientId })
    }
    socket.on('connect', onConnect)
    socket.on('connect_error', (err: Error) => {
      collabSyncWarn('socket', 'connect_error', { message: err.message, wsUrl })
    })
    socket.on('disconnect', (reason: string) => {
      yjsSyncedRef.current = false
      setYjsReady(false)
      collabSyncWarn('socket', 'disconnect', { reason, room })
    })
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
        onWelcomeRef.current?.({
          clientId:
            typeof p.clientId === 'string' && p.clientId.length > 0
              ? p.clientId
              : clientId,
          displayName: p.displayName,
          hue,
          colorHex,
        })
      },
    )

    socket.on(
      'collab-roster',
      (payload: { peers?: CollabPeerDTO[]; count?: number }) => {
        const peers = Array.isArray(payload?.peers) ? payload.peers : []
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
      const merged = mergeWorkspaceFiles(payload.files ?? {})
      latestSnapshotRef.current = {
        files: merged,
        folders: payload.folders ?? [],
      }
      workspaceRef.current.setWorkspaceSnapshot(merged, payload.folders ?? [])
      if (yjsSyncedRef.current) {
        seedYDocFromSnapshotIfEmpty()
        refreshWorkspaceFromYDoc()
      }
      collabSyncLog('snapshot', 'workspace-applied', {
        fileCount: Object.keys(merged).length,
        folderCount: payload.folders?.length ?? 0,
      })
    })

    socket.on('collab-file', (payload: CollabFilePayload) => {
      if (payload?.from === clientId) {
        return
      }
      const path =
        typeof payload?.path === 'string'
          ? normalizeSandpackFilePath(payload.path)
          : ''
      const content =
        typeof payload?.content === 'string' ? payload.content : null
      const currentDoc = ydocRef.current
      if (!path || content === null) {
        return
      }
      if (currentDoc) {
        currentDoc.transact(() => {
          getYFilesMap(currentDoc).set(path, true)
          replaceYText(getYFileText(currentDoc, path), content)
        }, YJS_ORIGIN_REMOTE_FILE)
      }
      workspaceRef.current.updateWorkspaceFile(path, content)
      collabSyncLog('editor', 'receive-file-fallback', {
        path,
        contentLen: content.length,
      })
    })

    return () => {
      if (rosterRaf !== null) {
        cancelAnimationFrame(rosterRaf)
      }
      destroyProvider()
      socket.off('collab-file')
      doc.off('update', onDocUpdate)
      doc.destroy()
      ydocRef.current = null
      setDocState(null)
      setYjsReady(false)
      socket.disconnect()
      socketRef.current = null
      for (const timer of fileEmitTimersRef.current.values()) {
        window.clearTimeout(timer)
      }
      fileEmitTimersRef.current.clear()
    }
  }, [clientId, refreshWorkspaceFromYDoc, room, seedYDocFromSnapshotIfEmpty])

  useEffect(() => {
    lastPresence.current = {
      file: '',
      anchorLine: 0,
      anchorCol: 0,
      headLine: 0,
      headCol: 0,
    }
  }, [workspace.activeFile])

  useEffect(() => {
    const id = window.setInterval(() => {
      const socket = socketRef.current
      if (!socket?.connected) {
        return
      }
      const file = normalizeSandpackFilePath(workspace.activeFile ?? '')
      const sel = readMonacoSelection()
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
  }, [clientId, room, workspace.activeFile])

  useEffect(() => {
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
  }, [clientId, room])

  const pasteContextValue = useMemo(() => ({ recordPaste }), [recordPaste])
  const fileSyncContextValue = useMemo(
    () => ({ emitFileChange }),
    [emitFileChange],
  )
  const ydocContextValue = useMemo(
    () => ({ doc: docState, synced: yjsReady }),
    [docState, yjsReady],
  )

  return (
    <CollabYDocContext.Provider value={ydocContextValue}>
      <WorkspaceCollabFsBridge saveFile={saveFile} removeFile={removeFile}>
        <CollabFileSyncContext.Provider value={fileSyncContextValue}>
          <CollabPasteContext.Provider value={pasteContextValue}>
            {children ?? null}
          </CollabPasteContext.Provider>
        </CollabFileSyncContext.Provider>
      </WorkspaceCollabFsBridge>
    </CollabYDocContext.Provider>
  )
}

