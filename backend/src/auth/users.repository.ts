import { Injectable, OnModuleInit } from '@nestjs/common';
import type { Collection, WithId } from 'mongodb';
import { ObjectId } from 'mongodb';
import { MongoService } from '../mongo/mongo.service';

type UserSchema = {
  email?: string;
  phone?: string;
  passwordHash: string;
  createdAt: string;
};

export type UserDoc = WithId<UserSchema>;

@Injectable()
export class UsersRepository implements OnModuleInit {
  private collection!: Collection<UserSchema>;

  constructor(private readonly mongo: MongoService) {}

  async onModuleInit(): Promise<void> {
    this.collection = this.mongo.getDb().collection<UserSchema>('users');
    await this.collection.createIndex(
      { email: 1 },
      { unique: true, sparse: true },
    );
    await this.collection.createIndex(
      { phone: 1 },
      { unique: true, sparse: true },
    );
  }

  async create(data: {
    email?: string;
    phone?: string;
    passwordHash: string;
  }): Promise<UserDoc> {
    const doc: UserSchema = {
      passwordHash: data.passwordHash,
      createdAt: new Date().toISOString(),
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
