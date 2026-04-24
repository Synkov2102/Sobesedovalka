import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { CollabModule } from '../collab/collab.module';
import { TaskPresetsController } from './task-presets.controller';
import { TaskPresetsRepository } from './task-presets.repository';
import { TaskPresetsService } from './task-presets.service';

@Module({
  imports: [AuthModule, CollabModule],
  controllers: [TaskPresetsController],
  providers: [TaskPresetsRepository, TaskPresetsService],
})
export class TaskPresetsModule {}
