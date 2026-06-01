import { Body, Controller, Get, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { readOAuthPublicConfig } from './oauth-public-config';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RegisterDto } from './dto/register.dto';
import { VkLoginDto } from './dto/vk-login.dto';
import { YandexLoginDto } from './dto/yandex-login.dto';
import { JwtAuthGuard, type RequestUser } from './jwt-auth.guard';

@Controller('auth')
export class AuthController {
  constructor(private readonly auth: AuthService) {}

  @Get('public-config')
  publicConfig() {
    return readOAuthPublicConfig();
  }

  @Post('register')
  register(@Body() dto: RegisterDto) {
    return this.auth.register(dto);
  }

  @Post('login')
  login(@Body() dto: LoginDto) {
    return this.auth.login(dto);
  }

  @Post('vk')
  loginWithVk(@Body() dto: VkLoginDto) {
    return this.auth.loginWithVk(dto);
  }

  @Post('yandex')
  loginWithYandex(@Body() dto: YandexLoginDto) {
    return this.auth.loginWithYandex(dto);
  }

  @Get('me')
  @UseGuards(JwtAuthGuard)
  me(@Req() req: Request & { user: RequestUser }) {
    return this.auth.getProfile(req.user.userId);
  }
}
