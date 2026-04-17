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
import { randomDisplayName } from './collab-names';
import { CollabPersistenceService } from './collab-persistence.service';
import type { RoomPeer } from './collab.types';

/** Files + live roster per room; file tree persisted under `data/collab/`. */
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

  constructor(private readonly persistence: CollabPersistenceService) {}

  private readonly roomFiles = new Map<string, Map<string, string>>();
  /** room -> clientId -> peer */
  private readonly roomPeers = new Map<string, Map<string, RoomPeer>>();
  /** socket.id -> { room, clientId } */
  private readonly socketMeta = new Map<
    string,
    { room: string; clientId: string }
  >();
  private readonly lastRosterPayload = new Map<string, string>();

  handleDisconnect(client: Socket): void {
    const meta = this.socketMeta.get(client.id);
    if (!meta) {
      return;
    }
    this.socketMeta.delete(client.id);
    const { room, clientId } = meta;
    this.roomPeers.get(room)?.delete(clientId);
    if (this.roomPeers.get(room)?.size === 0) {
      this.roomPeers.delete(room);
      this.lastRosterPayload.delete(room);
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
      peer = {
        displayName: randomDisplayName(),
        activeFile: '',
        anchorLine: 1,
        anchorCol: 1,
        headLine: 1,
        headCol: 1,
      };
      peers.set(clientId, peer);
    }

    client.emit('collab-welcome', {
      clientId,
      displayName: peer.displayName,
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
      peer.activeFile = body.activeFile;
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

    this.broadcastRoster(room);
  }

  @SubscribeMessage('collab-announce')
  handleAnnounce(
    @MessageBody() body: { room?: string; files?: Record<string, string> },
  ): void {
    const room = typeof body?.room === 'string' ? body.room : '';
    const files = body?.files;
    if (!room || !files || typeof files !== 'object') {
      return;
    }
    if (!this.roomFiles.has(room)) {
      this.roomFiles.set(room, new Map());
    }
    const m = this.roomFiles.get(room)!;
    /**
     * Full merge only for an empty room (first session / cold storage).
     * After refresh, the client still sends the default template before snapshot
     * is applied — overwriting persisted paths would wipe saved code.
     */
    if (m.size === 0) {
      for (const [k, v] of Object.entries(files)) {
        m.set(k, v);
      }
    } else {
      for (const [k, v] of Object.entries(files)) {
        if (!m.has(k)) {
          m.set(k, v);
        }
      }
    }
    this.persistRoom(room);
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
    const path = typeof body?.path === 'string' ? body.path : '';
    const content = typeof body?.content === 'string' ? body.content : '';
    const from = typeof body?.from === 'string' ? body.from : '';
    if (!room || !path) {
      return;
    }
    if (!this.roomFiles.has(room)) {
      this.roomFiles.set(room, new Map());
    }
    this.roomFiles.get(room)!.set(path, content);
    this.persistRoom(room);
    client.to(room).emit('collab-file', { path, content, from });
  }

  @SubscribeMessage('collab-remove')
  handleRemove(
    @MessageBody()
    body: { room?: string; path?: string; from?: string },
    @ConnectedSocket() client: Socket,
  ): void {
    const room = typeof body?.room === 'string' ? body.room : '';
    const path = typeof body?.path === 'string' ? body.path : '';
    const from = typeof body?.from === 'string' ? body.from : '';
    if (!room || !path) {
      return;
    }
    this.roomFiles.get(room)?.delete(path);
    this.persistRoom(room);
    client.to(room).emit('collab-remove', { path, from });
  }

  private broadcastRoster(room: string): void {
    const peersMap = this.roomPeers.get(room);
    const peers = peersMap
      ? Array.from(peersMap.entries())
          .map(([clientId, p]) => ({
            clientId,
            displayName: p.displayName,
            activeFile: p.activeFile,
            line: p.headLine,
            col: p.headCol,
            anchorLine: p.anchorLine,
            anchorCol: p.anchorCol,
            headLine: p.headLine,
            headCol: p.headCol,
          }))
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

  private snapshot(room: string): Record<string, string> {
    const m = this.roomFiles.get(room);
    if (!m) {
      return {};
    }
    return Object.fromEntries(m);
  }

  /** Load disk state when memory is empty (new process or room never touched this run). */
  private async ensureRoomHydrated(room: string): Promise<void> {
    const cur = this.roomFiles.get(room);
    if (cur && cur.size > 0) {
      return;
    }
    const loaded = await this.persistence.loadRoom(room);
    if (Object.keys(loaded).length === 0) {
      if (!this.roomFiles.has(room)) {
        this.roomFiles.set(room, new Map());
      }
      return;
    }
    this.roomFiles.set(room, new Map(Object.entries(loaded)));
  }

  private persistRoom(room: string): void {
    void this.persistence
      .saveRoom(room, this.snapshot(room))
      .catch((e: unknown) => this.logger.warn(String(e)));
  }
}
