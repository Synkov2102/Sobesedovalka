import {
  BadRequestException,
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as bcrypt from 'bcrypt';
import { MongoServerError } from 'mongodb';
import type { RegisterDto } from './dto/register.dto';
import type { LoginDto } from './dto/login.dto';
import type { UserDoc } from './users.repository';
import { UsersRepository } from './users.repository';

export type AuthUserView = {
  id: string;
  email?: string;
  phone?: string;
};

export type AuthPayload = { accessToken: string; user: AuthUserView };

@Injectable()
export class AuthService {
  constructor(
    private readonly users: UsersRepository,
    private readonly jwt: JwtService,
  ) {}

  private toView(doc: UserDoc): AuthUserView {
    const id = String(doc._id);
    const out: AuthUserView = { id };
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
    if (!doc) {
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

  async getProfile(userId: string): Promise<AuthUserView> {
    const doc = await this.users.findById(userId);
    if (!doc) {
      throw new UnauthorizedException();
    }
    return this.toView(doc);
  }
}
