import {
  BadRequestException,
  Controller,
  Delete,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard, type RequestUser } from '../auth/jwt-auth.guard';
import { CollabRoomsService } from './collab-rooms.service';

type AuthedRequest = Request & { user: RequestUser };

function normalizeCollabRoomIdParam(raw: string): string | null {
  const s = decodeURIComponent(raw ?? '').trim();
  const safe = s.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 64);
  return safe.length > 0 ? safe : null;
}

@Controller('collab-rooms')
@UseGuards(JwtAuthGuard)
export class CollabRoomsController {
  constructor(private readonly service: CollabRoomsService) {}

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.service.listMine(req.user.userId);
  }

  @Post()
  create(@Req() req: AuthedRequest) {
    return this.service.createBlank(req.user.userId);
  }

  @Delete(':roomId')
  async remove(
    @Req() req: AuthedRequest,
    @Param('roomId') roomIdRaw: string,
  ): Promise<{ ok: true }> {
    const roomId = normalizeCollabRoomIdParam(roomIdRaw);
    if (!roomId) {
      throw new BadRequestException('Некорректный идентификатор комнаты');
    }
    const result = await this.service.deleteMine(roomId, req.user.userId);
    if (result === 'not_found') {
      throw new NotFoundException('Комната не найдена');
    }
    if (result === 'forbidden') {
      throw new ForbiddenException('Нет прав на удаление этой комнаты');
    }
    return { ok: true };
  }
}
