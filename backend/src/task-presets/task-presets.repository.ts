import { Injectable, OnModuleInit } from '@nestjs/common';
import type { Collection } from 'mongodb';
import { MongoService } from '../mongo/mongo.service';
import type { TaskPresetDoc } from './task-presets.types';

const COLLECTION = 'task_presets';

@Injectable()
export class TaskPresetsRepository implements OnModuleInit {
  private collection!: Collection<TaskPresetDoc>;

  constructor(private readonly mongo: MongoService) {}

  async onModuleInit(): Promise<void> {
    this.collection = this.mongo.getDb().collection<TaskPresetDoc>(COLLECTION);
    await this.collection.createIndex({ userId: 1, updatedAt: -1 });
    await this.collection.createIndex({
      visibility: 1,
      organizationId: 1,
      updatedAt: -1,
    });
  }

  async listByUser(userId: string): Promise<TaskPresetDoc[]> {
    return this.collection.find({ userId }).sort({ updatedAt: -1 }).toArray();
  }

  async listVisibleToUser(
    userId: string,
    organizationIds: string[],
  ): Promise<TaskPresetDoc[]> {
    const orFilter: Record<string, unknown>[] = [{ userId }];
    if (organizationIds.length > 0) {
      orFilter.push({
        visibility: 'organization',
        organizationId: { $in: organizationIds },
      });
    }
    return this.collection
      .find({ $or: orFilter })
      .sort({ updatedAt: -1 })
      .toArray();
  }

  async create(doc: TaskPresetDoc): Promise<void> {
    await this.collection.insertOne(doc);
  }

  async findById(id: string): Promise<TaskPresetDoc | null> {
    return this.collection.findOne({ _id: id });
  }

  async findByIdForUser(
    id: string,
    userId: string,
  ): Promise<TaskPresetDoc | null> {
    return this.collection.findOne({ _id: id, userId });
  }

  async updateForUser(
    id: string,
    userId: string,
    patch: Partial<Omit<TaskPresetDoc, '_id' | 'userId' | 'createdAt'>>,
    unsetKeys: Array<'organizationId'> = [],
  ): Promise<boolean> {
    const update: {
      $set: Partial<Omit<TaskPresetDoc, '_id' | 'userId' | 'createdAt'>>;
      $unset?: Record<string, ''>;
    } = { $set: patch };
    if (unsetKeys.length > 0) {
      update.$unset = Object.fromEntries(unsetKeys.map((k) => [k, '']));
    }
    const result = await this.collection.updateOne({ _id: id, userId }, update);
    return result.matchedCount > 0;
  }

  async deleteForUser(id: string, userId: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: id, userId });
    return result.deletedCount > 0;
  }

  /** Cascade when an organization is deleted: make org presets private. */
  async detachOrganization(organizationId: string): Promise<void> {
    await this.collection.updateMany(
      { organizationId, visibility: 'organization' },
      {
        $set: { visibility: 'private', updatedAt: new Date().toISOString() },
        $unset: { organizationId: '' },
      },
    );
  }
}
