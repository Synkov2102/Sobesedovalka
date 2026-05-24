import type { Response } from 'express';

/** srcDoc preview iframes have origin `null`; module scripts require CORS. */
export function setPreviewProxyCorsHeaders(res: Response): void {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Cross-Origin-Resource-Policy', 'cross-origin');
}
