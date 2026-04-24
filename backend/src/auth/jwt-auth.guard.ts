import {
  CanActivate,
  ExecutionContext,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { Request } from 'express';

export type RequestUser = { userId: string };

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(private readonly jwt: JwtService) {}

  canActivate(context: ExecutionContext): boolean {
    const req = context.switchToHttp().getRequest<Request & { user?: RequestUser }>();
    const token = this.extractBearer(req.headers.authorization);
    if (!token) {
      throw new UnauthorizedException();
    }
    try {
      const payload = this.jwt.verify<{ sub?: string }>(token);
      const sub = typeof payload.sub === 'string' ? payload.sub : '';
      if (!sub) {
        throw new UnauthorizedException();
      }
      req.user = { userId: sub };
      return true;
    } catch {
      throw new UnauthorizedException();
    }
  }

  private extractBearer(header: string | undefined): string | undefined {
    if (!header) {
      return undefined;
    }
    const [type, token] = header.split(' ');
    return type === 'Bearer' && token ? token : undefined;
  }
}
