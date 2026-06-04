import { Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import * as Y from 'yjs';
import {
  hueFromClientId,
  normHue,
  pickHueUniqueInRoom,
  syncPeerPresenceColors,
} from './collab-color';
import {
  isStoredFileContentUnchanged,
  normalizeCollabClientId,
  parseCollabFilePath,
  parseCollabFileUpdate,
} from './collab-file-guard';
import { normalizeSandpackFilePath } from './sandpack-paths';
import {
  mergeWithDefaultSandboxFiles,
  sandboxFilesNeedPersist,
} from './sandbox-files';
import { randomDisplayName } from './collab-names';
import { corsCredentialsFromEnv, corsOriginFromEnv } from '../cors-env';
import { UsersRepository } from '../auth/users.repository';
import { CollabMongoRepository } from './collab-mongo.repository';
import { collabPublicDisplayName } from './collab-user-display';
import type { RoomPeer } from './collab.types';

type CollabSnapshot = {
  files: Record<string, string>;
  folders: string[];
};

type CollabYjsUpdateWire = {
  room?: string;
  clientId?: string;
  update?: unknown;
};

function normalizeFolderPath(path: string): string {
  const normalized = path.trim().replace(/\\/g, '/');
  if (!normalized) {
    return '/';
  }
  const trimmed = normalized.replace(/^\/+/, '').replace(/\/+$/, '');
  if (!trimmed) {
    return '/';
  }
  return `/${trimmed}`;
}

function deriveFolderPaths(
  files: Record<string, string>,
  folders: Iterable<string>,
): string[] {
  const out = new Set<string>();

  for (const rawFolder of folders) {
    const folderPath = normalizeFolderPath(rawFolder);
    if (folderPath !== '/') {
      out.add(folderPath);
    }
  }

  for (const filePath of Object.keys(files)) {
    const parts = normalizeSandpackFilePath(filePath)
      .replace(/^\/+/, '')
      .split('/')
      .filter(Boolean);
    if (parts.length <= 1) {
      continue;
    }
    for (let i = 0; i < parts.length - 1; i += 1) {
      out.add(`/${parts.slice(0, i + 1).join('/')}`);
    }
  }

  return Array.from(out).sort((a, b) => a.localeCompare(b));
}

const Y_FILES_MAP = 'files';
const Y_FOLDERS_ARRAY = 'folders';

function yTextName(path: string): string {
  return `file:${path}`;
}

/** Collab files + roster: MongoDB only (see `MONGODB_URI`). */
@WebSocketGateway({
  cors: {
    origin: corsOriginFromEnv(),
    credentials: corsCredentialsFromEnv(),
  },
})
export class CollabGateway implements OnGatewayDisconnect {
  private readonly logger = new Logger(CollabGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(
    private readonly mongoRepo: CollabMongoRepository,
    private readonly jwt: JwtService,
    private readonly users: UsersRepository,
  ) {}

  private readonly roomFiles = new Map<string, Map<string, string>>();
  /** room -> path -> monotonic revision (also tombstone for removed files) */
  private readonly roomFileRevisions = new Map<string, Map<string, number>>();
  private readonly roomFolders = new Map<string, Set<string>>();
  /** room -> clientId -> peer */
  private readonly roomPeers = new Map<string, Map<string, RoomPeer>>();
  /** socket.id -> { room, clientId } */
  private readonly socketMeta = new Map<
    string,
    { room: string; clientId: string }
  >();
  private readonly lastRosterPayload = new Map<string, string>();
  private readonly lastPresenceRosterAt = new Map<string, number>();
  /** `${room}:${clientId}` -> last Mongo page-leave insert */
  private readonly lastPageLeaveMongoAt = new Map<string, number>();
  private static readonly PAGE_LEAVE_MONGO_COOLDOWN_MS = 5000;
  private readonly filePersistTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();
  private readonly roomYDocs = new Map<string, Y.Doc>();
  private readonly yjsPersistTimers = new Map<
    string,
    ReturnType<typeof setTimeout>
  >();

  private static readonly PRESENCE_ROSTER_THROTTLE_MS = 80;
  private static readonly FILE_PERSIST_DEBOUNCE_MS = 750;
  private static readonly YJS_PERSIST_DEBOUNCE_MS = 750;

  /** Same logical client can have several sockets (reconnect, React StrictMode). */
  private socketCountForClient(room: string, clientId: string): number {
    let n = 0;
    for (const m of this.socketMeta.values()) {
      if (m.room === room && m.clientId === clientId) {
        n++;
      }
    }
    return n;
  }

  handleDisconnect(client: Socket): void {
    const meta = this.socketMeta.get(client.id);
    if (!meta) {
      return;
    }
    this.socketMeta.delete(client.id);
    const { room, clientId } = meta;

    if (this.socketCountForClient(room, clientId) === 0) {
      this.roomPeers.get(room)?.delete(clientId);
      void this.mongoRepo
        .deletePeer(room, clientId)
        .catch((e: unknown) => this.logger.warn(String(e)));
      if (this.roomPeers.get(room)?.size === 0) {
        this.roomPeers.delete(room);
        this.lastRosterPayload.delete(room);
        this.roomFileRevisions.delete(room);
        this.flushYjsPersist(room, 'last-peer-disconnect');
        this.roomYDocs.get(room)?.destroy();
        this.roomYDocs.delete(room);
      }
    }

    this.broadcastRoster(room);
  }

  @SubscribeMessage('collab-join')
  async handleJoin(
    @MessageBody() body: { room?: string; clientId?: string },
    @ConnectedSocket() client: Socket,
  ): Promise<void> {
    const room = typeof body?.room === 'string' ? body.room : '';
    const clientId = typeof body?.clientId === 'string' ? body.clientId : '';
    if (!room || !clientId) {
      return;
    }

    const authDisplayName = await this.resolveAuthDisplayName(client);

    await this.ensureRoomHydrated(room);
    void client.join(room);
    this.socketMeta.set(client.id, { room, clientId });

    if (!this.roomPeers.has(room)) {
      this.roomPeers.set(room, new Map());
    }
    const peers = this.roomPeers.get(room)!;
    let peer = peers.get(clientId);
    if (!peer) {
      const restored = await this.mongoRepo.loadPeer(room, clientId);
      if (restored) {
        peer = restored;
        peers.set(clientId, peer);
      }
    }

    if (!peer) {
      const used = this.collectRoomHueSet(room);
      peer = {
        displayName: authDisplayName ?? randomDisplayName(),
        activeFile: '',
        hue: pickHueUniqueInRoom(used, clientId),
        anchorLine: 1,
        anchorCol: 1,
        headLine: 1,
        headCol: 1,
      };
      peers.set(clientId, peer);
    } else {
      const used = this.collectRoomHueSet(room, clientId);
      const h = peer.hue != null ? normHue(peer.hue) : null;
      if (h == null || used.has(h)) {
        peer.hue = pickHueUniqueInRoom(used, clientId);
      }
      if (authDisplayName) {
        peer.displayName = authDisplayName;
      }
    }

    syncPeerPresenceColors(peer, clientId);

    await this.mongoRepo.ensureRoom(room);
    await this.mongoRepo.savePeer(room, clientId, peer);

    client.emit('collab-welcome', {
      clientId,
      displayName: peer.displayName,
      hue: peer.hue as number,
      colorHex: peer.colorHex as string,
    });
    const snap = this.snapshot(room);
    this.syncLog('join-snapshot', {
      room,
      clientId,
      fileCount: Object.keys(snap.files).length,
      folderCount: snap.folders.length,
    });
    client.emit('collab-snapshot', snap);
    const yjsState = Y.encodeStateAsUpdate(this.ensureRoomYDoc(room));
    this.syncLog('join-yjs-sync', {
      room,
      clientId,
      updateBytes: yjsState.length,
      fileCount:
        this.roomYDocs.get(room)?.getMap<boolean>(Y_FILES_MAP).size ?? 0,
      folderCount:
        this.roomYDocs.get(room)?.getArray<string>(Y_FOLDERS_ARRAY).length ?? 0,
    });
    client.emit('collab-yjs-sync', {
      update: Array.from(yjsState),
    });
    this.broadcastRoster(room);
  }

  private syncLog(
    event: string,
    detail: Record<string, string | number | boolean>,
  ): void {
    this.logger.log(`[collab-sync] ${event} ${JSON.stringify(detail)}`);
  }

  @SubscribeMessage('collab-presence')
  handlePresence(
    @MessageBody()
    body: {
      room?: string;
      clientId?: string;
      activeFile?: string;
      /** Legacy: caret when anchor/head omitted */
      line?: number;
      col?: number;
      anchorLine?: number;
      anchorCol?: number;
      headLine?: number;
      headCol?: number;
    },
  ): void {
    const room = typeof body?.room === 'string' ? body.room : '';
    const clientId = typeof body?.clientId === 'string' ? body.clientId : '';
    if (!room || !clientId) {
      return;
    }
    const peer = this.roomPeers.get(room)?.get(clientId);
    if (!peer) {
      return;
    }
    if (typeof body.activeFile === 'string') {
      peer.activeFile = normalizeSandpackFilePath(body.activeFile);
    }

    if (
      typeof body.headLine === 'number' &&
      Number.isFinite(body.headLine) &&
      typeof body.headCol === 'number' &&
      Number.isFinite(body.headCol)
    ) {
      peer.headLine = Math.max(1, Math.floor(body.headLine));
      peer.headCol = Math.max(1, Math.floor(body.headCol));
    } else if (typeof body.line === 'number' && Number.isFinite(body.line)) {
      peer.headLine = Math.max(1, Math.floor(body.line));
      peer.headCol =
        typeof body.col === 'number' && Number.isFinite(body.col)
          ? Math.max(1, Math.floor(body.col))
          : 1;
    }

    if (
      typeof body.anchorLine === 'number' &&
      Number.isFinite(body.anchorLine) &&
      typeof body.anchorCol === 'number' &&
      Number.isFinite(body.anchorCol)
    ) {
      peer.anchorLine = Math.max(1, Math.floor(body.anchorLine));
      peer.anchorCol = Math.max(1, Math.floor(body.anchorCol));
    } else {
      peer.anchorLine = peer.headLine;
      peer.anchorCol = peer.headCol;
    }

    const p = this.roomPeers.get(room)?.get(clientId);
    if (p) {
      void this.mongoRepo
        .savePeer(room, clientId, p)
        .catch((e: unknown) => this.logger.warn(String(e)));
    }

    const now = Date.now();
    const lastRoster = this.lastPresenceRosterAt.get(room) ?? 0;
    if (now - lastRoster >= CollabGateway.PRESENCE_ROSTER_THROTTLE_MS) {
      this.lastPresenceRosterAt.set(room, now);
      this.broadcastRoster(room);
    }
  }

  @SubscribeMessage('collab-announce')
  handleAnnounce(
    @MessageBody() body: { room?: string; files?: Record<string, string> },
  ): void {
    void body;
  }

  @SubscribeMessage('collab-paste')
  handlePaste(
    @MessageBody()
    body: {
      room?: string;
      clientId?: string;
      path?: string;
      content?: string;
      fileContent?: string;
      insertStartOffset?: number;
      insertEndOffset?: number;
      line?: number;
      col?: number;
    },
  ): void {
    const room = typeof body?.room === 'string' ? body.room : '';
    const clientId = typeof body?.clientId === 'string' ? body.clientId : '';
    const path =
      typeof body?.path === 'string'
        ? normalizeSandpackFilePath(body.path)
        : '';
    const content = typeof body?.content === 'string' ? body.content : '';
    const fileContent =
      typeof body?.fileContent === 'string' ? body.fileContent : content;
    if (!room || !clientId || !path || !content) {
      return;
    }

    const fallbackStart =
      typeof body.insertStartOffset === 'number' &&
      Number.isFinite(body.insertStartOffset)
        ? Math.max(0, Math.floor(body.insertStartOffset))
        : 0;
    const startOffset = Math.min(fallbackStart, fileContent.length);
    const rawEndOffset =
      typeof body.insertEndOffset === 'number' &&
      Number.isFinite(body.insertEndOffset)
        ? Math.max(startOffset, Math.floor(body.insertEndOffset))
        : startOffset + content.length;
    const endOffset = Math.min(rawEndOffset, fileContent.length);
    const peer = this.roomPeers.get(room)?.get(clientId);
    void this.mongoRepo
      .insertPasteEvent({
        roomId: room,
        clientId,
        displayName: peer?.displayName ?? clientId,
        path,
        content,
        fileContent,
        contentLength: content.length,
        truncated: false,
        insertStartOffset: startOffset,
        insertEndOffset: endOffset,
        line:
          typeof body.line === 'number' && Number.isFinite(body.line)
            ? Math.max(1, Math.floor(body.line))
            : 1,
        col:
          typeof body.col === 'number' && Number.isFinite(body.col)
            ? Math.max(1, Math.floor(body.col))
            : 1,
      })
      .catch((e: unknown) => this.logger.warn(String(e)));
  }

  @SubscribeMessage('collab-cursor-away')
  handleCursorAway(
    @MessageBody()
    body: {
      room?: string;
      clientId?: string;
      away?: boolean;
    },
  ): void {
    const room = typeof body?.room === 'string' ? body.room : '';
    const clientId = typeof body?.clientId === 'string' ? body.clientId : '';
    if (!room || !clientId) {
      return;
    }

    const peer = this.roomPeers.get(room)?.get(clientId);
    if (!peer) {
      return;
    }

    const away = body?.away === true;
    if (peer.cursorAway === away) {
      return;
    }
    peer.cursorAway = away;

    if (away) {
      const key = `${room}:${clientId}`;
      const now = Date.now();
      const last = this.lastPageLeaveMongoAt.get(key) ?? 0;
      if (
        now - last >=
        CollabGateway.PAGE_LEAVE_MONGO_COOLDOWN_MS
      ) {
        this.lastPageLeaveMongoAt.set(key, now);
        void this.mongoRepo
          .insertPageLeaveEvent({
            roomId: room,
            clientId,
            displayName: peer.displayName,
          })
          .catch((e: unknown) => this.logger.warn(String(e)));
      }
    }

    this.lastRosterPayload.delete(room);
    this.broadcastRoster(room);
  }

  /** @deprecated use collab-cursor-away with away: true */
  @SubscribeMessage('collab-page-leave')
  handlePageLeave(
    @MessageBody()
    body: {
      room?: string;
      clientId?: string;
    },
  ): void {
    this.handleCursorAway({ ...body, away: true });
  }

  @SubscribeMessage('collab-yjs-update')
  handleYjsUpdate(
    @MessageBody() body: CollabYjsUpdateWire,
    @ConnectedSocket() client: Socket,
  ): void {
    const room = typeof body?.room === 'string' ? body.room : '';
    const clientId =
      typeof body?.clientId === 'string' ? body.clientId.trim() : '';
    if (
      !room ||
      !clientId ||
      !this.assertSocketSender(client, room, clientId)
    ) {
      return;
    }

    const update = this.normalizeYjsUpdate(body.update);
    if (!update) {
      this.syncLog('yjs-update-reject', { reason: 'invalid-update', room });
      return;
    }

    const doc = this.ensureRoomYDoc(room);
    const beforeFileCount = doc.getMap<boolean>(Y_FILES_MAP).size;
    this.syncLog('yjs-update-receive', {
      room,
      clientId,
      socketId: client.id,
      updateBytes: update.length,
      beforeFileCount,
    });
    Y.applyUpdate(doc, update);
    this.syncYDocToMemory(room, doc);
    this.scheduleYjsPersist(room);
    this.syncLog('yjs-update-broadcast', {
      room,
      clientId,
      updateBytes: update.length,
      peerCount: Math.max(0, (this.roomPeers.get(room)?.size ?? 1) - 1),
    });
    client.to(room).emit('collab-yjs-update', { update: Array.from(update) });
  }

  @SubscribeMessage('collab-file')
  handleFile(
    @MessageBody()
    body: {
      room?: string;
      path?: string;
      content?: string;
      from?: string;
    },
    @ConnectedSocket() client: Socket,
  ): void {
    const parsed = parseCollabFileUpdate(body);
    if (!parsed.ok) {
      this.syncLog('editor-file-reject', { reason: parsed.reason });
      return;
    }
    const { room, path, content, from } = parsed.value;
    if (!this.assertSocketSender(client, room, from)) {
      return;
    }
    if (this.roomYDocs.has(room)) {
      this.syncLog('editor-file-reject', {
        reason: 'yjs-active',
        room,
        path,
        from,
      });
      return;
    }
    if (!this.roomFiles.has(room)) {
      this.roomFiles.set(room, new Map());
    }
    if (!this.roomFileRevisions.has(room)) {
      this.roomFileRevisions.set(room, new Map());
    }
    const files = this.roomFiles.get(room)!;
    if (isStoredFileContentUnchanged(files.get(path), content)) {
      this.syncLog('editor-file-reject', {
        reason: 'unchanged',
        room,
        path,
        from,
      });
      return;
    }
    files.set(path, content);
    const revisionMap = this.roomFileRevisions.get(room)!;
    const nextRevision = (revisionMap.get(path) ?? 0) + 1;
    revisionMap.set(path, nextRevision);
    this.syncLog('editor-file', {
      room,
      path,
      from,
      rev: nextRevision,
      contentLen: content.length,
    });
    this.scheduleFilePersist(room, path, content);
    this.server
      .to(room)
      .emit('collab-file', { path, content, from, rev: nextRevision });
  }

  /** WS-рассылка сразу; Mongo — с debounce, чтобы не тормозить на каждом keystroke. */
  private scheduleFilePersist(
    room: string,
    path: string,
    content: string,
  ): void {
    const key = `${room}\0${path}`;
    const prev = this.filePersistTimers.get(key);
    if (prev) {
      clearTimeout(prev);
    }
    this.filePersistTimers.set(
      key,
      setTimeout(() => {
        this.filePersistTimers.delete(key);
        void this.mongoRepo
          .upsertFile(room, path, content)
          .catch((e: unknown) => this.logger.warn(String(e)));
      }, CollabGateway.FILE_PERSIST_DEBOUNCE_MS),
    );
  }

  @SubscribeMessage('collab-remove')
  handleRemove(
    @MessageBody()
    body: {
      room?: string;
      path?: string;
      from?: string;
    },
    @ConnectedSocket() client: Socket,
  ): void {
    const room = typeof body?.room === 'string' ? body.room.trim() : '';
    const path =
      typeof body?.path === 'string' ? parseCollabFilePath(body.path) : null;
    const from =
      typeof body?.from === 'string'
        ? normalizeCollabClientId(body.from)
        : null;
    if (!room || !path || !from) {
      this.syncLog('editor-remove-reject', { reason: 'invalid-payload' });
      return;
    }
    if (!this.assertSocketSender(client, room, from)) {
      return;
    }
    if (this.roomYDocs.has(room)) {
      this.syncLog('editor-remove-reject', {
        reason: 'yjs-active',
        room,
        path,
        from,
      });
      return;
    }
    if (!this.roomFiles.has(room)) {
      return;
    }
    const files = this.roomFiles.get(room)!;
    if (!files.has(path)) {
      this.syncLog('editor-remove-reject', {
        reason: 'unchanged',
        room,
        path,
        from,
      });
      return;
    }
    if (!this.roomFileRevisions.has(room)) {
      this.roomFileRevisions.set(room, new Map());
    }
    const revisionMap = this.roomFileRevisions.get(room)!;
    const nextRevision = (revisionMap.get(path) ?? 0) + 1;
    revisionMap.set(path, nextRevision);
    files.delete(path);
    void this.mongoRepo
      .deleteFile(room, path)
      .catch((e: unknown) => this.logger.warn(String(e)));
    this.server
      .to(room)
      .emit('collab-remove', { path, from, rev: nextRevision });
  }

  /** Сокет должен быть в комнате и `from` совпадать с clientId сессии. */
  private assertSocketSender(
    client: Socket,
    room: string,
    from: string,
  ): boolean {
    const meta = this.socketMeta.get(client.id);
    if (!meta || meta.room !== room) {
      this.syncLog('editor-file-reject', { reason: 'not-in-room', room, from });
      return false;
    }
    if (meta.clientId !== from) {
      this.syncLog('editor-file-reject', {
        reason: 'from-mismatch',
        room,
        from,
        socketClientId: meta.clientId,
      });
      return false;
    }
    return true;
  }

  private ensureRoomYDoc(room: string): Y.Doc {
    const existing = this.roomYDocs.get(room);
    if (existing) {
      this.syncLog('yjs-doc-existing', {
        room,
        fileCount: existing.getMap<boolean>(Y_FILES_MAP).size,
        folderCount: existing.getArray<string>(Y_FOLDERS_ARRAY).length,
      });
      return existing;
    }

    const doc = new Y.Doc();
    const files = this.snapshotFiles(room);
    const folders = this.snapshotFolders(room);
    this.syncLog('yjs-doc-create', {
      room,
      seedFileCount: Object.keys(files).length,
      seedFolderCount: folders.length,
    });
    doc.transact(() => {
      const filesMap = doc.getMap<boolean>(Y_FILES_MAP);
      for (const [path, content] of Object.entries(files)) {
        const normalized = normalizeSandpackFilePath(path);
        filesMap.set(normalized, true);
        const text = doc.getText(yTextName(normalized));
        if (text.length > 0) {
          text.delete(0, text.length);
        }
        text.insert(0, content);
      }
      const foldersArray = doc.getArray<string>(Y_FOLDERS_ARRAY);
      foldersArray.delete(0, foldersArray.length);
      if (folders.length > 0) {
        foldersArray.push(folders);
      }
    });
    this.roomYDocs.set(room, doc);
    this.syncLog('yjs-doc-created', {
      room,
      encodedBytes: Y.encodeStateAsUpdate(doc).length,
      fileCount: doc.getMap<boolean>(Y_FILES_MAP).size,
      folderCount: doc.getArray<string>(Y_FOLDERS_ARRAY).length,
    });
    return doc;
  }

  private syncYDocToMemory(room: string, doc: Y.Doc): void {
    const filesMap = doc.getMap<boolean>(Y_FILES_MAP);
    const files = new Map<string, string>();
    for (const path of filesMap.keys()) {
      files.set(path, doc.getText(yTextName(path)).toJSON());
    }
    this.roomFiles.set(room, files);
    const folders = doc.getArray<string>(Y_FOLDERS_ARRAY).toArray();
    const normalizedFolders = deriveFolderPaths(
      Object.fromEntries(files),
      folders,
    );
    this.roomFolders.set(room, new Set(normalizedFolders));
    this.syncLog('yjs-materialize-memory', {
      room,
      fileCount: files.size,
      folderCount: normalizedFolders.length,
      encodedBytes: Y.encodeStateAsUpdate(doc).length,
    });
  }

  private scheduleYjsPersist(room: string): void {
    const prev = this.yjsPersistTimers.get(room);
    if (prev) {
      clearTimeout(prev);
      this.syncLog('yjs-persist-reschedule', { room });
    } else {
      this.syncLog('yjs-persist-schedule', { room });
    }
    this.yjsPersistTimers.set(
      room,
      setTimeout(() => {
        this.yjsPersistTimers.delete(room);
        this.flushYjsPersist(room, 'debounce');
      }, CollabGateway.YJS_PERSIST_DEBOUNCE_MS),
    );
  }

  private flushYjsPersist(room: string, reason: string): void {
    const prev = this.yjsPersistTimers.get(room);
    if (prev) {
      clearTimeout(prev);
      this.yjsPersistTimers.delete(room);
    }
    const doc = this.roomYDocs.get(room);
    if (!doc) {
      this.syncLog('yjs-persist-skip', { room, reason: 'missing-doc' });
      return;
    }
    this.syncYDocToMemory(room, doc);
    const files = this.snapshotFiles(room);
    const folders = this.snapshotFolders(room);
    this.syncLog('yjs-persist-flush', {
      room,
      reason,
      fileCount: Object.keys(files).length,
      folderCount: folders.length,
    });
    void this.mongoRepo
      .replaceRoomFiles(room, files)
      .then(() =>
        this.syncLog('yjs-persist-files-ok', {
          room,
          fileCount: Object.keys(files).length,
        }),
      )
      .catch((e: unknown) => {
        this.syncLog('yjs-persist-files-error', {
          room,
          message: String(e),
        });
        this.logger.warn(String(e));
      });
    void this.mongoRepo
      .replaceRoomFolders(room, folders)
      .then(() =>
        this.syncLog('yjs-persist-folders-ok', {
          room,
          folderCount: folders.length,
        }),
      )
      .catch((e: unknown) => {
        this.syncLog('yjs-persist-folders-error', {
          room,
          message: String(e),
        });
        this.logger.warn(String(e));
      });
  }

  private normalizeYjsUpdate(raw: unknown): Uint8Array | null {
    if (raw instanceof Uint8Array) {
      return raw;
    }
    if (Array.isArray(raw) && raw.every((n) => Number.isInteger(n))) {
      return Uint8Array.from(raw);
    }
    return null;
  }

  @SubscribeMessage('collab-folders-sync')
  handleFoldersSync(
    @MessageBody() body: { room?: string; folders?: string[] },
  ): void {
    const room = typeof body?.room === 'string' ? body.room : '';
    const folders = Array.isArray(body?.folders) ? body.folders : [];
    if (!room) {
      return;
    }
    if (this.roomYDocs.has(room)) {
      this.syncLog('folders-sync-reject', { reason: 'yjs-active', room });
      return;
    }

    const normalized = deriveFolderPaths(this.snapshotFiles(room), folders);
    this.roomFolders.set(room, new Set(normalized));
    void this.mongoRepo
      .replaceRoomFolders(room, normalized)
      .catch((e: unknown) => this.logger.warn(String(e)));
    this.server.to(room).emit('collab-folders', normalized);
  }

  private broadcastRoster(room: string): void {
    const peersMap = this.roomPeers.get(room);
    const peers = peersMap
      ? Array.from(peersMap.entries())
          .map(([clientId, p]) => {
            if (p.hue == null) {
              p.hue = hueFromClientId(clientId);
            }
            syncPeerPresenceColors(p, clientId);
            const hue = p.hue;
            return {
              clientId,
              displayName: p.displayName,
              activeFile: p.activeFile,
              hue,
              colorHex: p.colorHex as string,
              line: p.headLine,
              col: p.headCol,
              anchorLine: p.anchorLine,
              anchorCol: p.anchorCol,
              headLine: p.headLine,
              headCol: p.headCol,
              cursorAway: p.cursorAway === true,
            };
          })
          .sort((a, b) => a.clientId.localeCompare(b.clientId))
      : [];
    const payload = JSON.stringify({ count: peers.length, peers });
    if (this.lastRosterPayload.get(room) === payload) {
      return;
    }
    this.lastRosterPayload.set(room, payload);
    this.server.to(room).emit('collab-roster', {
      count: peers.length,
      peers,
    });
  }

  private snapshot(room: string): CollabSnapshot {
    return {
      files: this.snapshotFiles(room),
      folders: this.snapshotFolders(room),
    };
  }

  private snapshotFiles(room: string): Record<string, string> {
    const m = this.roomFiles.get(room);
    if (!m) {
      return {};
    }
    return Object.fromEntries(m);
  }

  private snapshotFolders(room: string): string[] {
    const folders = this.roomFolders.get(room);
    return deriveFolderPaths(
      this.snapshotFiles(room),
      folders ? Array.from(folders) : [],
    );
  }

  private collectRoomHueSet(
    room: string,
    excludeClientId?: string,
  ): Set<number> {
    const used = new Set<number>();
    const map = this.roomPeers.get(room);
    if (!map) {
      return used;
    }
    for (const [cid, p] of map.entries()) {
      if (excludeClientId !== undefined && cid === excludeClientId) {
        continue;
      }
      if (p.hue != null) {
        used.add(normHue(p.hue));
      }
    }
    return used;
  }

  private socketHandshakeToken(client: Socket): string | null {
    const auth = client.handshake.auth as Record<string, unknown> | undefined;
    const fromAuth = auth?.token;
    if (typeof fromAuth === 'string' && fromAuth.trim()) {
      return fromAuth.trim();
    }
    const h = client.handshake.headers.authorization;
    if (typeof h === 'string' && /^Bearer\s+/i.test(h)) {
      const t = h.replace(/^Bearer\s+/i, '').trim();
      return t.length > 0 ? t : null;
    }
    return null;
  }

  /** Имя из JWT + профиля пользователя; без токена — гость со случайным ником на клиенте. */
  private async resolveAuthDisplayName(client: Socket): Promise<string | null> {
    const token = this.socketHandshakeToken(client);
    if (!token) {
      return null;
    }
    try {
      const payload = await this.jwt.verifyAsync<{ sub?: string }>(token);
      const sub = typeof payload?.sub === 'string' ? payload.sub.trim() : '';
      if (!sub) {
        return null;
      }
      const doc = await this.users.findById(sub);
      return collabPublicDisplayName(doc);
    } catch {
      return null;
    }
  }

  private async ensureRoomHydrated(room: string): Promise<void> {
    const cur = this.roomFiles.get(room);
    const folderCur = this.roomFolders.get(room);
    if (cur && folderCur) {
      return;
    }
    await this.mongoRepo.ensureRoom(room);
    const loaded = await this.mongoRepo.loadFiles(room);
    const merged = mergeWithDefaultSandboxFiles(loaded);
    this.roomFiles.set(room, new Map(Object.entries(merged)));
    if (sandboxFilesNeedPersist(loaded, merged)) {
      void this.mongoRepo.replaceRoomFiles(room, merged);
    }
    this.roomFileRevisions.set(
      room,
      new Map(
        Object.keys(merged).map((path) => [normalizeSandpackFilePath(path), 1]),
      ),
    );
    const loadedFolders = await this.mongoRepo.loadFolders(room);
    this.roomFolders.set(
      room,
      new Set(deriveFolderPaths(merged, loadedFolders)),
    );
  }
}
