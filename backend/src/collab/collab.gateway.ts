import { Logger } from '@nestjs/common';
import {
  ConnectedSocket,
  MessageBody,
  OnGatewayDisconnect,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import {
  hueFromClientId,
  normHue,
  pickHueUniqueInRoom,
  syncPeerPresenceColors,
} from './collab-color';
import { normalizeSandpackFilePath } from './sandpack-paths';
import { randomDisplayName } from './collab-names';
import { CollabMongoRepository } from './collab-mongo.repository';
import type { RoomPeer } from './collab.types';

type CollabSnapshot = {
  files: Record<string, string>;
  folders: string[];
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

/** Collab files + roster: MongoDB only (see `MONGODB_URI`). */
@WebSocketGateway({
  cors: {
    origin: ['http://localhost:5173', 'http://127.0.0.1:5173'],
    credentials: true,
  },
})
export class CollabGateway implements OnGatewayDisconnect {
  private readonly logger = new Logger(CollabGateway.name);

  @WebSocketServer()
  server!: Server;

  constructor(private readonly mongoRepo: CollabMongoRepository) {}

  private readonly roomFiles = new Map<string, Map<string, string>>();
  private readonly roomFolders = new Map<string, Set<string>>();
  /** room -> clientId -> peer */
  private readonly roomPeers = new Map<string, Map<string, RoomPeer>>();
  /** socket.id -> { room, clientId } */
  private readonly socketMeta = new Map<
    string,
    { room: string; clientId: string }
  >();
  private readonly lastRosterPayload = new Map<string, string>();

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
        displayName: randomDisplayName(),
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
    client.emit('collab-snapshot', this.snapshot(room));
    this.broadcastRoster(room);
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

    this.broadcastRoster(room);
  }

  @SubscribeMessage('collab-announce')
  handleAnnounce(
    @MessageBody() body: { room?: string; files?: Record<string, string> },
  ): void {
    void body;
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
    const room = typeof body?.room === 'string' ? body.room : '';
    const path =
      typeof body?.path === 'string'
        ? normalizeSandpackFilePath(body.path)
        : '';
    const content = typeof body?.content === 'string' ? body.content : '';
    const from = typeof body?.from === 'string' ? body.from : '';
    if (!room || !path) {
      return;
    }
    if (!this.roomFiles.has(room)) {
      this.roomFiles.set(room, new Map());
    }
    this.roomFiles.get(room)!.set(path, content);
    void this.mongoRepo
      .upsertFile(room, path, content)
      .catch((e: unknown) => this.logger.warn(String(e)));
    this.server.to(room).emit('collab-file', { path, content, from });
  }

  @SubscribeMessage('collab-remove')
  handleRemove(
    @MessageBody()
    body: { room?: string; path?: string; from?: string },
    @ConnectedSocket() client: Socket,
  ): void {
    const room = typeof body?.room === 'string' ? body.room : '';
    const path =
      typeof body?.path === 'string'
        ? normalizeSandpackFilePath(body.path)
        : '';
    const from = typeof body?.from === 'string' ? body.from : '';
    if (!room || !path) {
      return;
    }
    if (!this.roomFiles.has(room)) {
      return;
    }
    this.roomFiles.get(room)!.delete(path);
    void this.mongoRepo
      .deleteFile(room, path)
      .catch((e: unknown) => this.logger.warn(String(e)));
    this.server.to(room).emit('collab-remove', { path, from });
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

  private collectRoomHueSet(room: string, excludeClientId?: string): Set<number> {
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

  private async ensureRoomHydrated(room: string): Promise<void> {
    const cur = this.roomFiles.get(room);
    const folderCur = this.roomFolders.get(room);
    if (cur && folderCur) {
      return;
    }
    await this.mongoRepo.ensureRoom(room);
    const loaded = await this.mongoRepo.loadFiles(room);
    this.roomFiles.set(room, new Map(Object.entries(loaded)));
    const loadedFolders = await this.mongoRepo.loadFolders(room);
    this.roomFolders.set(room, new Set(deriveFolderPaths(loaded, loadedFolders)));
  }
}
