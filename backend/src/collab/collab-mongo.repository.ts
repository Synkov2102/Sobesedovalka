import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import type { Collection } from 'mongodb';
import { MongoService } from '../mongo/mongo.service';
import {
  hueFromClientId,
  normHue,
  syncPeerPresenceColors,
} from './collab-color';
import type {
  CollabFileDoc,
  CollabFolderDoc,
  CollabPageLeaveEventDoc,
  CollabPasteEventDoc,
  CollabPeerDoc,
  CollabRoomDoc,
} from './collab-mongo.types';
import type { RoomPeer } from './collab.types';

const FILES = 'collab_files';
const FOLDERS = 'collab_folders';
const PAGE_LEAVE_EVENTS = 'collab_page_leave_events';
const PASTE_EVENTS = 'collab_paste_events';
const PEERS = 'collab_peers';
const ROOMS = 'collab_rooms';

@Injectable()
export class CollabMongoRepository implements OnModuleInit {
  private readonly logger = new Logger(CollabMongoRepository.name);

  constructor(private readonly mongo: MongoService) {}

  async onModuleInit(): Promise<void> {
    try {
      await this.ensureIndexes();
    } catch (e) {
      this.logger.warn(`Collab Mongo indexes: ${String(e)}`);
    }
  }

  private files(): Collection<CollabFileDoc> {
    return this.mongo.getDb().collection<CollabFileDoc>(FILES);
  }

  private folders(): Collection<CollabFolderDoc> {
    return this.mongo.getDb().collection<CollabFolderDoc>(FOLDERS);
  }

  private peers(): Collection<CollabPeerDoc> {
    return this.mongo.getDb().collection<CollabPeerDoc>(PEERS);
  }

  private pasteEvents(): Collection<CollabPasteEventDoc> {
    return this.mongo.getDb().collection<CollabPasteEventDoc>(PASTE_EVENTS);
  }

  private pageLeaveEvents(): Collection<CollabPageLeaveEventDoc> {
    return this.mongo
      .getDb()
      .collection<CollabPageLeaveEventDoc>(PAGE_LEAVE_EVENTS);
  }

  private rooms(): Collection<CollabRoomDoc> {
    return this.mongo.getDb().collection<CollabRoomDoc>(ROOMS);
  }

  private async ensureIndexes(): Promise<void> {
    await this.files().createIndex({ roomId: 1, path: 1 }, { unique: true });
    await this.folders().createIndex({ roomId: 1, path: 1 }, { unique: true });
    await this.pasteEvents().createIndex({ roomId: 1, createdAt: -1 });
    await this.pageLeaveEvents().createIndex({ roomId: 1, createdAt: -1 });
    await this.peers().createIndex(
      { roomId: 1, clientId: 1 },
      { unique: true },
    );
    await this.rooms().createIndex({ updatedAt: -1 });
    await this.rooms().createIndex({ ownerUserId: 1, updatedAt: -1 });
  }

  async ensureRoom(roomId: string): Promise<void> {
    const now = new Date();
    await this.rooms().updateOne(
      { _id: roomId },
      {
        $set: { updatedAt: now },
        $setOnInsert: { _id: roomId, createdAt: now },
      },
      { upsert: true },
    );
  }

  async loadFiles(roomId: string): Promise<Record<string, string>> {
    const rows = await this.files().find({ roomId }).toArray();
    const out: Record<string, string> = {};
    for (const r of rows) {
      out[r.path] = r.content;
    }
    return out;
  }

  /** True if this room was seeded with at least one Sandpack file (preset start-room). */
  async roomHasFiles(roomId: string): Promise<boolean> {
    const doc = await this.files().findOne(
      { roomId },
      { projection: { _id: 1 } },
    );
    return doc !== null;
  }

  async loadFolders(roomId: string): Promise<string[]> {
    const rows = await this.folders().find({ roomId }).toArray();
    return rows.map((row) => row.path);
  }

  async upsertFile(
    roomId: string,
    path: string,
    content: string,
  ): Promise<void> {
    const now = new Date();
    await this.files().updateOne(
      { roomId, path },
      { $set: { roomId, path, content, updatedAt: now } },
      { upsert: true },
    );
  }

  async deleteFile(roomId: string, path: string): Promise<void> {
    await this.files().deleteOne({ roomId, path });
  }

  /** Full sync of file tree for a room (after announce merge or batch save). */
  async replaceRoomFiles(
    roomId: string,
    files: Record<string, string>,
  ): Promise<void> {
    const paths = Object.keys(files);
    const now = new Date();
    if (paths.length === 0) {
      await this.files().deleteMany({ roomId });
      return;
    }
    await this.files().deleteMany({ roomId, path: { $nin: paths } });
    const ops = paths.map((path) => ({
      updateOne: {
        filter: { roomId, path },
        update: {
          $set: {
            roomId,
            path,
            content: files[path] ?? '',
            updatedAt: now,
          },
        },
        upsert: true,
      },
    }));
    await this.files().bulkWrite(ops);
  }

  async replaceRoomFolders(roomId: string, folders: string[]): Promise<void> {
    const paths = Array.from(
      new Set(
        folders
          .map((path) => path.trim())
          .filter((path) => path.length > 0 && path !== '/'),
      ),
    );
    const now = new Date();
    if (paths.length === 0) {
      await this.folders().deleteMany({ roomId });
      return;
    }
    await this.folders().deleteMany({ roomId, path: { $nin: paths } });
    const ops = paths.map((path) => ({
      updateOne: {
        filter: { roomId, path },
        update: {
          $set: {
            roomId,
            path,
            updatedAt: now,
          },
        },
        upsert: true,
      },
    }));
    await this.folders().bulkWrite(ops);
  }

