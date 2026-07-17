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
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { UpdateMemberRoleDto } from './dto/update-member-role.dto';
import { OrganizationsService } from './organizations.service';

type AuthedRequest = Request & { user: RequestUser };

@Controller('organizations')
@UseGuards(JwtAuthGuard)
export class OrganizationsController {
  constructor(private readonly service: OrganizationsService) {}

  @Post()
  create(@Req() req: AuthedRequest, @Body() dto: CreateOrganizationDto) {
    return this.service.create(req.user.userId, dto);
  }

  @Get()
  list(@Req() req: AuthedRequest) {
    return this.service.listForUser(req.user.userId);
  }

  @Get('invites/:token')
  previewInvite(@Req() req: AuthedRequest, @Param('token') token: string) {
    return this.service.previewInvite(req.user.userId, token);
  }

  @Post('invites/:token/accept')
  acceptInvite(@Req() req: AuthedRequest, @Param('token') token: string) {
    return this.service.acceptInvite(req.user.userId, token);
  }

  @Get(':id')
  getOne(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.getDetail(req.user.userId, id);
  }

  @Post(':id/invites')
  createInvite(@Req() req: AuthedRequest, @Param('id') id: string) {
    return this.service.createInvite(req.user.userId, id);
  }

  @Delete(':id/invites/:inviteId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async revokeInvite(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Param('inviteId') inviteId: string,
  ) {
    await this.service.revokeInvite(req.user.userId, id, inviteId);
  }

  @Patch(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async updateMemberRole(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Param('userId') userId: string,
    @Body() dto: UpdateMemberRoleDto,
  ) {
    await this.service.updateMemberRole(
      req.user.userId,
      id,
      userId,
      dto.role,
    );
  }

  @Delete(':id/members/:userId')
  @HttpCode(HttpStatus.NO_CONTENT)
  async removeMember(
    @Req() req: AuthedRequest,
    @Param('id') id: string,
    @Param('userId') targetUserId: string,
  ) {
    await this.service.removeMember(req.user.userId, id, targetUserId);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  async remove(@Req() req: AuthedRequest, @Param('id') id: string) {
    await this.service.deleteOrganization(req.user.userId, id);
  }
}
