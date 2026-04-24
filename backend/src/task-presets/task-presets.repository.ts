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
  }

  async listByUser(userId: string): Promise<TaskPresetDoc[]> {
    return this.collection.find({ userId }).sort({ updatedAt: -1 }).toArray();
  }

  async create(doc: TaskPresetDoc): Promise<void> {
    await this.collection.insertOne(doc);
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
  ): Promise<boolean> {
    const result = await this.collection.updateOne(
      { _id: id, userId },
      { $set: patch },
    );
    return result.matchedCount > 0;
  }

  async deleteForUser(id: string, userId: string): Promise<boolean> {
    const result = await this.collection.deleteOne({ _id: id, userId });
    return result.deletedCount > 0;
  }
}
