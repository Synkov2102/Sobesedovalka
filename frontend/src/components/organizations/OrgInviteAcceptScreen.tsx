import { useCallback, useEffect, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Paper,
  Stack,
  Typography,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import GroupsOutlinedIcon from '@mui/icons-material/GroupsOutlined'
import {
  acceptOrganizationInvite,
  previewOrganizationInvite,
} from '../../api/organizations'
import { sectionSurfacePaddingSx } from '../../theme/layout'
import type { InvitePreviewView } from '../../types/api.types'

type OrgInviteAcceptScreenProps = {
  token: string
  onAccepted: (organizationId: string) => void
  onDismiss: () => void
}

function statusLabel(status: InvitePreviewView['status']): string {
  switch (status) {
    case 'pending':
      return 'Ожидает принятия'
    case 'used':
      return 'Уже использовано'
    case 'revoked':
      return 'Отозвано'
    case 'expired':
      return 'Истекло'
    default:
      return status
  }
}

export function OrgInviteAcceptScreen({
  token,
  onAccepted,
  onDismiss,
}: OrgInviteAcceptScreenProps) {
  const theme = useTheme()
  const [preview, setPreview] = useState<InvitePreviewView | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await previewOrganizationInvite(token)
      setPreview(data)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Не удалось загрузить приглашение',
      )
      setPreview(null)
    } finally {
      setLoading(false)
    }
  }, [token])

  useEffect(() => {
    void load()
  }, [load])

  async function handleAccept() {
    setBusy(true)
    setError(null)
    try {
      const { organizationId } = await acceptOrganizationInvite(token)
      onAccepted(organizationId)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'Не удалось принять приглашение',
      )
    } finally {
      setBusy(false)
    }
  }

  const canAccept =
    preview !== null &&
    preview.status === 'pending' &&
    !preview.alreadyMember &&
    !busy

  const orangeGlow = alpha(theme.palette.primary.main, 0.14)

  return (
    <Box sx={{ width: '100%', maxWidth: 560, mx: 'auto' }}>
      <Paper
        elevation={0}
        sx={{
          ...sectionSurfacePaddingSx,
          position: 'relative',
          overflow: 'hidden',
          borderRadius: 2,
          border: `1px solid ${theme.palette.divider}`,
          background: `linear-gradient(145deg, ${orangeGlow} 0%, ${theme.palette.background.paper} 42%, ${theme.palette.background.paper} 100%)`,
        }}
      >
        <Stack spacing={2}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <GroupsOutlinedIcon
              sx={{ fontSize: 28, color: 'primary.main', opacity: 0.95 }}
            />
            <Typography
              variant="overline"
              sx={{
                letterSpacing: '0.12em',
                color: 'text.secondary',
                fontWeight: 600,
              }}
            >
              Приглашение в организацию
            </Typography>
          </Stack>

          <Typography
            variant="h4"
            component="h1"
            sx={{
              fontWeight: 700,
              letterSpacing: '-0.03em',
              lineHeight: 1.15,
              fontSize: { xs: '1.5rem', sm: '1.85rem' },
            }}
          >
            {loading
              ? 'Загрузка…'
              : preview
                ? preview.organizationName
                : 'Приглашение'}
          </Typography>

          {error ? (
            <Alert severity="error" onClose={() => setError(null)}>
              {error}
            </Alert>
          ) : null}

          {loading ? (
            <Stack
              spacing={1.5}
              sx={{ alignItems: 'center', justifyContent: 'center', py: 4 }}
            >
              <CircularProgress size={28} />
              <Typography variant="body2" color="text.secondary">
                Проверяем ссылку-приглашение…
              </Typography>
            </Stack>
          ) : preview ? (
            <>
              {preview.alreadyMember ? (
                <Alert severity="info">
                  Вы уже состоите в этой организации.
                </Alert>
              ) : preview.status === 'pending' ? (
                <Typography variant="body1" color="text.secondary">
                  Вас пригласили вступить в организацию. После принятия вы
                  получите роль участника и сможете видеть общие пресеты.
                </Typography>
              ) : (
                <Alert severity="warning">
                  Это приглашение недоступно: {statusLabel(preview.status)}.
                </Alert>
              )}

              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={1}
                sx={{ pt: 1 }}
              >
                {canAccept ? (
                  <Button
                    variant="contained"
                    color="primary"
                    size="large"
                    disabled={busy}
                    onClick={() => void handleAccept()}
                    sx={{ borderRadius: 1.5, minWidth: 140 }}
                  >
                    {busy ? (
                      <CircularProgress color="inherit" size={22} thickness={5} />
                    ) : (
                      'Вступить'
                    )}
                  </Button>
                ) : null}
                <Button
                  variant="outlined"
                  color="primary"
                  size="large"
                  disabled={busy}
                  onClick={onDismiss}
                  sx={{ borderRadius: 1.5 }}
                >
                  {preview.alreadyMember || preview.status !== 'pending'
                    ? 'К организациям'
                    : 'Отмена'}
                </Button>
              </Stack>
            </>
          ) : (
            <Button
              variant="outlined"
              color="primary"
              onClick={onDismiss}
              sx={{ borderRadius: 1.5, alignSelf: 'flex-start' }}
            >
              К организациям
            </Button>
          )}
        </Stack>
      </Paper>
    </Box>
  )
}
