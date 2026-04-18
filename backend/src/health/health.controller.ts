import { Controller, Get } from '@nestjs/common';
import { MongoService } from '../mongo/mongo.service';

@Controller('health')
export class HealthController {
  constructor(private readonly mongo: MongoService) {}

  @Get()
  async health() {
    let mongo: 'up' | 'down' = 'down';
    if (this.mongo.isConnected()) {
      try {
        await this.mongo.ping();
        mongo = 'up';
      } catch {
        mongo = 'down';
      }
    }
    return { ok: true, service: 'live-coding-api', mongo };
  }
}
