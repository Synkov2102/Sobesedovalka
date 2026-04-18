import { Test, type TestingModule } from '@nestjs/testing';
import { MongoService } from '../mongo/mongo.service';
import { HealthController } from './health.controller';

describe('HealthController', () => {
  let controller: HealthController;

  it('mongo up when connected and ping succeeds', async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: MongoService,
          useValue: {
            isConnected: () => true,
            ping: () => Promise.resolve(),
          },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    await expect(controller.health()).resolves.toEqual({
      ok: true,
      service: 'live-coding-api',
      mongo: 'up',
    });
  });

  it('mongo down when not connected', async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: MongoService,
          useValue: {
            isConnected: () => false,
            ping: () => Promise.resolve(),
          },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    await expect(controller.health()).resolves.toEqual({
      ok: true,
      service: 'live-coding-api',
      mongo: 'down',
    });
  });

  it('mongo down when connected but ping fails', async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [HealthController],
      providers: [
        {
          provide: MongoService,
          useValue: {
            isConnected: () => true,
            ping: () => Promise.reject(new Error('unreachable')),
          },
        },
      ],
    }).compile();

    controller = module.get<HealthController>(HealthController);
    await expect(controller.health()).resolves.toEqual({
      ok: true,
      service: 'live-coding-api',
      mongo: 'down',
    });
  });
});
