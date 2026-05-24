import {
  BadRequestException,
  GatewayTimeoutException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import { setPreviewProxyCorsHeaders } from './preview-proxy.cors';
import {
  ensureEsmDevQuery,
  rewriteEsmShUrls,
  shouldRewriteBody,
} from './preview-proxy.rewrite';

const ESM_ORIGIN = 'https://esm.sh';
const FETCH_TIMEOUT_MS = 20_000;
const PROXY_PREFIX = '/api/preview-proxy';

@Injectable()
export class PreviewProxyService {
  esmPathFromRequest(req: Request): string {
    const pathname = req.path;
    if (!pathname.startsWith(`${PROXY_PREFIX}/`)) {
      throw new BadRequestException('Missing preview proxy path');
    }
    const sub = pathname.slice(`${PROXY_PREFIX}/`.length);
    if (!sub || sub.includes('..')) {
      throw new BadRequestException('Invalid preview proxy path');
    }
    return sub;
  }

  async forward(req: Request, res: Response): Promise<void> {
    setPreviewProxyCorsHeaders(res);
    const esmPath = this.esmPathFromRequest(req);
    const target = new URL(`${ESM_ORIGIN}/${esmPath}`);
    const query = req.query as Record<string, string | string[] | undefined>;
    for (const [key, value] of Object.entries(query)) {
      if (value === undefined) {
        continue;
      }
      if (Array.isArray(value)) {
        for (const item of value) {
          target.searchParams.append(key, item);
        }
      } else {
        target.searchParams.set(key, value);
      }
    }
    ensureEsmDevQuery(target);

    let upstream: globalThis.Response;
    try {
      upstream = await fetch(target, {
        method: 'GET',
        headers: {
          accept: req.header('accept') ?? '*/*',
          'user-agent': req.header('user-agent') ?? 'Sobesedovalka-preview-proxy',
        },
        redirect: 'follow',
        signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
      });
    } catch (error) {
      if (error instanceof Error && error.name === 'TimeoutError') {
        throw new GatewayTimeoutException('Preview CDN request timed out');
      }
      throw new ServiceUnavailableException('Preview CDN is unavailable');
    }

    res.status(upstream.status);
    const contentType = upstream.headers.get('content-type');
    if (contentType) {
      res.setHeader('content-type', contentType);
    }
    const cacheControl = upstream.headers.get('cache-control');
    if (cacheControl) {
      res.setHeader('cache-control', cacheControl);
    }

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    if (!shouldRewriteBody(contentType)) {
      const buffer = Buffer.from(await upstream.arrayBuffer());
      res.send(buffer);
      return;
    }

    const text = await upstream.text();
    res.send(rewriteEsmShUrls(text, PROXY_PREFIX));
  }
}
