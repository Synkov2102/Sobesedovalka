import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard, type RequestUser } from '../auth/jwt-auth.guard';
import { CreateTaskPresetDto } from './dto/create-task-preset.dto';
import { UpdateTaskPresetDto } from './dto/update-task-preset.dto';
import { TaskPresetsService } from './task-presets.service';

type AuthedRequest = Request & { user: RequestUser };

@Controller('task-presets')
@UseGuards(JwtAuthGuard)
export class TaskPresetsController {
  constructor(private readonly service: TaskPresetsService) {}

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.service.list(req.user.userId);
  }

  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreateTaskPresetDto) {
    return this.service.create(req.user.userId, dto);
  }

  @Patch(':id')
  update(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Body() dto: UpdateTaskPresetDto,
  ) {
    return this.service.update(req.user.userId, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() req: AuthedRequest, @Param('id') id: string) {
    await this.service.remove(req.user.userId, id);
  }

  @Post(':id/start-room')
  startRoom(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.startRoom(req.user.userId, id);
  }
}
