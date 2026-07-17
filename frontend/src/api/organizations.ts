import type {
  InvitePreviewView,
  OrganizationDetailView,
  OrganizationInviteCreated,
  OrganizationListItem,
  OrganizationRole,
} from '../types/api.types'
import { apiFetch } from './apiFetch'

async function readApiError(res: Response): Promise<string> {
  try {
    const body: unknown = await res.json()
    if (body && typeof body === 'object' && 'message' in body) {
      const message = (body as { message: unknown }).message
      if (Array.isArray(message)) {
        return message.map(String).join(', ')
      }
      if (typeof message === 'string') {
        return message
      }
    }
  } catch {
    // ignore
  }

  return res.statusText || String(res.status)
}

export async function fetchOrganizations(): Promise<OrganizationListItem[]> {
  const res = await apiFetch('/organizations')
  if (!res.ok) {
    throw new Error(await readApiError(res))
  }
  return (await res.json()) as OrganizationListItem[]
}

export async function createOrganization(
  name: string,
): Promise<OrganizationListItem> {
  const res = await apiFetch('/organizations', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name }),
  })
  if (!res.ok) {
    throw new Error(await readApiError(res))
  }
  return (await res.json()) as OrganizationListItem
}

export async function fetchOrganization(
  organizationId: string,
): Promise<OrganizationDetailView> {
  const encoded = encodeURIComponent(organizationId)
  const res = await apiFetch(`/organizations/${encoded}`)
  if (!res.ok) {
    throw new Error(await readApiError(res))
  }
  return (await res.json()) as OrganizationDetailView
}

export async function createOrganizationInvite(
  organizationId: string,
): Promise<OrganizationInviteCreated> {
  const encoded = encodeURIComponent(organizationId)
  const res = await apiFetch(`/organizations/${encoded}/invites`, {
    method: 'POST',
  })
  if (!res.ok) {
    throw new Error(await readApiError(res))
  }
  return (await res.json()) as OrganizationInviteCreated
}

export async function revokeOrganizationInvite(
  organizationId: string,
  inviteId: string,
): Promise<void> {
  const org = encodeURIComponent(organizationId)
  const inv = encodeURIComponent(inviteId)
  const res = await apiFetch(`/organizations/${org}/invites/${inv}`, {
    method: 'DELETE',
  })
  if (!res.ok && res.status !== 404) {
    throw new Error(await readApiError(res))
  }
}

export async function previewOrganizationInvite(
  token: string,
): Promise<InvitePreviewView> {
  const encoded = encodeURIComponent(token)
  const res = await apiFetch(`/organizations/invites/${encoded}`)
  if (!res.ok) {
    throw new Error(await readApiError(res))
  }
  return (await res.json()) as InvitePreviewView
}

export async function acceptOrganizationInvite(
  token: string,
): Promise<{ organizationId: string }> {
  const encoded = encodeURIComponent(token)
  const res = await apiFetch(`/organizations/invites/${encoded}/accept`, {
    method: 'POST',
  })
  if (!res.ok) {
    throw new Error(await readApiError(res))
  }
  return (await res.json()) as { organizationId: string }
}

export async function updateOrganizationMemberRole(
  organizationId: string,
  userId: string,
  role: Extract<OrganizationRole, 'admin' | 'member'>,
): Promise<void> {
  const org = encodeURIComponent(organizationId)
  const user = encodeURIComponent(userId)
  const res = await apiFetch(`/organizations/${org}/members/${user}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ role }),
  })
  if (!res.ok) {
    throw new Error(await readApiError(res))
  }
}

export async function removeOrganizationMember(
  organizationId: string,
  userId: string,
): Promise<void> {
  const org = encodeURIComponent(organizationId)
  const user = encodeURIComponent(userId)
  const res = await apiFetch(`/organizations/${org}/members/${user}`, {
    method: 'DELETE',
  })
  if (!res.ok) {
    throw new Error(await readApiError(res))
  }
}

export async function deleteOrganization(
  organizationId: string,
): Promise<void> {
  const encoded = encodeURIComponent(organizationId)
  const res = await apiFetch(`/organizations/${encoded}`, {
    method: 'DELETE',
  })
  if (!res.ok && res.status !== 404) {
    throw new Error(await readApiError(res))
  }
}
