import { Test, type TestingModule } from '@nestjs/testing';
import { type INestApplication } from '@nestjs/common';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { type App } from 'supertest/types';
import { AppModule } from './../src/app.module';

describe('App (e2e)', () => {
  let app: INestApplication<App>;
  let mongod: MongoMemoryServer;

  beforeAll(async () => {
    mongod = await MongoMemoryServer.create();
    process.env.MONGODB_URI = mongod.getUri();
  });

  afterAll(async () => {
    await mongod?.stop();
  });

  beforeEach(async () => {
    const moduleFixture: TestingModule = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();

    app = moduleFixture.createNestApplication();
    app.setGlobalPrefix('api');
    await app.init();
  });

  it('/api/health (GET)', () => {
    return request(app.getHttpServer())
      .get('/api/health')
      .expect(200)
      .expect((res) => {
        expect(res.body).toMatchObject({
          ok: true,
          service: 'live-coding-api',
          mongo: 'up',
        });
      });
  });

  afterEach(async () => {
    await app.close();
  });
});
