import { Module } from '@nestjs/common';
import { PreviewProxyController } from './preview-proxy.controller';
import { PreviewProxyService } from './preview-proxy.service';

@Module({
  controllers: [PreviewProxyController],
  providers: [PreviewProxyService],
})
export class PreviewProxyModule {}