  async seedRoom(
    roomId: string,
    files: Record<string, string>,
    folders: string[],
  ): Promise<void> {
    await this.ensureRoom(roomId);
    await this.replaceRoomFiles(roomId, files);
    await this.replaceRoomFolders(roomId, folders);
  }

  /**
   * Привязать комнату к пользователю (после seedRoom).
   * Поля title / sourcePresetId опциональны.
   */
  async setRoomOwnership(
    roomId: string,
    meta: {
      ownerUserId: string;
      title?: string;
      sourcePresetId?: string;
    },
  ): Promise<void> {
    const now = new Date();
    const $set: Record<string, unknown> = {
      updatedAt: now,
      ownerUserId: meta.ownerUserId,
    };
    if (meta.title !== undefined) {
      $set.title = meta.title;
    }
    if (meta.sourcePresetId !== undefined) {
      $set.sourcePresetId = meta.sourcePresetId;
    }
    const result = await this.rooms().updateOne({ _id: roomId }, { $set });
    if (result.matchedCount === 0) {
      await this.ensureRoom(roomId);
      await this.rooms().updateOne({ _id: roomId }, { $set });
    }
  }

  async listRoomsByOwner(userId: string): Promise<CollabRoomDoc[]> {
    return this.rooms()
      .find({ ownerUserId: userId })
      .sort({ updatedAt: -1 })
      .toArray();
  }

  async roomBelongsToOwner(roomId: string, userId: string): Promise<boolean> {
    const room = await this.rooms().findOne(
      { _id: roomId },
      { projection: { ownerUserId: 1 } },
    );
    return room?.ownerUserId === userId;
  }

  async findRoom(roomId: string): Promise<CollabRoomDoc | null> {
    return this.rooms().findOne({ _id: roomId });
  }

  async insertPasteEvent(
    event: Omit<CollabPasteEventDoc, 'createdAt'> & { createdAt?: Date },
  ): Promise<void> {
    await this.pasteEvents().insertOne({
      ...event,
      createdAt: event.createdAt ?? new Date(),
    });
  }

  async listPasteEvents(roomId: string): Promise<CollabPasteEventDoc[]> {
    return this.pasteEvents()
      .find({ roomId })
      .sort({ createdAt: -1 })
      .limit(500)
      .toArray();
  }

  async insertPageLeaveEvent(
    event: Omit<CollabPageLeaveEventDoc, 'createdAt'> & { createdAt?: Date },
  ): Promise<void> {
    await this.pageLeaveEvents().insertOne({
      ...event,
      createdAt: event.createdAt ?? new Date(),
    });
  }

  async listPageLeaveEvents(
    roomId: string,
  ): Promise<CollabPageLeaveEventDoc[]> {
    return this.pageLeaveEvents()
      .find({ roomId })
      .sort({ createdAt: -1 })
      .limit(500)
      .toArray();
  }

  /**
   * Удаляет комнату и все связанные файлы, папки и пиры.
   * Только если владелец комнаты совпадает с userId.
   */
  async deleteRoomForOwner(
    roomId: string,
    userId: string,
  ): Promise<'deleted' | 'not_found' | 'forbidden'> {
    const room = await this.rooms().findOne({ _id: roomId });
    if (!room) {
      return 'not_found';
    }
    if (room.ownerUserId !== userId) {
      return 'forbidden';
    }
    await this.files().deleteMany({ roomId });
    await this.folders().deleteMany({ roomId });
    await this.pasteEvents().deleteMany({ roomId });
    await this.pageLeaveEvents().deleteMany({ roomId });
    await this.peers().deleteMany({ roomId });
    await this.rooms().deleteOne({ _id: roomId });
    return 'deleted';
  }

  private docToPeer(d: CollabPeerDoc): RoomPeer {
    const hueRaw =
      typeof d.hue === 'number' && Number.isFinite(d.hue)
        ? d.hue
        : hueFromClientId(d.clientId);
    const peer: RoomPeer = {
      displayName: d.displayName,
      activeFile: d.activeFile ?? '',
      hue: normHue(hueRaw),
      anchorLine: Math.max(1, d.anchorLine),
      anchorCol: Math.max(1, d.anchorCol),
      headLine: Math.max(1, d.headLine),
      headCol: Math.max(1, d.headCol),
    };
    syncPeerPresenceColors(peer, d.clientId);
    return peer;
  }

  async loadPeer(roomId: string, clientId: string): Promise<RoomPeer | null> {
    const d = await this.peers().findOne({ roomId, clientId });
    if (!d) {
      return null;
    }
    return this.docToPeer(d);
  }

  async savePeer(roomId: string, clientId: string, p: RoomPeer): Promise<void> {
    syncPeerPresenceColors(p, clientId);
    const hue = p.hue as number;
    const colorHex = p.colorHex as string;
    const now = new Date();
    await this.peers().updateOne(
      { roomId, clientId },
      {
        $set: {
          roomId,
          clientId,
          displayName: p.displayName,
          hue,
          colorHex,
          activeFile: p.activeFile ?? '',
          anchorLine: p.anchorLine,
          anchorCol: p.anchorCol,
          headLine: p.headLine,
          headCol: p.headCol,
          updatedAt: now,
        },
      },
      { upsert: true },
    );
  }

  async deletePeer(roomId: string, clientId: string): Promise<void> {
    await this.peers().deleteOne({ roomId, clientId });
  }
}
