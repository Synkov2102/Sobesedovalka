import { Injectable } from '@nestjs/common';
import { randomUUID } from 'crypto';
import { CollabMongoRepository } from './collab-mongo.repository';
import {
  DEFAULT_SANDBOX_FILES,
  DEFAULT_SANDBOX_FOLDERS,
} from './default-sandbox.seed';

export type CollabRoomSummaryDto = {
  roomId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
};

export type CollabPasteEventDto = {
  clientId: string;
  displayName: string;
  path: string;
  content: string;
  fileContent: string;
  contentLength: number;
  truncated: boolean;
  insertStartOffset: number;
  insertEndOffset: number;
  line: number;
  col: number;
  createdAt: string;
};

export type CollabPageLeaveEventDto = {
  clientId: string;
  displayName: string;
  createdAt: string;
};

@Injectable()
export class CollabRoomsService {
  constructor(private readonly collabRepo: CollabMongoRepository) {}

  async listMine(userId: string): Promise<CollabRoomSummaryDto[]> {
    const docs = await this.collabRepo.listRoomsByOwner(userId);
    return docs.map((d) => ({
      roomId: d._id,
      title: typeof d.title === 'string' && d.title.trim() ? d.title : d._id,
      createdAt: d.createdAt.toISOString(),
      updatedAt: d.updatedAt.toISOString(),
    }));
  }

  async createBlank(userId: string): Promise<CollabRoomSummaryDto> {
    const roomId = `room-${randomUUID()}`;
    const title = 'Новая комната';
    await this.collabRepo.seedRoom(
      roomId,
      DEFAULT_SANDBOX_FILES,
      DEFAULT_SANDBOX_FOLDERS,
    );
    await this.collabRepo.setRoomOwnership(roomId, {
      ownerUserId: userId,
      title,
    });
    const docs = await this.collabRepo.listRoomsByOwner(userId);
    const row = docs.find((r) => r._id === roomId);
    const now = new Date().toISOString();
    return {
      roomId,
      title,
      createdAt: row?.createdAt.toISOString() ?? now,
      updatedAt: row?.updatedAt.toISOString() ?? now,
    };
  }

  async deleteMine(
    roomId: string,
    userId: string,
  ): Promise<'deleted' | 'not_found' | 'forbidden'> {
    return this.collabRepo.deleteRoomForOwner(roomId, userId);
  }

  async listPasteEventsMine(
    roomId: string,
    userId: string,
  ): Promise<CollabPasteEventDto[] | 'forbidden'> {
    const canRead = await this.collabRepo.roomBelongsToOwner(roomId, userId);
    if (!canRead) {
      return 'forbidden';
    }
    const docs = await this.collabRepo.listPasteEvents(roomId);
    return docs.map((event) => ({
      clientId: event.clientId,
      displayName: event.displayName,
      path: event.path,
      content: event.content,
      fileContent: event.fileContent ?? event.content,
      contentLength: event.contentLength,
      truncated: event.truncated,
      insertStartOffset: event.insertStartOffset ?? 0,
      insertEndOffset: event.insertEndOffset ?? event.content.length,
      line: event.line,
      col: event.col,
      createdAt: event.createdAt.toISOString(),
    }));
  }

  async listPageLeaveEventsMine(
    roomId: string,
    userId: string,
  ): Promise<CollabPageLeaveEventDto[] | 'forbidden'> {
    const canRead = await this.collabRepo.roomBelongsToOwner(roomId, userId);
    if (!canRead) {
      return 'forbidden';
    }
    const docs = await this.collabRepo.listPageLeaveEvents(roomId);
    return docs.map((event) => ({
      clientId: event.clientId,
      displayName: event.displayName,
      createdAt: event.createdAt.toISOString(),
    }));
  }
}
