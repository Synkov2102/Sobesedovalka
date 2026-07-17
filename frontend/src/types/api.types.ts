export type TaskPresetFile = {
  path: string
  content: string
}

export type TaskPresetVisibility = 'private' | 'organization'

export type TaskPresetAccess = 'owner' | 'shared'

export type TaskPreset = {
  id: string
  title: string
  description: string
  files: Record<string, string>
  folders: string[]
  visibility: TaskPresetVisibility
  organizationId?: string
  organizationName?: string
  solutionFiles: Record<string, string>
  access: TaskPresetAccess
  createdAt: string
  updatedAt: string
}

export type RoomSolutionResponse = {
  title: string
  solutionFiles: Record<string, string>
}

export type MainTab = 'rooms' | 'presets' | 'organizations'

export type OrganizationRole = 'owner' | 'admin' | 'member'

export type InviteStatus = 'pending' | 'used' | 'revoked'

export type OrganizationListItem = {
  id: string
  name: string
  role: OrganizationRole
  createdAt: string
  updatedAt: string
}

export type OrganizationMemberView = {
  userId: string
  role: OrganizationRole
  displayName: string | null
  createdAt: string
}

export type OrganizationInviteView = {
  id: string
  status: InviteStatus
  expiresAt: string
  createdAt: string
  createdByUserId: string
  inviteUrl?: string
  token?: string
}

export type OrganizationDetailView = {
  id: string
  name: string
  role: OrganizationRole
  ownerUserId: string
  members: OrganizationMemberView[]
  pendingInvites: OrganizationInviteView[]
  createdAt: string
  updatedAt: string
}

export type OrganizationInviteCreated = {
  inviteId: string
  inviteUrl: string
  expiresAt: string
}

export type InvitePreviewView = {
  organizationName: string
  status: InviteStatus | 'expired'
  expiresAt: string
  alreadyMember: boolean
}

export type CollabRoomSummary = {
  roomId: string
  title: string
  createdAt: string
  updatedAt: string
}

export type CollabPasteEvent = {
  clientId: string
  displayName: string
  path: string
  content: string
  fileContent: string
  contentLength: number
  truncated: boolean
  insertStartOffset: number
  insertEndOffset: number
  line: number
  col: number
  createdAt: string
}

export type CollabPageLeaveEvent = {
  clientId: string
  displayName: string
  createdAt: string
}

export type AuthUser = {
  id: string
  vkId?: string
  yandexId?: string
  displayName?: string
  avatarUrl?: string
  email?: string
  phone?: string
}

export type AuthLoginResponse = {
  accessToken: string
  user: AuthUser
}
