import { Module } from '@nestjs/common';
import { CollabGateway } from './collab.gateway';
import { CollabMongoRepository } from './collab-mongo.repository';

@Module({
  providers: [CollabMongoRepository, CollabGateway],
  exports: [CollabMongoRepository],
})
export class CollabModule {}
