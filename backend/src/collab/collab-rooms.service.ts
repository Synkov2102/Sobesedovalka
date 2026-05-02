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
}
