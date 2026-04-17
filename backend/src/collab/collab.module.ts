import { Module } from '@nestjs/common';
import { CollabGateway } from './collab.gateway';
import { CollabPersistenceService } from './collab-persistence.service';

@Module({
  providers: [CollabPersistenceService, CollabGateway],
})
export class CollabModule {}
