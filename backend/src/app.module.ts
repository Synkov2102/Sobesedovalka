import { Module } from '@nestjs/common';
import { AuthModule } from './auth/auth.module';
import { CollabModule } from './collab/collab.module';
import { HealthModule } from './health/health.module';
import { MongoModule } from './mongo/mongo.module';
import { TasksModule } from './tasks/tasks.module';

@Module({
  imports: [
    MongoModule,
    AuthModule,
    HealthModule,
    TasksModule,
    CollabModule,
  ],
})
export class AppModule {}
