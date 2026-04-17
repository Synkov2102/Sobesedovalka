import { Module } from '@nestjs/common';
import { CollabModule } from './collab/collab.module';
import { HealthModule } from './health/health.module';
import { TasksModule } from './tasks/tasks.module';

@Module({
  imports: [HealthModule, TasksModule, CollabModule],
})
export class AppModule {}
