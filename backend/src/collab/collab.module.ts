import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CollabGateway } from './collab.gateway';
import { CollabMongoRepository } from './collab-mongo.repository';
import { CollabRoomsController } from './collab-rooms.controller';
import { CollabRoomsService } from './collab-rooms.service';

@Module({
  imports: [AuthModule],
  controllers: [CollabRoomsController],
  providers: [CollabMongoRepository, CollabRoomsService, CollabGateway],
  exports: [CollabMongoRepository],
})
export class CollabModule {}
