import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { MongoServerError } from 'mongodb';
import type { LoginDto } from './dto/login.dto';
import type { RegisterDto } from './dto/register.dto';
import type { VkLoginDto } from './dto/vk-login.dto';
import type { YandexLoginDto } from './dto/yandex-login.dto';
import type { UserDoc } from './users.repository';
import { UsersRepository } from './users.repository';
import { VkIdService } from './vk-id.service';
import { YandexOAuthService } from './yandex-oauth.service';

export type AuthUserView = {
  id: string;
  vkId?: string;
  yandexId?: string;
  displayName?: string;
  avatarUrl?: string;
  email?: string;
  phone?: string;
};

export type AuthPayload = { accessToken: string; user: AuthUserView };

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersRepository,
    private readonly jwt: JwtService,
    private readonly vk: VkIdService,
    private readonly yandex: YandexOAuthService,
  ) {}

  private toView(doc: UserDoc): AuthUserView {
    const out: AuthUserView = { id: String(doc._id) };
    if (doc.vkId) {
      out.vkId = doc.vkId;
    }
    if (doc.yandexId) {
      out.yandexId = doc.yandexId;
    }
    if (doc.displayName) {
      out.displayName = doc.displayName;
    }
    if (doc.avatarUrl) {
      out.avatarUrl = doc.avatarUrl;
    }
    if (doc.email) {
      out.email = doc.email;
    }
    if (doc.phone) {
      out.phone = doc.phone;
    }
    return out;
  }

  private signAccessToken(userId: string): string {
    return this.jwt.sign({ sub: userId });
  }

  async register(dto: RegisterDto): Promise<AuthPayload> {
    const email = dto.email?.trim() || undefined;
    const phone = dto.phone?.trim() || undefined;
    if (!email && !phone) {
      throw new BadRequestException('Укажите почту или номер телефона');
    }
    if (email && (await this.users.existsEmail(email))) {
      throw new ConflictException('Эта почта уже зарегистрирована');
    }
    if (phone && (await this.users.existsPhone(phone))) {
      throw new ConflictException('Этот номер уже зарегистрирован');
    }

    const passwordHash = await bcrypt.hash(dto.password, 10);
    try {
      const doc = await this.users.create({ email, phone, passwordHash });
      const user = this.toView(doc);
      return {
        accessToken: this.signAccessToken(user.id),
        user,
      };
    } catch (e) {
      if (e instanceof MongoServerError && e.code === 11000) {
        throw new ConflictException('Пользователь с такими данными уже есть');
      }
      throw e;
    }
  }

  async login(dto: LoginDto): Promise<AuthPayload> {
    const doc = await this.users.findByLogin(dto.login);
    if (!doc?.passwordHash) {
      throw new UnauthorizedException('Неверная почта, телефон или пароль');
    }
    const ok = await bcrypt.compare(dto.password, doc.passwordHash);
    if (!ok) {
      throw new UnauthorizedException('Неверная почта, телефон или пароль');
    }
    const user = this.toView(doc);
    return {
      accessToken: this.signAccessToken(user.id),
      user,
    };
  }

  async loginWithVk(dto: VkLoginDto): Promise<AuthPayload> {
    const tokens = await this.vk.exchangeCode({
      code: dto.code,
      deviceId: dto.deviceId,
      codeVerifier: dto.codeVerifier,
      state: dto.state,
      redirectUri: dto.redirectUri,
    });

    const profile = await this.vk.fetchUserProfile(tokens.access_token);
    if (tokens.user_id != null && String(tokens.user_id) !== profile.vkId) {
      throw new UnauthorizedException('Несовпадение идентификатора VK');
    }

    const doc = await this.users.upsertFromVk({
      vkId: profile.vkId,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      email: profile.email,
      phone: profile.phone,
    });

    const user = this.toView(doc);
    return {
      accessToken: this.signAccessToken(user.id),
      user,
    };
  }

  async loginWithYandex(dto: YandexLoginDto): Promise<AuthPayload> {
    const tokens = await this.yandex.exchangeCode({
      code: dto.code,
      codeVerifier: dto.codeVerifier,
    });
    const accessToken = tokens.access_token;
    if (!accessToken) {
      throw new UnauthorizedException('Яндекс не вернул access_token');
    }

    const profile = await this.yandex.fetchUserProfile(accessToken);

    const doc = await this.users.upsertFromYandex({
      yandexId: profile.yandexId,
      displayName: profile.displayName,
      avatarUrl: profile.avatarUrl,
      email: profile.email,
    });

    const user = this.toView(doc);
    return {
      accessToken: this.signAccessToken(user.id),
      user,
    };
  }

  async getProfile(userId: string): Promise<AuthUserView> {
    const doc = await this.users.findById(userId);
    if (!doc) {
      throw new UnauthorizedException();
    }
    return this.toView(doc);
  }
}
