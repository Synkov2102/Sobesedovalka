import { normalizeSandpackFilePath } from './sandpackPaths'

export const MAX_COLLAB_FILE_BYTES = 600_000
export const MAX_COLLAB_PATH_LEN = 256
const MAX_COLLAB_CLIENT_ID_LEN = 64
const CLIENT_ID_RE = /^[a-zA-Z0-9_-]{8,64}$/

export type CollabFileRejectReason =
  | 'invalid-wire'
  | 'empty-path'
  | 'unsafe-path'
  | 'invalid-from'
  | 'self-echo'
  | 'content-too-large'
  | 'stale-rev'
  | 'unchanged'
  | 'stale-shorter-prefix'
  | 'local-dirty'

export type RemoteFileWire = {
  path?: unknown
  content?: unknown
  from?: unknown
  rev?: unknown
}

export type RemoteRemoveWire = {
  path?: unknown
  from?: unknown
  rev?: unknown
}

export type RemoteFilePayload = {
  path: string
  content: string
  from: string
  rev?: number
}

export function normalizeCollabClientId(raw: string): string | null {
  const id = raw.trim()
  if (!id || id.length > MAX_COLLAB_CLIENT_ID_LEN) {
    return null
  }
  if (!CLIENT_ID_RE.test(id)) {
    return null
  }
  return id
}

export function isSafeSandpackPath(normalized: string): boolean {
  if (!normalized.startsWith('/')) {
    return false
  }
  if (normalized.length > MAX_COLLAB_PATH_LEN) {
    return false
  }
  if (normalized.includes('\0') || normalized.includes('..')) {
    return false
  }
  const inner = normalized.slice(1)
  if (!inner || inner.includes('//')) {
    return false
  }
  const segments = inner.split('/')
  return segments.every(
    (segment) => segment.length > 0 && segment !== '.' && segment !== '..',
  )
}

export function parseCollabFilePath(raw: string): string | null {
  const path = normalizeSandpackFilePath(raw)
  if (!path || !isSafeSandpackPath(path)) {
    return null
  }
  return path
}

export function parseRemoteFileWire(
  wire: RemoteFileWire,
): { ok: true; value: RemoteFilePayload } | { ok: false; reason: CollabFileRejectReason } {
  if (typeof wire.path !== 'string' || typeof wire.content !== 'string') {
    return { ok: false, reason: 'invalid-wire' }
  }
  if (wire.content.length > MAX_COLLAB_FILE_BYTES) {
    return { ok: false, reason: 'content-too-large' }
  }
  const path = parseCollabFilePath(wire.path)
  if (!path) {
    return {
      ok: false,
      reason: typeof wire.path === 'string' && wire.path.trim() ? 'unsafe-path' : 'empty-path',
    }
  }
  const from =
    typeof wire.from === 'string' ? normalizeCollabClientId(wire.from) : null
  if (!from) {
    return { ok: false, reason: 'invalid-from' }
  }
  let rev: number | undefined
  if (wire.rev !== undefined && wire.rev !== null) {
    if (typeof wire.rev !== 'number' || !Number.isFinite(wire.rev)) {
      return { ok: false, reason: 'invalid-wire' }
    }
    rev = Math.floor(wire.rev)
    if (rev < 1) {
      return { ok: false, reason: 'invalid-wire' }
    }
  }
  return { ok: true, value: { path, content: wire.content, from, rev } }
}

export function isStaleShorterPrefix(
  incoming: string,
  current: string | undefined,
): boolean {
  if (current == null || current.length <= incoming.length) {
    return false
  }
  return current.startsWith(incoming)
}

export function isStaleRevision(
  incomingRev: number | undefined,
  currentRev: number,
): boolean {
  if (incomingRev === undefined) {
    return false
  }
  return Math.floor(incomingRev) <= currentRev
}

export function validateOutboundFile(args: {
  path: string
  content: string
  clientId: string
}):
  | { ok: true; path: string; content: string; from: string }
  | { ok: false; reason: CollabFileRejectReason } {
  const from = normalizeCollabClientId(args.clientId)
  if (!from) {
    return { ok: false, reason: 'invalid-from' }
  }
  const path = parseCollabFilePath(args.path)
  if (!path) {
    return { ok: false, reason: 'unsafe-path' }
  }
  if (args.content.length > MAX_COLLAB_FILE_BYTES) {
    return { ok: false, reason: 'content-too-large' }
  }
  return { ok: true, path, content: args.content, from }
}

export type InboundFileDecision =
  | { action: 'skip'; reason: CollabFileRejectReason }
  | { action: 'queue'; reason: 'local-dirty'; payload: RemoteFilePayload }
  | { action: 'apply'; payload: RemoteFilePayload }

export function decideInboundFileUpdate(args: {
  payload: RemoteFilePayload
  selfClientId: string
  currentRev: number
  currentContent: string
  emittedContent: string | undefined
  isLocalDirty: boolean
}): InboundFileDecision {
  if (args.payload.from === args.selfClientId) {
    return { action: 'skip', reason: 'self-echo' }
  }

  if (isStaleRevision(args.payload.rev, args.currentRev)) {
    return { action: 'skip', reason: 'stale-rev' }
  }

  if (args.isLocalDirty) {
    if (args.currentContent === args.payload.content) {
      return { action: 'skip', reason: 'unchanged' }
    }
    if (isStaleShorterPrefix(args.payload.content, args.currentContent)) {
      return { action: 'skip', reason: 'stale-shorter-prefix' }
    }
    return { action: 'queue', reason: 'local-dirty', payload: args.payload }
  }

  const baseline = args.emittedContent
  if (baseline !== undefined && baseline === args.payload.content) {
    return { action: 'skip', reason: 'unchanged' }
  }

  if (args.currentContent === args.payload.content) {
    return { action: 'skip', reason: 'unchanged' }
  }

  return { action: 'apply', payload: args.payload }
}

export function parseRemoteRemoveWire(
  wire: RemoteRemoveWire,
):
  | { ok: true; value: { path: string; from: string; rev?: number } }
  | { ok: false; reason: CollabFileRejectReason } {
  if (typeof wire.path !== 'string') {
    return { ok: false, reason: 'invalid-wire' }
  }
  const path = parseCollabFilePath(wire.path)
  if (!path) {
    return { ok: false, reason: 'unsafe-path' }
  }
  const from =
    typeof wire.from === 'string' ? normalizeCollabClientId(wire.from) : null
  if (!from) {
    return { ok: false, reason: 'invalid-from' }
  }
  let rev: number | undefined
  if (wire.rev !== undefined && wire.rev !== null) {
    if (typeof wire.rev !== 'number' || !Number.isFinite(wire.rev)) {
      return { ok: false, reason: 'invalid-wire' }
    }
    rev = Math.floor(wire.rev)
    if (rev < 1) {
      return { ok: false, reason: 'invalid-wire' }
    }
  }
  return { ok: true, value: { path, from, rev } }
}

export function validateOutboundRemove(args: {
  path: string
  clientId: string
}):
  | { ok: true; path: string; from: string }
  | { ok: false; reason: CollabFileRejectReason } {
  const from = normalizeCollabClientId(args.clientId)
  if (!from) {
    return { ok: false, reason: 'invalid-from' }
  }
  const path = parseCollabFilePath(args.path)
  if (!path) {
    return { ok: false, reason: 'unsafe-path' }
  }
  return { ok: true, path, from }
}
