import { All, Controller, Req, Res } from '@nestjs/common';
import type { Request, Response } from 'express';
import { setPreviewProxyCorsHeaders } from './preview-proxy.cors';
import { PreviewProxyService } from './preview-proxy.service';

@Controller('preview-proxy')
export class PreviewProxyController {
  constructor(private readonly previewProxy: PreviewProxyService) {}

  @All('*path')
  proxy(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    setPreviewProxyCorsHeaders(res);
    if (req.method === 'OPTIONS') {
      res.status(204).end();
      return Promise.resolve();
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.status(405).end();
      return Promise.resolve();
    }
    return this.previewProxy.forward(req, res);
  }
}
