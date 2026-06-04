import { BadRequestException } from '@nestjs/common';

function originOf(url: string): string | null {
  try {
    return new URL(url).origin;
  } catch {
    return null;
  }
}

/** Origins, с которых разрешён redirect при обмене OAuth-кода. */
export function trustedOAuthRedirectOrigins(): Set<string> {
  const out = new Set<string>();

  for (const key of ['VK_REDIRECT_URI', 'YANDEX_REDIRECT_URI'] as const) {
    const raw = process.env[key]?.trim();
    if (!raw) {
      continue;
    }
    const o = originOf(raw);
    if (o) {
      out.add(o);
    }
  }

  const cors = process.env.CORS_ORIGIN?.trim() ?? '';
  if (cors && cors !== '*') {
    for (const part of cors.split(',')) {
      const t = part.trim();
      if (!t) {
        continue;
      }
      const o = originOf(t.startsWith('http') ? t : `https://${t}`);
      if (o) {
        out.add(o);
      }
    }
  }

  return out;
}

/** redirect_uri для обмена кода: из запроса клиента, если origin доверенный. */
export function resolveOAuthRedirectUri(
  configured: string,
  fromClient: string | undefined,
  label: string,
): string {
  const cfg = configured.trim();
  if (!cfg) {
    throw new BadRequestException(`${label} не настроен на сервере`);
  }

  const client = fromClient?.trim();
  if (!client) {
    return cfg;
  }

  const cfgOrigin = originOf(cfg);
  const clientOrigin = originOf(client);
  if (!clientOrigin) {
    throw new BadRequestException(`Некорректный redirect_uri (${label})`);
  }

  if (client === cfg || clientOrigin === cfgOrigin) {
    return client;
  }

  const trusted = trustedOAuthRedirectOrigins();
  if (trusted.has(clientOrigin)) {
    return client;
  }

  throw new BadRequestException(
    `redirect_uri не совпадает с ${label} на сервере (ожидается ${cfgOrigin ?? cfg})`,
  );
}
