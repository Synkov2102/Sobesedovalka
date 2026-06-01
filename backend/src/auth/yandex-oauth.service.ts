import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';

const YANDEX_TOKEN_URL = 'https://oauth.yandex.com/token';
const YANDEX_USER_INFO_URL = 'https://login.yandex.ru/info?format=json';

export type YandexTokenResponse = {
  access_token?: string;
  expires_in?: number;
  refresh_token?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
};

export type YandexUserInfo = {
  id: string;
  login?: string;
  real_name?: string;
  first_name?: string;
  last_name?: string;
  default_email?: string;
  default_avatar_id?: string;
  is_avatar_empty?: boolean;
};

export type YandexProfile = {
  yandexId: string;
  displayName: string;
  avatarUrl?: string;
  email?: string;
};

@Injectable()
export class YandexOAuthService {
  private clientId(): string {
    const id = process.env.YANDEX_CLIENT_ID?.trim();
    if (!id) {
      throw new InternalServerErrorException(
        'YANDEX_CLIENT_ID не задан (см. backend/.env.example)',
      );
    }
    return id;
  }

  private clientSecret(): string {
    const secret = process.env.YANDEX_CLIENT_SECRET?.trim();
    if (!secret) {
      throw new InternalServerErrorException(
        'YANDEX_CLIENT_SECRET не задан (см. backend/.env.example)',
      );
    }
    return secret;
  }

  redirectUri(): string {
    const uri = process.env.YANDEX_REDIRECT_URI?.trim();
    if (!uri) {
      throw new InternalServerErrorException(
        'YANDEX_REDIRECT_URI не задан (см. backend/.env.example)',
      );
    }
    return uri;
  }

  async exchangeCode(params: {
    code: string;
    codeVerifier: string;
  }): Promise<YandexTokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: params.code,
      code_verifier: params.codeVerifier,
      redirect_uri: this.redirectUri(),
    });

    const basic = Buffer.from(
      `${this.clientId()}:${this.clientSecret()}`,
    ).toString('base64');

    const res = await fetch(YANDEX_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        Authorization: `Basic ${basic}`,
      },
      body,
    });

    const data = (await res.json()) as YandexTokenResponse;
    if (!res.ok || data.error || !data.access_token) {
      const msg =
        data.error_description ??
        data.error ??
        'Не удалось обменять код Яндекс OAuth';
      throw new UnauthorizedException(msg);
    }
    return data;
  }

  async fetchUserProfile(accessToken: string): Promise<YandexProfile> {
    const res = await fetch(YANDEX_USER_INFO_URL, {
      headers: { Authorization: `OAuth ${accessToken}` },
    });

    const data = (await res.json()) as YandexUserInfo & {
      error?: string;
      error_description?: string;
    };

    if (!res.ok || data.error || !data.id) {
      const msg =
        data.error_description ??
        data.error ??
        'Не удалось получить профиль Яндекса';
      throw new UnauthorizedException(msg);
    }

    const parts = [data.first_name?.trim(), data.last_name?.trim()].filter(
      Boolean,
    );
    const displayName =
      data.real_name?.trim() ||
      parts.join(' ') ||
      data.login?.trim() ||
      `Yandex ${data.id}`;

    const profile: YandexProfile = {
      yandexId: String(data.id),
      displayName,
    };

    const email = data.default_email?.trim();
    if (email) {
      profile.email = email;
    }

    if (!data.is_avatar_empty && data.default_avatar_id?.trim()) {
      profile.avatarUrl = `https://avatars.yandex.net/get-yapic/${data.default_avatar_id.trim()}/islands-200`;
    }

    return profile;
  }
}
