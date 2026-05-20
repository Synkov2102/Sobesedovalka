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
  syncYTextToContent,
} from '../collab/collabYjsModel'
import {
  collabSyncLog,
  collabSyncTextMeta,
  collabSyncWarn,
} from '../collab/collabSyncLog'
import { createYjsSocketProvider } from '../collab/yjsCollabProvider'
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
import { setSandpackYjsBindingProvider } from '../collab/sandpackYjsBinding'

type FsChange = { type: 'fs/change'; path: string; content: string }
type FsRemove = { type: 'fs/remove'; path: string }
type CollabSnapshotPayload = {
  files?: Record<string, string>
  folders?: string[]
}

const PAGE_LEAVE_EVENT_COOLDOWN_MS = 5000
const SANDPACK_APPLY_SUPPRESS_MS = 250
const EDITOR_FS_CHANGE_IGNORE_MS = 2000
const YJS_ORIGIN_EDITOR = 'editor'
const YJS_ORIGIN_FILE_TREE = 'file-tree'
const YJS_ORIGIN_SANDPACK_FS = 'sandpack-fs'

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
  requestProviderBoot?: (merged: Record<string, string>) => boolean
  children?: ReactNode
}) {
  const { sandpack, listen } = useSandpack()
  const [snapshotReady, setSnapshotReady] = useState(false)
  const [filePaths, setFilePaths] = useState<string[]>([])
  const [folderPaths, setFolderPaths] = useState<string[]>([])
  const socketRef = useRef<Socket | null>(null)
  const ydocRef = useRef<Y.Doc | null>(null)
  const yjsSyncedRef = useRef(false)
  const skipOutbound = useRef(false)
  const suppressSandpackUntil = useRef<Map<string, number>>(new Map())
  const recentEditorChangeUntil = useRef<Map<string, number>>(new Map())
  const sandpackRef = useRef(sandpack)
  const filePathsRef = useRef<string[]>([])
  const folderPathsRef = useRef<string[]>([])
  const sandpackSyncedPathsRef = useRef<string[]>([])
  const onRosterRef = useRef(onRoster)
  const onWelcomeRef = useRef(onWelcome)
  const requestProviderBootRef = useRef(requestProviderBoot)
  const lastPresence = useRef({
    file: '',
    anchorLine: 0,
    anchorCol: 0,
    headLine: 0,
    headCol: 0,
  })

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

  useLayoutEffect(() => {
    collabSyncLog('yjs-binding', 'register-active-provider', { room, clientId })
    setSandpackYjsBindingProvider(() => {
      const doc = ydocRef.current
      const path = normalizeSandpackFilePath(
        sandpackRef.current.activeFile ?? '',
      )
      if (!doc || !path) {
        collabSyncLog('yjs-binding', 'provider-empty', {
          hasDoc: Boolean(doc),
          activeFile: sandpackRef.current.activeFile ?? '',
        })
        return null
      }
      return {
        path,
        yText: getYFileText(doc, path),
        transact: (apply) => {
          doc.transact(apply, YJS_ORIGIN_EDITOR)
        },
        shouldIgnore: () => {
          const suppressUntil = suppressSandpackUntil.current.get(path) ?? 0
          const ignored =
            !yjsSyncedRef.current ||
            skipOutbound.current ||
            Date.now() < suppressUntil
          if (ignored) {
            collabSyncLog('yjs-binding', 'ignore-editor-update', {
              path,
              yjsSynced: yjsSyncedRef.current,
              skipOutbound: skipOutbound.current,
              suppressMsLeft: Math.max(0, suppressUntil - Date.now()),
            })
          }
          return ignored
        },
        onLocalChange: ({ insertedChars, deletedChars, changeCount }) => {
          recentEditorChangeUntil.current.set(
            path,
            Date.now() + EDITOR_FS_CHANGE_IGNORE_MS,
          )
          collabSyncLog('yjs-binding', 'mark-recent-editor-change', {
            path,
            insertedChars,
            deletedChars,
            changeCount,
            ignoreMs: EDITOR_FS_CHANGE_IGNORE_MS,
          })
        },
      }
    })
    return () => {
      collabSyncLog('yjs-binding', 'unregister-active-provider', {
        room,
        clientId,
      })
      setSandpackYjsBindingProvider(null)
    }
  }, [clientId, room])

  const refreshFromYDoc = useCallback(() => {
    const doc = ydocRef.current
    if (!doc) {
      return
    }
    const files = readYjsFiles(doc)
    const nextFilePaths = sortPaths(Object.keys(files))
    const nextFolders = normalizeFolderList(nextFilePaths, readYjsFolders(doc))
    collabSyncLog('yjs-model', 'refresh-from-doc', {
      fileCount: nextFilePaths.length,
      folderCount: nextFolders.length,
      activeFile: sandpackRef.current.activeFile ?? '',
    })
    filePathsRef.current = nextFilePaths
    folderPathsRef.current = nextFolders
    setFilePaths(nextFilePaths)
    setFolderPaths(nextFolders)
  }, [])

  const applyYDocToSandpack = useCallback(() => {
    const doc = ydocRef.current
    if (!doc || sandpackRef.current.status !== 'running') {
      collabSyncLog('sandpack-apply', 'skip-not-ready', {
        hasDoc: Boolean(doc),
        status: sandpackRef.current.status,
      })
      return
    }
    const files = readYjsFiles(doc)
    const nextPaths = sortPaths(Object.keys(files))
    let touchedPath: string | null = null

    skipOutbound.current = true
    collabSyncLog('sandpack-apply', 'start', {
      fileCount: nextPaths.length,
      previousSyncedCount: sandpackSyncedPathsRef.current.length,
      activeFile: sandpackRef.current.activeFile ?? '',
    })
    for (const [path, content] of Object.entries(files)) {
      const currentContent = readSandpackFileCode(
        sandpackRef.current.files[path],
      )
      if (currentContent !== content) {
        collabSyncLog('sandpack-apply', 'update-file', {
          path,
          currentLen: currentContent?.length ?? 0,
          nextLen: content.length,
        })
        suppressSandpackUntil.current.set(
          path,
          Date.now() + SANDPACK_APPLY_SUPPRESS_MS,
        )
        sandpackRef.current.updateFile(path, content, false)
        touchedPath = path
      }
    }

    for (const previous of sandpackSyncedPathsRef.current) {
      if (!files[previous] && sandpackRef.current.files[previous]) {
        collabSyncLog('sandpack-apply', 'delete-file', { path: previous })
        suppressSandpackUntil.current.set(
          previous,
          Date.now() + SANDPACK_APPLY_SUPPRESS_MS,
        )
        sandpackRef.current.deleteFile(previous, false)
        touchedPath = previous
      }
    }
    sandpackSyncedPathsRef.current = nextPaths

    const active = normalizeSandpackFilePath(
      sandpackRef.current.activeFile ?? '',
    )
    if (nextPaths.length > 0 && !files[active]) {
      collabSyncLog('sandpack-apply', 'open-first-file', {
        previousActive: active,
        nextActive: nextPaths[0],
      })
      sandpackRef.current.openFile(nextPaths[0])
    }
    skipOutbound.current = false

    if (touchedPath) {
      const recompilePath = files[touchedPath] ? touchedPath : nextPaths[0]
      if (recompilePath && files[recompilePath] !== undefined) {
        collabSyncLog('sandpack-apply', 'trigger-recompile-file', {
          path: recompilePath,
        })
        sandpackRef.current.updateFile(
          recompilePath,
          files[recompilePath],
          true,
        )
      } else {
        collabSyncLog('sandpack-apply', 'trigger-run-sandpack')
        void sandpackRef.current.runSandpack()
      }
    }
    collabSyncLog('sandpack-apply', 'done', {
      touched: Boolean(touchedPath),
      touchedPath,
      syncedCount: nextPaths.length,
    })
    refreshFromYDoc()
  }, [refreshFromYDoc])

  const syncFolders = useCallback(
    (folders: string[], nextFilePaths?: string[]) => {
      const doc = ydocRef.current
      if (!doc) {
        return
      }
      const baseFiles = nextFilePaths ?? filePathsRef.current
      const nextFolders = normalizeFolderList(baseFiles, folders)
      doc.transact(() => {
        replaceYArray(getYFoldersArray(doc), nextFolders)
      }, YJS_ORIGIN_FILE_TREE)
      collabSyncLog('file-tree', 'sync-folders', {
        requestedCount: folders.length,
        nextCount: nextFolders.length,
        fileCount: baseFiles.length,
      })
      folderPathsRef.current = nextFolders
      setFolderPaths(nextFolders)
    },
    [],
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
      const nextFilePaths = sortPaths([...filePathsRef.current, normalizedPath])
      filePathsRef.current = nextFilePaths
      setFilePaths(nextFilePaths)
      syncFolders(folderPathsRef.current, nextFilePaths)
      collabSyncLog('editor', 'save-file-yjs', {
        path: normalizedPath,
        ...collabSyncTextMeta(content),
      })
    },
    [syncFolders],
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
      collabSyncLog('file-tree', 'remove-file-yjs', { path: normalizedPath })
      const nextFilePaths = filePathsRef.current.filter(
        (entry) => entry !== normalizedPath,
      )
      filePathsRef.current = nextFilePaths
      setFilePaths(nextFilePaths)
      syncFolders(folderPathsRef.current, nextFilePaths)
    },
    [syncFolders],
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
      collabSyncLog('paste', 'emit-paste', {
        path: normalizedPath,
        contentLen: event.content.length,
        line: event.line,
        col: event.col,
      })
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

  useEffect(() => {
    const doc = new Y.Doc()
    ydocRef.current = doc
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
        collabSyncLog('yjs-provider', 'on-synced-callback', {
          room,
          clientId,
        })
        yjsSyncedRef.current = true
        setSnapshotReady(true)
        refreshFromYDoc()
        applyYDocToSandpack()
      },
    })

    const onDocUpdate = (_update: Uint8Array, origin: unknown) => {
      const originName = typeof origin === 'string' ? origin : typeof origin
      collabSyncLog('yjs-model', 'doc-update-observed', {
        room,
        clientId,
        origin: originName,
      })
      refreshFromYDoc()
      if (
        origin === YJS_ORIGIN_EDITOR ||
        origin === YJS_ORIGIN_SANDPACK_FS ||
        origin === YJS_ORIGIN_FILE_TREE
      ) {
        collabSyncLog('sandpack-apply', 'skip-local-origin', {
          origin: originName,
        })
        return
      }
      applyYDocToSandpack()
    }
    doc.on('update', onDocUpdate)

    const onConnect = () => {
      collabSyncLog('socket', 'connect', { room, clientId, wsUrl })
      yjsSyncedRef.current = false
      setSnapshotReady(false)
      socket.emit('collab-join', { room, clientId })
    }
    socket.on('connect', onConnect)
    socket.on('connect_error', (err: Error) => {
      collabSyncWarn('socket', 'connect_error', {
        message: err.message,
        wsUrl,
      })
    })
    socket.on('disconnect', (reason: string) => {
      yjsSyncedRef.current = false
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
          collabSyncWarn('socket', 'welcome-invalid', {
            reason: 'missing-display-name',
          })
          return
        }
        const hue = normalizePeerHueWire(p.hue)
        const colorHex = normalizePeerColorHexWire(p.colorHex)
        if (hue === undefined || colorHex === undefined) {
          collabSyncWarn('socket', 'welcome-invalid', {
            reason: 'invalid-color',
            hue: p.hue,
            colorHex: p.colorHex,
          })
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
        collabSyncLog('socket', 'welcome', {
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
        collabSyncLog('presence', 'roster-received', {
          peerCount: peers.length,
          count,
        })
        rosterRaf = requestAnimationFrame(() => {
          rosterRaf = null
          onRosterRef.current?.(peers, count)
        })
      },
    )

    socket.on('collab-snapshot', (payload: CollabSnapshotPayload) => {
      collabSyncLog('snapshot', 'received', {
        fileCount: Object.keys(payload.files ?? {}).length,
        folderCount: payload.folders?.length ?? 0,
        previousSyncedCount: sandpackSyncedPathsRef.current.length,
      })
      const result = handleCollabSnapshot({
        payload,
        sandpack: sandpackRef.current,
        previousSyncedPaths: sandpackSyncedPathsRef.current,
        requestProviderBoot: requestProviderBootRef.current,
      })
      if (result.skippedSandpackApply) {
        collabSyncLog('snapshot', 'provider-boot-skipped-apply', {
          mergedCount: Object.keys(result.merged).length,
        })
        return
      }
      collabSyncLog('snapshot', 'applied', {
        mergedCount: Object.keys(result.merged).length,
        explorerCount: result.explorerPaths.length,
        syncCount: result.syncPaths.length,
      })
      refreshFromYDoc()
    })

    return () => {
      if (rosterRaf !== null) {
        cancelAnimationFrame(rosterRaf)
      }
      destroyProvider()
      doc.off('update', onDocUpdate)
      doc.destroy()
      ydocRef.current = null
      socket.disconnect()
      socketRef.current = null
    }
  }, [applyYDocToSandpack, clientId, refreshFromYDoc, room])

  useEffect(() => {
    if (sandpack.status !== 'running') {
      return
    }
    const unsub = listen((message) => {
      if (skipOutbound.current) {
        collabSyncLog('sandpack-listen', 'skip-outbound-global', {
          type:
            typeof message === 'object' && message !== null
              ? (message as { type?: unknown }).type
              : typeof message,
        })
        return
      }
      if (isFsChange(message)) {
        const normalizedPath = normalizeSandpackFilePath(message.path)
        const doc = ydocRef.current
        if (!normalizedPath || !doc) {
          collabSyncLog('sandpack-listen', 'skip-change-invalid', {
            path: message.path,
            hasDoc: Boolean(doc),
          })
          return
        }
        const activePath = normalizeSandpackFilePath(
          sandpackRef.current.activeFile ?? '',
        )
        const recentEditorUntil =
          recentEditorChangeUntil.current.get(normalizedPath) ?? 0
        if (normalizedPath === activePath) {
          collabSyncLog('sandpack-listen', 'skip-active-file-fs-change', {
            path: normalizedPath,
            activeFile: activePath,
            ...collabSyncTextMeta(message.content),
          })
          return
        }
        if (Date.now() < recentEditorUntil) {
          collabSyncLog(
            'sandpack-listen',
            'skip-recent-editor-file-fs-change',
            {
              path: normalizedPath,
              msLeft: Math.max(0, recentEditorUntil - Date.now()),
              ...collabSyncTextMeta(message.content),
            },
          )
          return
        }
        if (!yjsSyncedRef.current) {
          collabSyncWarn('sandpack-listen', 'skip-change-before-yjs-sync', {
            path: normalizedPath,
            ...collabSyncTextMeta(message.content),
          })
          return
        }
        const suppressUntil =
          suppressSandpackUntil.current.get(normalizedPath) ?? 0
        if (Date.now() < suppressUntil) {
          collabSyncLog('sandpack-listen', 'skip-change-suppressed', {
            path: normalizedPath,
            suppressMsLeft: Math.max(0, suppressUntil - Date.now()),
            ...collabSyncTextMeta(message.content),
          })
          return
        }
        const yText = getYFileText(doc, normalizedPath)
        const yFiles = getYFilesMap(doc)
        const yTextContent = yText.toJSON()
        if (yFiles.has(normalizedPath) && yTextContent === message.content) {
          collabSyncLog('sandpack-listen', 'skip-change-yjs-already-matches', {
            path: normalizedPath,
            ...collabSyncTextMeta(message.content),
          })
          return
        }
        collabSyncLog('sandpack-listen', 'fs-change-to-yjs', {
          path: normalizedPath,
          currentYTextLen: yText.length,
          ...collabSyncTextMeta(message.content),
        })
        doc.transact(() => {
          yFiles.set(normalizedPath, true)
          syncYTextToContent(yText, message.content)
        }, YJS_ORIGIN_SANDPACK_FS)
      } else if (isFsRemove(message)) {
        const normalizedPath = normalizeSandpackFilePath(message.path)
        const doc = ydocRef.current
        if (!normalizedPath || !doc) {
          collabSyncLog('sandpack-listen', 'skip-remove-invalid', {
            path: message.path,
            hasDoc: Boolean(doc),
          })
          return
        }
        if (!yjsSyncedRef.current) {
          collabSyncWarn('sandpack-listen', 'skip-remove-before-yjs-sync', {
            path: normalizedPath,
          })
          return
        }
        collabSyncLog('sandpack-listen', 'fs-remove-to-yjs', {
          path: normalizedPath,
        })
        doc.transact(() => {
          getYFilesMap(doc).delete(normalizedPath)
        }, YJS_ORIGIN_SANDPACK_FS)
      }
    })
    applyYDocToSandpack()
    return unsub
  }, [applyYDocToSandpack, listen, sandpack.status])

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
      collabSyncLog('presence', 'emit', {
        file,
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
      collabSyncLog('presence', 'page-leave', { room, clientId })
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
