import { useCallback, useEffect, useState } from 'react'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import LinkOffRoundedIcon from '@mui/icons-material/LinkOffRounded'
import PersonRemoveRoundedIcon from '@mui/icons-material/PersonRemoveRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded'
import {
  Alert,
  Box,
  Button,
  Chip,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  IconButton,
  Paper,
  Skeleton,
  Snackbar,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import {
  createOrganization,
  createOrganizationInvite,
  deleteOrganization,
  fetchOrganization,
  fetchOrganizations,
  removeOrganizationMember,
  revokeOrganizationInvite,
  updateOrganizationMemberRole,
} from '../../api/organizations'
import { sectionSurfacePaddingSx } from '../../theme/layout'
import type {
  OrganizationDetailView,
  OrganizationInviteView,
  OrganizationListItem,
  OrganizationMemberView,
  OrganizationRole,
} from '../../types/api.types'

type OrganizationsPanelProps = {
  currentUserId: string
  initialOrganizationId?: string | null
}

function formatUpdated(iso: string): string {
  try {
    return new Date(iso).toLocaleString('ru-RU', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    })
  } catch {
    return iso
  }
}

function roleLabel(role: OrganizationRole): string {
  switch (role) {
    case 'owner':
      return 'Владелец'
    case 'admin':
      return 'Админ'
    case 'member':
      return 'Участник'
    default:
      return role
  }
}

function roleChipColor(
  role: OrganizationRole,
): 'primary' | 'secondary' | 'default' {
  if (role === 'owner') {
    return 'primary'
  }
  if (role === 'admin') {
    return 'secondary'
  }
  return 'default'
}

function canInvite(role: OrganizationRole): boolean {
  return role === 'owner' || role === 'admin'
}

function canRemoveMember(
  actorRole: OrganizationRole,
  actorUserId: string,
  target: OrganizationMemberView,
): boolean {
  if (actorUserId === target.userId) {
    return actorRole !== 'owner'
  }
  if (actorRole === 'owner') {
    return target.role !== 'owner'
  }
  if (actorRole === 'admin') {
    return target.role !== 'owner'
  }
  return false
}

function removeActionLabel(
  actorUserId: string,
  targetUserId: string,
): string {
  return actorUserId === targetUserId ? 'Выйти' : 'Исключить'
}

function isLocalhostHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname === '127.0.0.1' ||
    hostname === '[::1]' ||
    hostname === '::1'
  )
}

/** Prefer client origin; rewrite broken localhost absolute URLs from API on prod. */
function inviteLinkForCopy(invite: {
  inviteUrl?: string
  token?: string
}): string | null {
  if (invite.token) {
    return `${window.location.origin}/org-invite/${invite.token}`
  }
  if (!invite.inviteUrl) {
    return null
  }
  try {
    const parsed = new URL(invite.inviteUrl)
    if (
      isLocalhostHost(parsed.hostname) &&
      !isLocalhostHost(window.location.hostname)
    ) {
      return `${window.location.origin}${parsed.pathname}${parsed.search}`
    }
  } catch {
    // keep absolute URL as returned
  }
  return invite.inviteUrl
}

