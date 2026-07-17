export type OrganizationRole = 'owner' | 'admin' | 'member';

export type InviteStatus = 'pending' | 'used' | 'revoked';

export type OrganizationDoc = {
  _id: string;
  name: string;
  ownerUserId: string;
  createdAt: string;
  updatedAt: string;
};

export type OrganizationMemberDoc = {
  _id: string;
  organizationId: string;
  userId: string;
  role: OrganizationRole;
  createdAt: string;
};

export type OrganizationInviteDoc = {
  _id: string;
  organizationId: string;
  tokenHash: string;
  createdByUserId: string;
  status: InviteStatus;
  expiresAt: string;
  usedByUserId?: string;
  usedAt?: string;
  createdAt: string;
};

export type OrganizationListItem = {
  id: string;
  name: string;
  role: OrganizationRole;
  createdAt: string;
  updatedAt: string;
};

export type OrganizationMemberView = {
  userId: string;
  role: OrganizationRole;
  displayName: string | null;
  createdAt: string;
};

export type OrganizationInviteView = {
  id: string;
  status: InviteStatus;
  expiresAt: string;
  createdAt: string;
  createdByUserId: string;
};

export type OrganizationDetailView = {
  id: string;
  name: string;
  role: OrganizationRole;
  ownerUserId: string;
  members: OrganizationMemberView[];
  pendingInvites: OrganizationInviteView[];
  createdAt: string;
  updatedAt: string;
};

export type InvitePreviewView = {
  organizationName: string;
  status: InviteStatus | 'expired';
  expiresAt: string;
  alreadyMember: boolean;
};
