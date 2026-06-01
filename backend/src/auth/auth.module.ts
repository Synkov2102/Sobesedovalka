import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import { UsersRepository } from './users.repository';
import { VkIdService } from './vk-id.service';
import { YandexOAuthService } from './yandex-oauth.service';

@Module({
  imports: [
    JwtModule.registerAsync({
      useFactory: () => {
        const secret = process.env.JWT_SECRET?.trim();
        if (!secret) {
          throw new Error(
            'JWT_SECRET is required (set in backend/.env, see .env.example)',
          );
        }
        return {
          secret,
          signOptions: { expiresIn: '7d' },
        };
      },
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    UsersRepository,
    VkIdService,
    YandexOAuthService,
    JwtAuthGuard,
  ],
  exports: [JwtModule, JwtAuthGuard, UsersRepository],
})
export class AuthModule {}
