import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { Db, MongoClient } from 'mongodb';

@Injectable()
export class MongoService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(MongoService.name);
  private client: MongoClient | null = null;
  private db: Db | null = null;

  async onModuleInit(): Promise<void> {
    const uri = process.env.MONGODB_URI?.trim();
    if (!uri) {
      throw new Error(
        'MONGODB_URI is required. Copy backend/.env.example to backend/.env and set a connection string.',
      );
    }

    this.client = new MongoClient(uri);
    await this.client.connect();
    const name = process.env.MONGODB_DB?.trim();
    this.db = name ? this.client.db(name) : this.client.db();
    this.logger.log('MongoDB connected');
  }

  async onModuleDestroy(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.client = null;
      this.db = null;
      this.logger.log('MongoDB connection closed');
    }
  }

  isConnected(): boolean {
    return this.db !== null;
  }

  /** Default database from URI, or MONGODB_DB when set. */
  getDb(): Db {
    if (!this.db) {
      throw new Error(
        'MongoDB is not connected (set MONGODB_URI or wait for startup)',
      );
    }
    return this.db;
  }

  getClient(): MongoClient {
    if (!this.client) {
      throw new Error('MongoDB client is not available');
    }
    return this.client;
  }

  async ping(): Promise<void> {
    await this.getDb().command({ ping: 1 });
  }
}
