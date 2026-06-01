import { Injectable, OnModuleInit } from '@nestjs/common';
import type { Collection, WithId } from 'mongodb';
import { ObjectId } from 'mongodb';
import { MongoService } from '../mongo/mongo.service';

type UserSchema = {
  vkId?: string;
  yandexId?: string;
  displayName?: string;
  passwordHash?: string;
  avatarUrl?: string;
  email?: string;
  phone?: string;
  createdAt: string;
  updatedAt: string;
};

export type UserDoc = WithId<UserSchema>;

export type VkUserUpsert = {
  vkId: string;
  displayName: string;
  avatarUrl?: string;
  email?: string;
  phone?: string;
};

export type YandexUserUpsert = {
  yandexId: string;
  displayName: string;
  avatarUrl?: string;
  email?: string;
};

@Injectable()
export class UsersRepository implements OnModuleInit {
  private collection!: Collection<UserSchema>;

  constructor(private readonly mongo: MongoService) {}

  async onModuleInit(): Promise<void> {
    this.collection = this.mongo.getDb().collection<UserSchema>('users');
    await this.ensureSparseUniqueIndex('vkId');
    await this.ensureSparseUniqueIndex('yandexId');
    await this.collection.createIndex(
      { email: 1 },
      { unique: true, sparse: true },
    );
    await this.collection.createIndex(
      { phone: 1 },
      { unique: true, sparse: true },
    );
  }

  private async ensureSparseUniqueIndex(field: 'vkId' | 'yandexId'): Promise<void> {
    const indexName = `${field}_1`;
    const indexes = await this.collection.indexes();
    const existing = indexes.find((i) => i.name === indexName);
    if (existing && !existing.sparse) {
      await this.collection.dropIndex(indexName);
    }
    await this.collection.createIndex(
      { [field]: 1 },
      { unique: true, sparse: true },
    );
  }

  async findByVkId(vkId: string): Promise<UserDoc | null> {
    return this.collection.findOne({ vkId });
  }

  async upsertFromVk(data: VkUserUpsert): Promise<UserDoc> {
    const now = new Date().toISOString();
    const set: Partial<UserSchema> = {
      displayName: data.displayName,
      updatedAt: now,
    };
    if (data.avatarUrl) {
      set.avatarUrl = data.avatarUrl;
    }
    if (data.email) {
      set.email = data.email;
    }
    if (data.phone) {
      set.phone = data.phone;
    }

    const r = await this.collection.findOneAndUpdate(
      { vkId: data.vkId },
      {
        $set: set,
        $setOnInsert: {
          vkId: data.vkId,
          createdAt: now,
        },
      },
      { upsert: true, returnDocument: 'after' },
    );

    if (!r) {
      throw new Error('User upsert failed');
    }
    return r;
  }

  async create(data: {
    email?: string;
    phone?: string;
    passwordHash: string;
  }): Promise<UserDoc> {
    const now = new Date().toISOString();
    const doc: UserSchema = {
      passwordHash: data.passwordHash,
      createdAt: now,
      updatedAt: now,
    };
    if (data.email) {
      doc.email = data.email;
    }
    if (data.phone) {
      doc.phone = data.phone;
    }
    const r = await this.collection.insertOne(doc);
    const full = await this.collection.findOne({ _id: r.insertedId });
    if (!full) {
      throw new Error('User insert failed');
    }
    return full;
  }

  async findByLogin(login: string): Promise<UserDoc | null> {
    const q = login.trim();
    return this.collection.findOne({
      $or: [{ email: q }, { phone: q }],
    });
  }

  async upsertFromYandex(data: YandexUserUpsert): Promise<UserDoc> {
    const now = new Date().toISOString();
    const set: Partial<UserSchema> = {
      displayName: data.displayName,
      updatedAt: now,
    };
    if (data.avatarUrl) {
      set.avatarUrl = data.avatarUrl;
    }
    if (data.email) {
      set.email = data.email;
    }

    const r = await this.collection.findOneAndUpdate(
      { yandexId: data.yandexId },
      {
        $set: set,
        $setOnInsert: {
          yandexId: data.yandexId,
          createdAt: now,
        },
      },
      { upsert: true, returnDocument: 'after' },
    );

    if (!r) {
      throw new Error('User upsert failed');
    }
    return r;
  }

  async findById(id: string): Promise<UserDoc | null> {
    if (!ObjectId.isValid(id)) {
      return null;
    }
    return this.collection.findOne({ _id: new ObjectId(id) });
  }

  async existsEmail(email: string): Promise<boolean> {
    const n = await this.collection.countDocuments({ email });
    return n > 0;
  }

  async existsPhone(phone: string): Promise<boolean> {
    const n = await this.collection.countDocuments({ phone });
    return n > 0;
  }
}
