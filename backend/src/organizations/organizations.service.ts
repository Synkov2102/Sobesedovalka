import {
  BadRequestException,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { UsersRepository } from '../auth/users.repository';
import { corsOriginFromEnv } from '../cors-env';
import { TaskPresetsRepository } from '../task-presets/task-presets.repository';
import { CreateOrganizationDto } from './dto/create-organization.dto';
import { OrganizationsRepository } from './organizations.repository';
import type {
  InvitePreviewView,
  OrganizationDetailView,
  OrganizationInviteDoc,
  OrganizationListItem,
  OrganizationMemberDoc,
} from './organizations.types';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000;

@Injectable()
export class OrganizationsService {
  constructor(
    private readonly repo: OrganizationsRepository,
    private readonly users: UsersRepository,
    @Inject(forwardRef(() => TaskPresetsRepository))
    private readonly presetsRepo: TaskPresetsRepository,
  ) {}

  async create(
    userId: string,
    dto: CreateOrganizationDto,
  ): Promise<OrganizationListItem> {
    const now = new Date().toISOString();
    const orgId = randomUUID();
    await this.repo.createOrganization({
      _id: orgId,
      name: dto.name,
      ownerUserId: userId,
      createdAt: now,
      updatedAt: now,
    });
    await this.repo.createMember({
      _id: randomUUID(),
      organizationId: orgId,
      userId,
      role: 'owner',
      createdAt: now,
    });
    return {
      id: orgId,
      name: dto.name,
      role: 'owner',
      createdAt: now,
      updatedAt: now,
    };
  }

  async listForUser(userId: string): Promise<OrganizationListItem[]> {
    const memberships = await this.repo.listMembershipsForUser(userId);
    if (memberships.length === 0) {
      return [];
    }
    const orgs = await this.repo.findOrganizationsByIds(
      memberships.map((m) => m.organizationId),
    );
    const byId = new Map(orgs.map((o) => [o._id, o]));
    const roleByOrg = new Map(
      memberships.map((m) => [m.organizationId, m.role]),
    );
    return memberships
      .map((m) => {
        const org = byId.get(m.organizationId);
        if (!org) {
          return null;
        }
        return {
          id: org._id,
          name: org.name,
          role: roleByOrg.get(org._id) ?? m.role,
          createdAt: org.createdAt,
          updatedAt: org.updatedAt,
        };
      })
      .filter((item): item is OrganizationListItem => item !== null)
      .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  }

  async getDetail(
    userId: string,
    organizationId: string,
  ): Promise<OrganizationDetailView> {
    const membership = await this.assertMember(organizationId, userId);
    const org = await this.repo.findOrganizationById(organizationId);
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const members = await this.repo.listMembers(organizationId);
    const memberViews = await Promise.all(
      members.map(async (m) => {
        const user = await this.users.findById(m.userId);
        return {
          userId: m.userId,
          role: m.role,
          displayName: user?.displayName ?? user?.email ?? null,
          createdAt: m.createdAt,
        };
      }),
    );

    const pending = await this.repo.listPendingInvites(organizationId);
    const canSeeInvites =
      membership.role === 'owner' || membership.role === 'admin';
    const now = Date.now();

    return {
      id: org._id,
      name: org.name,
      role: membership.role,
      ownerUserId: org.ownerUserId,
      members: memberViews,
      pendingInvites: canSeeInvites
        ? pending
            .filter((inv) => Date.parse(inv.expiresAt) > now)
            .map((inv) => ({
              id: inv._id,
              status: inv.status,
              expiresAt: inv.expiresAt,
              createdAt: inv.createdAt,
              createdByUserId: inv.createdByUserId,
            }))
        : [],
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
    };
  }

  async createInvite(
    userId: string,
    organizationId: string,
  ): Promise<{ inviteId: string; inviteUrl: string; expiresAt: string }> {
    await this.assertCanInvite(organizationId, userId);
    const org = await this.repo.findOrganizationById(organizationId);
    if (!org) {
      throw new NotFoundException('Organization not found');
    }

    const rawToken = randomBytes(32).toString('base64url');
    const tokenHash = hashInviteToken(rawToken);
    const now = new Date();
    const expiresAt = new Date(now.getTime() + INVITE_TTL_MS).toISOString();
    const inviteId = randomUUID();

    await this.repo.createInvite({
      _id: inviteId,
      organizationId,
      tokenHash,
      createdByUserId: userId,
      status: 'pending',
      expiresAt,
      createdAt: now.toISOString(),
    });

    return {
      inviteId,
      inviteUrl: buildInviteUrl(rawToken),
      expiresAt,
    };
  }

  async revokeInvite(
    userId: string,
    organizationId: string,
    inviteId: string,
  ): Promise<void> {
    await this.assertCanInvite(organizationId, userId);
    const revoked = await this.repo.revokeInvite(organizationId, inviteId);
    if (!revoked) {
      throw new NotFoundException('Invite not found');
    }
  }

  async previewInvite(
    userId: string,
    token: string,
  ): Promise<InvitePreviewView> {
    const invite = await this.findInviteByRawToken(token);
    const org = await this.repo.findOrganizationById(invite.organizationId);
    if (!org) {
      throw new NotFoundException('Organization not found');
    }
    const member = await this.repo.findMember(invite.organizationId, userId);
    return {
      organizationName: org.name,
      status: this.effectiveInviteStatus(invite),
      expiresAt: invite.expiresAt,
      alreadyMember: member !== null,
    };
  }

  async acceptInvite(
    userId: string,
    token: string,
  ): Promise<{ organizationId: string }> {
    const invite = await this.findInviteByRawToken(token);
    const status = this.effectiveInviteStatus(invite);
    if (status !== 'pending') {
      throw new BadRequestException(
        status === 'used'
          ? 'Invite already used'
          : status === 'revoked'
            ? 'Invite revoked'
            : 'Invite expired',
      );
    }

    const existing = await this.repo.findMember(invite.organizationId, userId);
    const marked = await this.repo.markInviteUsed(
      invite._id,
      userId,
      new Date().toISOString(),
    );
    if (!marked) {
      throw new BadRequestException('Invite already used');
    }

    if (!existing) {
      await this.repo.createMember({
        _id: randomUUID(),
        organizationId: invite.organizationId,
        userId,
        role: 'member',
        createdAt: new Date().toISOString(),
      });
    }

    return { organizationId: invite.organizationId };
  }

  async updateMemberRole(
    actorUserId: string,
    organizationId: string,
    targetUserId: string,
    role: 'admin' | 'member',
  ): Promise<void> {
    const actor = await this.assertMember(organizationId, actorUserId);
    if (actor.role !== 'owner') {
      throw new ForbiddenException('Only owner can change roles');
    }

    const target = await this.repo.findMember(organizationId, targetUserId);
    if (!target) {
      throw new NotFoundException('Member not found');
    }
    if (target.role === 'owner') {
      throw new ForbiddenException('Cannot change owner role');
    }

    await this.repo.updateMemberRole(organizationId, targetUserId, role);
  }

  async removeMember(
    actorUserId: string,
    organizationId: string,
    targetUserId: string,
  ): Promise<void> {
    const actor = await this.assertMember(organizationId, actorUserId);
    const target = await this.repo.findMember(organizationId, targetUserId);
    if (!target) {
      throw new NotFoundException('Member not found');
    }

    this.assertCanRemoveMember(actor, target);

    await this.repo.deleteMember(organizationId, targetUserId);
  }

  async deleteOrganization(
    userId: string,
    organizationId: string,
  ): Promise<void> {
    const membership = await this.assertMember(organizationId, userId);
    if (membership.role !== 'owner') {
      throw new ForbiddenException('Only owner can delete organization');
    }

    const deleted = await this.repo.deleteOrganization(organizationId);
    if (!deleted) {
      throw new NotFoundException('Organization not found');
    }

    await this.repo.deleteAllMembers(organizationId);
    await this.repo.deletePendingInvites(organizationId);
    await this.presetsRepo.detachOrganization(organizationId);
  }

  /** Public ACL helpers for other modules. */
  async assertMember(
    organizationId: string,
    userId: string,
  ): Promise<OrganizationMemberDoc> {
    const member = await this.repo.findMember(organizationId, userId);
    if (!member) {
      throw new ForbiddenException('Not a member of this organization');
    }
    return member;
  }

  async assertCanInvite(
    organizationId: string,
    userId: string,
  ): Promise<OrganizationMemberDoc> {
    const member = await this.assertMember(organizationId, userId);
    if (member.role !== 'owner' && member.role !== 'admin') {
      throw new ForbiddenException('Only owner or admin can invite');
    }
    return member;
  }

  assertCanRemoveMember(
    actor: OrganizationMemberDoc,
    target: OrganizationMemberDoc,
  ): void {
    if (actor.userId === target.userId) {
      if (actor.role === 'owner') {
        throw new ForbiddenException(
          'Owner cannot leave; transfer ownership or delete the organization',
        );
      }
      return;
    }

    if (actor.role === 'owner') {
      if (target.role === 'owner') {
        throw new ForbiddenException('Cannot remove the owner');
      }
      return;
    }

    if (actor.role === 'admin') {
      if (target.role === 'owner') {
        throw new ForbiddenException('Cannot remove the owner');
      }
      return;
    }

    throw new ForbiddenException('Insufficient permissions to remove member');
  }

  async isMember(organizationId: string, userId: string): Promise<boolean> {
    const member = await this.repo.findMember(organizationId, userId);
    return member !== null;
  }

  async listOrganizationIdsForUser(userId: string): Promise<string[]> {
    return this.repo.listOrganizationIdsForUser(userId);
  }

  async getOrganizationNames(
    ids: string[],
  ): Promise<Map<string, string>> {
    const orgs = await this.repo.findOrganizationsByIds(ids);
    return new Map(orgs.map((o) => [o._id, o.name]));
  }

  private async findInviteByRawToken(
    token: string,
  ): Promise<OrganizationInviteDoc> {
    const trimmed = token.trim();
    if (!trimmed) {
      throw new BadRequestException('Invalid invite token');
    }
    const invite = await this.repo.findInviteByTokenHash(
      hashInviteToken(trimmed),
    );
    if (!invite) {
      throw new NotFoundException('Invite not found');
    }
    return invite;
  }

  private effectiveInviteStatus(
    invite: OrganizationInviteDoc,
  ): OrganizationInviteDoc['status'] | 'expired' {
    if (invite.status === 'pending' && Date.parse(invite.expiresAt) <= Date.now()) {
      return 'expired';
    }
    return invite.status;
  }
}

function hashInviteToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

function buildInviteUrl(token: string): string {
  const origins = corsOriginFromEnv();
  const base =
    origins === true
      ? 'http://localhost:5173'
      : (origins[0] ?? 'http://localhost:5173');
  return `${base.replace(/\/$/, '')}/org-invite/${token}`;
}
