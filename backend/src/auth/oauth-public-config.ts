export type OAuthPublicConfig = {
  vkAppId: number | null;
  vkRedirectUri?: string;
  yandexClientId?: string;
  yandexRedirectUri?: string;
};

function parseVkAppId(raw: string | undefined): number | null {
  const id = raw?.trim();
  if (!id || !/^\d+$/.test(id)) {
    return null;
  }
  const n = Number(id);
  return Number.isFinite(n) && n > 0 ? n : null;
}

export function readOAuthPublicConfig(): OAuthPublicConfig {
  const vkRedirectUri = process.env.VK_REDIRECT_URI?.trim();
  const yandexRedirectUri = process.env.YANDEX_REDIRECT_URI?.trim();
  const yandexClientId = process.env.YANDEX_CLIENT_ID?.trim();

  const out: OAuthPublicConfig = {
    vkAppId: parseVkAppId(process.env.VK_CLIENT_ID),
  };

  if (vkRedirectUri) {
    out.vkRedirectUri = vkRedirectUri;
  }
  if (yandexClientId) {
    out.yandexClientId = yandexClientId;
  }
  if (yandexRedirectUri) {
    out.yandexRedirectUri = yandexRedirectUri;
  }

  return out;
}
