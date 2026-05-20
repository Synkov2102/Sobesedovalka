import type { Socket } from 'socket.io-client'
import * as Y from 'yjs'
import { collabSyncLog, collabSyncWarn } from './collabSyncLog'

type YjsUpdateWire = {
  update?: unknown
}

export function createYjsSocketProvider(args: {
  doc: Y.Doc
  socket: Socket
  room: string
  clientId: string
  canEmitUpdate?: () => boolean
  onSynced?: () => void
}): () => void {
  const { doc, socket, room, clientId, canEmitUpdate, onSynced } = args

  const onDocUpdate = (update: Uint8Array, origin: unknown) => {
    if (origin === 'remote') {
      collabSyncLog('yjs-provider', 'skip-remote-echo', {
        room,
        clientId,
        updateBytes: update.length,
      })
      return
    }
    if (!socket.connected || canEmitUpdate?.() === false) {
      collabSyncWarn('yjs-provider', 'skip-local-update-not-ready', {
        room,
        clientId,
        updateBytes: update.length,
        socketConnected: socket.connected,
        canEmitUpdate: canEmitUpdate?.() ?? true,
        origin: typeof origin === 'string' ? origin : typeof origin,
      })
      return
    }
    collabSyncLog('yjs-provider', 'emit-update', {
      room,
      clientId,
      updateBytes: update.length,
      origin: typeof origin === 'string' ? origin : typeof origin,
    })
    socket.emit('collab-yjs-update', {
      room,
      clientId,
      update: Array.from(update),
    })
  }

  const applyWireUpdate = (wire: YjsUpdateWire, synced: boolean) => {
    const update = normalizeUpdate(wire?.update)
    if (!update) {
      collabSyncWarn('yjs-provider', 'reject-invalid-update', {
        room,
        clientId,
        synced,
        wireType: typeof wire?.update,
      })
      return
    }
    collabSyncLog('yjs-provider', synced ? 'receive-sync' : 'receive-update', {
      room,
      clientId,
      updateBytes: update.length,
    })
    Y.applyUpdate(doc, update, 'remote')
    if (synced) {
      collabSyncLog('yjs-provider', 'synced', { room, clientId })
      onSynced?.()
    }
  }

  const onSync = (wire: YjsUpdateWire) => applyWireUpdate(wire, true)
  const onUpdate = (wire: YjsUpdateWire) => applyWireUpdate(wire, false)

  doc.on('update', onDocUpdate)
  socket.on('collab-yjs-sync', onSync)
  socket.on('collab-yjs-update', onUpdate)

  return () => {
    collabSyncLog('yjs-provider', 'destroy', { room, clientId })
    doc.off('update', onDocUpdate)
    socket.off('collab-yjs-sync', onSync)
    socket.off('collab-yjs-update', onUpdate)
  }
}

function normalizeUpdate(raw: unknown): Uint8Array | null {
  if (raw instanceof Uint8Array) {
    return raw
  }
  if (Array.isArray(raw) && raw.every((n) => Number.isInteger(n))) {
    return Uint8Array.from(raw)
  }
  return null
}
