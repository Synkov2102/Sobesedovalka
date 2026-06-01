import {
  Injectable,
  InternalServerErrorException,
  UnauthorizedException,
} from '@nestjs/common';

const VK_TOKEN_URL = 'https://id.vk.ru/oauth2/auth';
const VK_USER_INFO_URL = 'https://id.vk.ru/oauth2/user_info';

export type VkTokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in?: number;
  user_id?: number;
  error?: string;
  error_description?: string;
};

export type VkUserInfoResponse = {
  user?: {
    user_id: string;
    first_name?: string;
    last_name?: string;
    avatar?: string;
    email?: string;
    phone?: string;
  };
  error?: string;
  error_description?: string;
};

export type VkProfile = {
  vkId: string;
  displayName: string;
  avatarUrl?: string;
  email?: string;
  phone?: string;
};

@Injectable()
export class VkIdService {
  private clientId(): string {
    const id = process.env.VK_CLIENT_ID?.trim();
    if (!id) {
      throw new InternalServerErrorException(
        'VK_CLIENT_ID не задан (см. backend/.env.example)',
      );
    }
    return id;
  }

  redirectUri(): string {
    const uri = process.env.VK_REDIRECT_URI?.trim();
    if (!uri) {
      throw new InternalServerErrorException(
        'VK_REDIRECT_URI не задан (см. backend/.env.example)',
      );
    }
    return uri;
  }

  async exchangeCode(params: {
    code: string;
    deviceId: string;
    codeVerifier: string;
    state?: string;
  }): Promise<VkTokenResponse> {
    const body = new URLSearchParams({
      grant_type: 'authorization_code',
      code: params.code,
      code_verifier: params.codeVerifier,
      client_id: this.clientId(),
      device_id: params.deviceId,
      redirect_uri: this.redirectUri(),
    });
    if (params.state?.trim()) {
      body.set('state', params.state.trim());
    }

    const res = await fetch(VK_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const data = (await res.json()) as VkTokenResponse;
    if (!res.ok || data.error || !data.access_token) {
      const msg =
        data.error_description ?? data.error ?? 'Не удалось обменять код VK ID';
      throw new UnauthorizedException(msg);
    }
    return data;
  }

  async fetchUserProfile(accessToken: string): Promise<VkProfile> {
    const body = new URLSearchParams({
      client_id: this.clientId(),
      access_token: accessToken,
    });

    const res = await fetch(VK_USER_INFO_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body,
    });

    const data = (await res.json()) as VkUserInfoResponse;
    if (!res.ok || data.error || !data.user?.user_id) {
      const msg =
        data.error_description ?? data.error ?? 'Не удалось получить профиль VK';
      throw new UnauthorizedException(msg);
    }

    const u = data.user;
    const parts = [u.first_name?.trim(), u.last_name?.trim()].filter(Boolean);
    const displayName = parts.join(' ') || `VK ${u.user_id}`;

    const profile: VkProfile = {
      vkId: String(u.user_id),
      displayName,
    };
    const avatar = u.avatar?.trim();
    if (avatar) {
      profile.avatarUrl = avatar;
    }
    const email = u.email?.trim();
    if (email) {
      profile.email = email;
    }
    const phone = u.phone?.trim();
    if (phone) {
      profile.phone = phone;
    }
    return profile;
  }
}