export function OrganizationsPanel({
  currentUserId,
  initialOrganizationId = null,
}: OrganizationsPanelProps) {
  const theme = useTheme()
  const [orgs, setOrgs] = useState<OrganizationListItem[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [createOpen, setCreateOpen] = useState(false)
  const [createName, setCreateName] = useState('')
  const [selectedId, setSelectedId] = useState<string | null>(
    initialOrganizationId,
  )
  const [detail, setDetail] = useState<OrganizationDetailView | null>(null)
  const [detailLoading, setDetailLoading] = useState(false)
  const [deleteOrgTarget, setDeleteOrgTarget] =
    useState<OrganizationDetailView | null>(null)
  const [removeMemberTarget, setRemoveMemberTarget] =
    useState<OrganizationMemberView | null>(null)
  const [snackbar, setSnackbar] = useState<string | null>(null)

  const orangeGlow = alpha(theme.palette.primary.main, 0.14)
  const isCreating = busyKey === 'create'
  const isDeletingOrg =
    deleteOrgTarget !== null && busyKey === `delete-org:${deleteOrgTarget.id}`
  const isRemovingMember =
    removeMemberTarget !== null &&
    busyKey === `remove:${removeMemberTarget.userId}`

  const loadList = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchOrganizations()
      setOrgs(data)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Не удалось загрузить организации',
      )
      setOrgs([])
    } finally {
      setLoading(false)
    }
  }, [])

  const loadDetail = useCallback(async (organizationId: string) => {
    setDetailLoading(true)
    setError(null)
    try {
      const data = await fetchOrganization(organizationId)
      setDetail(data)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Не удалось загрузить организацию',
      )
      setDetail(null)
    } finally {
      setDetailLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadList()
  }, [loadList])

  useEffect(() => {
    if (initialOrganizationId) {
      setSelectedId(initialOrganizationId)
    }
  }, [initialOrganizationId])

  useEffect(() => {
    if (!selectedId) {
      setDetail(null)
      return
    }
    void loadDetail(selectedId)
  }, [selectedId, loadDetail])

  async function handleCreate() {
    const name = createName.trim()
    if (!name) {
      return
    }
    setBusyKey('create')
    setError(null)
    try {
      const created = await createOrganization(name)
      setCreateOpen(false)
      setCreateName('')
      await loadList()
      setSelectedId(created.id)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Не удалось создать организацию',
      )
    } finally {
      setBusyKey(null)
    }
  }

  async function handleInvite() {
    if (!detail || !canInvite(detail.role)) {
      return
    }
    setBusyKey('invite')
    setError(null)
    try {
      const invite = await createOrganizationInvite(detail.id)
      const url =
        inviteLinkForCopy({ inviteUrl: invite.inviteUrl }) ?? invite.inviteUrl
      try {
        await navigator.clipboard.writeText(url)
        setSnackbar('Ссылка-приглашение скопирована')
      } catch {
        setSnackbar(url)
      }
      await loadDetail(detail.id)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Не удалось создать приглашение',
      )
    } finally {
      setBusyKey(null)
    }
  }

  async function handleCopyInvite(invite: OrganizationInviteView) {
    const url = inviteLinkForCopy(invite)
    if (!url) {
      setError(
        'Ссылку нельзя восстановить: приглашение создано до обновления. Создайте новое.',
      )
      return
    }
    setBusyKey(`copy:${invite.id}`)
    setError(null)
    try {
      try {
        await navigator.clipboard.writeText(url)
        setSnackbar('Ссылка-приглашение скопирована')
      } catch {
        setSnackbar(url)
      }
    } finally {
      setBusyKey(null)
    }
  }

  async function handleRevokeInvite(inviteId: string) {
    if (!detail) {
      return
    }
    setBusyKey(`revoke:${inviteId}`)
    setError(null)
    try {
      await revokeOrganizationInvite(detail.id, inviteId)
      await loadDetail(detail.id)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Не удалось отозвать приглашение',
      )
    } finally {
      setBusyKey(null)
    }
  }

  async function handleToggleRole(member: OrganizationMemberView) {
    if (!detail || detail.role !== 'owner' || member.role === 'owner') {
      return
    }
    const nextRole = member.role === 'admin' ? 'member' : 'admin'
    setBusyKey(`role:${member.userId}`)
    setError(null)
    try {
      await updateOrganizationMemberRole(detail.id, member.userId, nextRole)
      await loadDetail(detail.id)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Не удалось изменить роль',
      )
    } finally {
      setBusyKey(null)
    }
  }

  async function confirmRemoveMember() {
    if (!detail || !removeMemberTarget) {
      return
    }
    const targetId = removeMemberTarget.userId
    const leavingSelf = targetId === currentUserId
    setBusyKey(`remove:${targetId}`)
    setError(null)
    try {
      await removeOrganizationMember(detail.id, targetId)
      setRemoveMemberTarget(null)
      if (leavingSelf) {
        setSelectedId(null)
        setDetail(null)
        await loadList()
      } else {
        await loadDetail(detail.id)
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Не удалось изменить состав участников',
      )
    } finally {
      setBusyKey(null)
    }
  }

  async function confirmDeleteOrg() {
    if (!deleteOrgTarget) {
      return
    }
    const orgId = deleteOrgTarget.id
    setBusyKey(`delete-org:${orgId}`)
    setError(null)
    try {
      await deleteOrganization(orgId)
      setDeleteOrgTarget(null)
      setSelectedId(null)
      setDetail(null)
      await loadList()
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Не удалось удалить организацию',
      )
    } finally {
      setBusyKey(null)
    }
  }

  const count = orgs?.length ?? 0
  const showingDetail = selectedId !== null

  return (
    <Box className="organizations-page" sx={{ width: '100%' }}>
      <Paper
        elevation={0}
        sx={{
          ...sectionSurfacePaddingSx,
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 2,
          border: `1px solid ${theme.palette.divider}`,
          background: `linear-gradient(145deg, ${orangeGlow} 0%, ${theme.palette.background.paper} 42%, ${theme.palette.background.paper} 100%)`,
          mb: 3,
        }}
      >
        <Box
          aria-hidden
          sx={{
            position: 'absolute',
            top: -48,
            right: -32,
            width: 180,
            height: 180,
            borderRadius: '50%',
            background: alpha(theme.palette.primary.main, 0.06),
            pointerEvents: 'none',
          }}
        />
        <Stack
          direction={{ xs: 'column', md: 'row' }}
          spacing={2.5}
          sx={{
            position: 'relative',
            alignItems: { xs: 'stretch', md: 'flex-start' },
            justifyContent: 'space-between',
          }}
        >
          <Box sx={{ minWidth: 0, flex: 1 }}>
            <Stack
              direction="row"
              spacing={1}
              sx={{ mb: 1, alignItems: 'center' }}
            >
              <GroupsOutlinedIcon
                sx={{
                  fontSize: 28,
                  color: 'primary.main',
                  opacity: 0.95,
                }}
              />
              <Typography
                variant="overline"
                sx={{
                  letterSpacing: '0.12em',
                  color: 'text.secondary',
                  fontWeight: 600,
                }}
              >
                Команды и доступ
              </Typography>
            </Stack>
            <Typography
              variant="h4"
              component="h1"
              sx={{
                fontWeight: 700,
                letterSpacing: '-0.03em',
                lineHeight: 1.15,
                mb: 1,
                fontSize: { xs: '1.65rem', sm: '2rem' },
              }}
            >
              {showingDetail && detail ? detail.name : 'Организации'}
            </Typography>
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{ maxWidth: 560, lineHeight: 1.6 }}
            >
              {showingDetail
                ? 'Участники, роли и одноразовые ссылки-приглашения. Владелец управляет ролями; админы могут приглашать и исключать.'
                : 'Объединяйте коллег, приглашайте по ссылке и делитесь пресетами внутри организации.'}
            </Typography>
            {!loading && !showingDetail ? (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 1.5 }}
              >
                Всего организаций: <strong>{count}</strong>
              </Typography>
            ) : null}
          </Box>

          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            sx={{
              flexShrink: 0,
              alignItems: { xs: 'stretch', sm: 'flex-start' },
              pt: { md: 3 },
            }}
          >
            {showingDetail ? (
              <Button
                variant="outlined"
                color="primary"
                startIcon={<ArrowBackRoundedIcon />}
                disabled={busyKey !== null}
                onClick={() => setSelectedId(null)}
                sx={{ borderRadius: 1.5 }}
              >
                К списку
              </Button>
            ) : (
              <>
                <Tooltip title="Обновить список">
                  <span>
                    <IconButton
                      onClick={() => void loadList()}
                      disabled={loading || busyKey !== null}
                      aria-label="Обновить список организаций"
                      sx={{
                        border: `1px solid ${theme.palette.divider}`,
                        borderRadius: 1.5,
                      }}
                    >
                      <RefreshRoundedIcon />
                    </IconButton>
                  </span>
                </Tooltip>
                <Button
                  variant="contained"
                  color="primary"
                  size="large"
                  disabled={busyKey !== null}
                  onClick={() => {
                    setCreateName('')
                    setCreateOpen(true)
                  }}
                  startIcon={<AddRoundedIcon />}
                  sx={{
                    px: 2.5,
                    py: 1.25,
                    borderRadius: 1.5,
                    boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.25)}`,
                  }}
                >
                  Новая организация
                </Button>
              </>
            )}
          </Stack>
        </Stack>
      </Paper>

      {error ? (
        <Alert severity="error" sx={{ mb: 2.5 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      {showingDetail ? (
        detailLoading && !detail ? (
          <Stack spacing={2}>
            <Skeleton variant="rounded" height={120} sx={{ borderRadius: 2 }} />
            <Skeleton variant="rounded" height={200} sx={{ borderRadius: 2 }} />
          </Stack>
        ) : detail ? (
          <Stack spacing={3}>
            <Paper
              variant="outlined"
              sx={{ p: 2.25, borderRadius: 2, borderColor: 'divider' }}
            >
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1.5}
                sx={{
                  alignItems: { xs: 'stretch', sm: 'center' },
                  justifyContent: 'space-between',
                  mb: 2,
                }}
              >
                <Typography variant="h6" sx={{ fontWeight: 600 }}>
                  Участники
                </Typography>
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  sx={{ flexShrink: 0 }}
                >
                  {canInvite(detail.role) ? (
                    <Button
                      variant="contained"
                      color="primary"
                      size="small"
                      disabled={busyKey !== null}
                      startIcon={<ContentCopyRoundedIcon sx={{ fontSize: 18 }} />}
                      onClick={() => void handleInvite()}
                      sx={{ borderRadius: 1.5 }}
                    >
                      {busyKey === 'invite' ? (
                        <CircularProgress size={18} color="inherit" />
                      ) : (
                        'Пригласить'
                      )}
                    </Button>
                  ) : null}
                  {detail.role === 'owner' ? (
                    <Button
                      variant="outlined"
                      color="error"
                      size="small"
                      disabled={busyKey !== null}
                      startIcon={
                        <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />
                      }
                      onClick={() => setDeleteOrgTarget(detail)}
                      sx={{ borderRadius: 1.5 }}
                    >
                      Удалить организацию
                    </Button>
                  ) : null}
                </Stack>
              </Stack>

              <Stack spacing={1.25} component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
                {detail.members.map((member) => {
                  const showRemove = canRemoveMember(
                    detail.role,
                    currentUserId,
                    member,
                  )
                  const canPromote =
                    detail.role === 'owner' && member.role !== 'owner'
                  return (
                    <Paper
                      key={member.userId}
                      component="li"
                      variant="outlined"
                      sx={{
                        p: 1.75,
                        borderRadius: 1.5,
                        borderColor: 'divider',
                      }}
                    >
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1.25}
                        sx={{
                          alignItems: { xs: 'stretch', sm: 'center' },
                          justifyContent: 'space-between',
                        }}
                      >
                        <Box sx={{ minWidth: 0 }}>
                          <Typography
                            variant="subtitle2"
                            sx={{ fontWeight: 600, wordBreak: 'break-word' }}
                          >
                            {member.displayName ?? member.userId.slice(0, 8)}
                            {member.userId === currentUserId ? ' (вы)' : ''}
                          </Typography>
                          <Stack
                            direction="row"
                            spacing={0.75}
                            sx={{ mt: 0.75, alignItems: 'center', flexWrap: 'wrap' }}
                          >
                            <Chip
                              size="small"
                              color={roleChipColor(member.role)}
                              variant="outlined"
                              label={roleLabel(member.role)}
                            />
                            <Typography variant="caption" color="text.secondary">
                              с {formatUpdated(member.createdAt)}
                            </Typography>
                          </Stack>
                        </Box>
                        <Stack
                          direction="row"
                          spacing={1}
                          sx={{
                            flexShrink: 0,
                            flexWrap: 'wrap',
                            justifyContent: { xs: 'stretch', sm: 'flex-end' },
                          }}
                        >
                          {canPromote ? (
                            <Button
                              size="small"
                              variant="outlined"
                              color="secondary"
                              disabled={busyKey !== null}
                              onClick={() => void handleToggleRole(member)}
                              sx={{ borderRadius: 1.5 }}
                            >
                              {member.role === 'admin'
                                ? 'Сделать участником'
                                : 'Сделать админом'}
                            </Button>
                          ) : null}
                          {showRemove ? (
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              disabled={busyKey !== null}
                              startIcon={
                                <PersonRemoveRoundedIcon sx={{ fontSize: 18 }} />
                              }
                              onClick={() => setRemoveMemberTarget(member)}
                              sx={{ borderRadius: 1.5 }}
                            >
                              {removeActionLabel(currentUserId, member.userId)}
                            </Button>
                          ) : null}
                        </Stack>
                      </Stack>
                    </Paper>
                  )
                })}
              </Stack>
            </Paper>

            {canInvite(detail.role) ? (
              <Paper
                variant="outlined"
                sx={{ p: 2.25, borderRadius: 2, borderColor: 'divider' }}
              >
                <Typography variant="h6" sx={{ fontWeight: 600, mb: 1.5 }}>
                  Ожидающие приглашения
                </Typography>
                {detail.pendingInvites.length === 0 ? (
                  <Typography variant="body2" color="text.secondary">
                    Нет активных ссылок. Нажмите «Пригласить», чтобы создать
                    одноразовую ссылку и скопировать её в буфер обмена.
                  </Typography>
                ) : (
                  <Stack spacing={1.25} component="ul" sx={{ listStyle: 'none', m: 0, p: 0 }}>
                    {detail.pendingInvites.map((invite) => (
                      <Paper
                        key={invite.id}
                        component="li"
                        variant="outlined"
                        sx={{
                          p: 1.75,
                          borderRadius: 1.5,
                          borderColor: 'divider',
                        }}
                      >
                        <Stack
                          direction={{ xs: 'column', sm: 'row' }}
                          spacing={1}
                          sx={{
                            alignItems: { xs: 'stretch', sm: 'center' },
                            justifyContent: 'space-between',
                          }}
                        >
                          <Box>
                            <Typography variant="body2" sx={{ fontWeight: 500 }}>
                              Истекает {formatUpdated(invite.expiresAt)}
                            </Typography>
                            <Typography variant="caption" color="text.secondary">
                              Создано {formatUpdated(invite.createdAt)}
                            </Typography>
                          </Box>
                          <Stack
                            direction="row"
                            spacing={1}
                            sx={{
                              flexShrink: 0,
                              justifyContent: { xs: 'stretch', sm: 'flex-end' },
                            }}
                          >
                            <Button
                              size="small"
                              variant="outlined"
                              disabled={
                                busyKey !== null ||
                                inviteLinkForCopy(invite) === null
                              }
                              startIcon={
                                <ContentCopyRoundedIcon sx={{ fontSize: 18 }} />
                              }
                              onClick={() => void handleCopyInvite(invite)}
                              sx={{ borderRadius: 1.5 }}
                            >
                              Скопировать
                            </Button>
                            <Button
                              size="small"
                              variant="outlined"
                              color="error"
                              disabled={busyKey !== null}
                              startIcon={
                                <LinkOffRoundedIcon sx={{ fontSize: 18 }} />
                              }
                              onClick={() => void handleRevokeInvite(invite.id)}
                              sx={{ borderRadius: 1.5 }}
                            >
                              Отозвать
                            </Button>
                          </Stack>
                        </Stack>
                      </Paper>
                    ))}
                  </Stack>
                )}
              </Paper>
            ) : null}
          </Stack>
        ) : null
      ) : loading ? (
        <Stack spacing={2}>
          {[0, 1, 2].map((key) => (
            <Paper
              key={key}
              variant="outlined"
              sx={{ p: 2.5, borderRadius: 2, borderColor: 'divider' }}
            >
              <Skeleton variant="text" width="42%" height={28} sx={{ mb: 1 }} />
              <Skeleton variant="text" width="72%" height={20} />
            </Paper>
          ))}
        </Stack>
      ) : !orgs?.length ? (
        <Paper
          variant="outlined"
          sx={{
            py: { xs: 5, sm: 7 },
            px: 3,
            textAlign: 'center',
            borderRadius: 2,
            borderStyle: 'dashed',
            borderColor: alpha(theme.palette.divider, 0.9),
            bgcolor: alpha(theme.palette.background.paper, 0.5),
          }}
        >
          <GroupsOutlinedIcon
            sx={{
              fontSize: 56,
              color: 'text.secondary',
              opacity: 0.45,
              mb: 2,
            }}
          />
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
            Пока нет организаций
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ maxWidth: 420, mx: 'auto', mb: 3 }}
          >
            Создайте организацию, чтобы приглашать коллег по одноразовой ссылке
            и делиться пресетами заданий.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            size="large"
            disabled={busyKey !== null}
            onClick={() => {
              setCreateName('')
              setCreateOpen(true)
            }}
            startIcon={<AddRoundedIcon />}
            sx={{ borderRadius: 1.5 }}
          >
            Создать организацию
          </Button>
        </Paper>
      ) : (
        <Stack
          spacing={2}
          component="ul"
          sx={{ listStyle: 'none', m: 0, p: 0 }}
        >
          {orgs.map((org) => (
            <Paper
              key={org.id}
              component="li"
              elevation={0}
              variant="outlined"
              sx={{
                borderRadius: 2,
                borderColor: 'divider',
                overflow: 'hidden',
                transition:
                  'border-color 0.2s ease, box-shadow 0.2s ease, background-color 0.2s ease',
                '&:hover': {
                  borderColor: alpha(theme.palette.primary.main, 0.45),
                  boxShadow: `0 12px 40px ${alpha(theme.palette.common.black, 0.35)}`,
                  bgcolor: alpha(theme.palette.primary.main, 0.03),
                },
              }}
            >
              <Stack direction="row" sx={{ minHeight: 0 }}>
                <Box
                  aria-hidden
                  sx={{
                    width: 4,
                    flexShrink: 0,
                    bgcolor: alpha(theme.palette.primary.main, 0.65),
                  }}
                />
                <Stack
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={2}
                  sx={{
                    flex: 1,
                    alignItems: { xs: 'stretch', sm: 'center' },
                    justifyContent: 'space-between',
                    p: 2.25,
                    pl: 2,
                    minWidth: 0,
                  }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography
                      variant="h6"
                      component="h2"
                      sx={{
                        fontWeight: 600,
                        fontSize: '1.05rem',
                        lineHeight: 1.35,
                        mb: 0.75,
                        wordBreak: 'break-word',
                      }}
                    >
                      {org.name}
                    </Typography>
                    <Stack
                      direction="row"
                      spacing={0.75}
                      sx={{ mb: 1, alignItems: 'center', flexWrap: 'wrap' }}
                    >
                      <Chip
                        size="small"
                        color={roleChipColor(org.role)}
                        variant="outlined"
                        label={roleLabel(org.role)}
                      />
                      <ScheduleRoundedIcon
                        sx={{
                          fontSize: 18,
                          color: 'text.secondary',
                          opacity: 0.85,
                        }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        Обновлено {formatUpdated(org.updatedAt)}
                      </Typography>
                    </Stack>
                  </Box>
                  <Button
                    variant="contained"
                    color="primary"
                    disabled={busyKey !== null}
                    onClick={() => setSelectedId(org.id)}
                    sx={{ px: 2.25, borderRadius: 1.5, whiteSpace: 'nowrap' }}
                  >
                    Открыть
                  </Button>
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}

      <Dialog
        open={createOpen}
        onClose={() => {
          if (!isCreating) {
            setCreateOpen(false)
          }
        }}
        aria-labelledby="orgs-create-dialog-title"
        slotProps={{
          paper: {
            sx: {
              borderRadius: 2,
              border: `1px solid ${theme.palette.divider}`,
            },
          },
        }}
      >
        <DialogTitle id="orgs-create-dialog-title">
          Новая организация
        </DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 2 }}>
            Укажите название. Вы станете владельцем и сможете приглашать
            участников.
          </DialogContentText>
          <TextField
            autoFocus
            fullWidth
            label="Название"
            value={createName}
            onChange={(e) => setCreateName(e.target.value)}
            disabled={isCreating}
            slotProps={{ htmlInput: { maxLength: 120 } }}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                void handleCreate()
              }
            }}
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setCreateOpen(false)}
            disabled={isCreating}
            sx={{ borderRadius: 1.5 }}
          >
            Отмена
          </Button>
          <Button
            variant="contained"
            color="primary"
            disabled={isCreating || !createName.trim()}
            onClick={() => void handleCreate()}
            sx={{ borderRadius: 1.5, minWidth: 120 }}
          >
            {isCreating ? (
              <CircularProgress color="inherit" size={22} thickness={5} />
            ) : (
              'Создать'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={deleteOrgTarget !== null}
        onClose={() => {
          if (!isDeletingOrg) {
            setDeleteOrgTarget(null)
          }
        }}
        role="alertdialog"
        aria-labelledby="orgs-delete-dialog-title"
        slotProps={{
          paper: {
            sx: {
              borderRadius: 2,
              border: `1px solid ${theme.palette.divider}`,
            },
          },
        }}
      >
        <DialogTitle id="orgs-delete-dialog-title">
          Удалить организацию?
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            Организация «{deleteOrgTarget?.name ?? ''}» будет удалена: участники
            и ожидающие приглашения исчезнут. Пресеты организации станут
            приватными.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setDeleteOrgTarget(null)}
            disabled={isDeletingOrg}
            sx={{ borderRadius: 1.5 }}
          >
            Отмена
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={isDeletingOrg}
            onClick={() => void confirmDeleteOrg()}
            sx={{ borderRadius: 1.5, minWidth: 120 }}
          >
            {isDeletingOrg ? (
              <CircularProgress color="inherit" size={22} thickness={5} />
            ) : (
              'Удалить'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      <Dialog
        open={removeMemberTarget !== null}
        onClose={() => {
          if (!isRemovingMember) {
            setRemoveMemberTarget(null)
          }
        }}
        role="alertdialog"
        aria-labelledby="orgs-remove-member-dialog-title"
        slotProps={{
          paper: {
            sx: {
              borderRadius: 2,
              border: `1px solid ${theme.palette.divider}`,
            },
          },
        }}
      >
        <DialogTitle id="orgs-remove-member-dialog-title">
          {removeMemberTarget?.userId === currentUserId
            ? 'Выйти из организации?'
            : 'Исключить участника?'}
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            {removeMemberTarget?.userId === currentUserId
              ? 'Вы перестанете быть участником этой организации.'
              : `Участник «${removeMemberTarget?.displayName ?? removeMemberTarget?.userId ?? ''}» будет исключён.`}
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={() => setRemoveMemberTarget(null)}
            disabled={isRemovingMember}
            sx={{ borderRadius: 1.5 }}
          >
            Отмена
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={isRemovingMember}
            onClick={() => void confirmRemoveMember()}
            sx={{ borderRadius: 1.5, minWidth: 120 }}
          >
            {isRemovingMember ? (
              <CircularProgress color="inherit" size={22} thickness={5} />
            ) : removeMemberTarget?.userId === currentUserId ? (
              'Выйти'
            ) : (
              'Исключить'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbar !== null}
        autoHideDuration={3600}
        onClose={() => setSnackbar(null)}
        message={snackbar ?? ''}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  )
}
