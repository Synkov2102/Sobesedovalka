import { Injectable, OnModuleInit } from '@nestjs/common';
import type { Collection } from 'mongodb';
import { MongoService } from '../mongo/mongo.service';
import type {
  OrganizationDoc,
  OrganizationInviteDoc,
  OrganizationMemberDoc,
  OrganizationRole,
} from './organizations.types';

const ORGS = 'organizations';
const MEMBERS = 'organization_members';
const INVITES = 'organization_invites';

@Injectable()
export class OrganizationsRepository implements OnModuleInit {
  private orgs!: Collection<OrganizationDoc>;
  private members!: Collection<OrganizationMemberDoc>;
  private invites!: Collection<OrganizationInviteDoc>;

  constructor(private readonly mongo: MongoService) {}

  async onModuleInit(): Promise<void> {
    const db = this.mongo.getDb();
    this.orgs = db.collection<OrganizationDoc>(ORGS);
    this.members = db.collection<OrganizationMemberDoc>(MEMBERS);
    this.invites = db.collection<OrganizationInviteDoc>(INVITES);

    await this.orgs.createIndex({ ownerUserId: 1 });
    await this.members.createIndex(
      { organizationId: 1, userId: 1 },
      { unique: true },
    );
    await this.members.createIndex({ userId: 1 });
    await this.invites.createIndex({ tokenHash: 1 }, { unique: true });
    await this.invites.createIndex({ organizationId: 1, status: 1 });
  }

  async createOrganization(doc: OrganizationDoc): Promise<void> {
    await this.orgs.insertOne(doc);
  }

  async findOrganizationById(id: string): Promise<OrganizationDoc | null> {
    return this.orgs.findOne({ _id: id });
  }

  async findOrganizationsByIds(ids: string[]): Promise<OrganizationDoc[]> {
    if (ids.length === 0) {
      return [];
    }
    return this.orgs.find({ _id: { $in: ids } }).toArray();
  }

  async deleteOrganization(id: string): Promise<boolean> {
    const result = await this.orgs.deleteOne({ _id: id });
    return result.deletedCount > 0;
  }

  async createMember(doc: OrganizationMemberDoc): Promise<void> {
    await this.members.insertOne(doc);
  }

  async findMember(
    organizationId: string,
    userId: string,
  ): Promise<OrganizationMemberDoc | null> {
    return this.members.findOne({ organizationId, userId });
  }

  async listMembers(
    organizationId: string,
  ): Promise<OrganizationMemberDoc[]> {
    return this.members
      .find({ organizationId })
      .sort({ createdAt: 1 })
      .toArray();
  }

  async listMembershipsForUser(
    userId: string,
  ): Promise<OrganizationMemberDoc[]> {
    return this.members.find({ userId }).toArray();
  }

  async listOrganizationIdsForUser(userId: string): Promise<string[]> {
    const rows = await this.members
      .find({ userId }, { projection: { organizationId: 1 } })
      .toArray();
    return rows.map((r) => r.organizationId);
  }

  async updateMemberRole(
    organizationId: string,
    userId: string,
    role: OrganizationRole,
  ): Promise<boolean> {
    const result = await this.members.updateOne(
      { organizationId, userId },
      { $set: { role } },
    );
    return result.matchedCount > 0;
  }

  async deleteMember(
    organizationId: string,
    userId: string,
  ): Promise<boolean> {
    const result = await this.members.deleteOne({ organizationId, userId });
    return result.deletedCount > 0;
  }

  async deleteAllMembers(organizationId: string): Promise<void> {
    await this.members.deleteMany({ organizationId });
  }

  async createInvite(doc: OrganizationInviteDoc): Promise<void> {
    await this.invites.insertOne(doc);
  }

  async findInviteByTokenHash(
    tokenHash: string,
  ): Promise<OrganizationInviteDoc | null> {
    return this.invites.findOne({ tokenHash });
  }

  async findInviteById(
    organizationId: string,
    inviteId: string,
  ): Promise<OrganizationInviteDoc | null> {
    return this.invites.findOne({ _id: inviteId, organizationId });
  }

  async listPendingInvites(
    organizationId: string,
  ): Promise<OrganizationInviteDoc[]> {
    return this.invites
      .find({ organizationId, status: 'pending' })
      .sort({ createdAt: -1 })
      .toArray();
  }

  async revokeInvite(
    organizationId: string,
    inviteId: string,
  ): Promise<boolean> {
    const result = await this.invites.updateOne(
      { _id: inviteId, organizationId, status: 'pending' },
      { $set: { status: 'revoked' } },
    );
    return result.matchedCount > 0;
  }

  async markInviteUsed(
    inviteId: string,
    usedByUserId: string,
    usedAt: string,
  ): Promise<boolean> {
    const result = await this.invites.updateOne(
      { _id: inviteId, status: 'pending' },
      {
        $set: {
          status: 'used',
          usedByUserId,
          usedAt,
        },
      },
    );
    return result.matchedCount > 0;
  }

  async deletePendingInvites(organizationId: string): Promise<void> {
    await this.invites.deleteMany({ organizationId, status: 'pending' });
  }
}
