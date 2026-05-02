import { useCallback, useEffect, useState } from 'react'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import MeetingRoomOutlinedIcon from '@mui/icons-material/MeetingRoomOutlined'
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded'
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
  Tooltip,
  Typography,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import {
  createCollabRoom,
  deleteCollabRoom,
  fetchCollabRooms,
} from '../api/collabRooms'
import { sectionSurfacePaddingSx } from '../theme/layout'
import type { CollabRoomSummary } from '../types/api.types'

type RoomsPanelProps = {
  onOpenRoom: (roomId: string) => void
}

function formatRoomUpdated(iso: string): string {
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

function buildInviteUrl(roomId: string): string {
  const u = new URL(window.location.href)
  u.searchParams.set('room', roomId)
  return u.toString()
}

export function RoomsPanel({ onOpenRoom }: RoomsPanelProps) {
  const theme = useTheme()
  const [rooms, setRooms] = useState<CollabRoomSummary[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [busyCreate, setBusyCreate] = useState(false)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [deleteTarget, setDeleteTarget] = useState<CollabRoomSummary | null>(
    null,
  )
  const [snackbarOpen, setSnackbarOpen] = useState(false)

  const isDeletingRoom =
    deleteTarget !== null &&
    busyKey === `delete:${deleteTarget.roomId}`

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchCollabRooms()
      setRooms(data)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Не удалось загрузить комнаты',
      )
      setRooms([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  async function handleCreate() {
    setBusyCreate(true)
    setError(null)
    try {
      const created = await createCollabRoom()
      await load()
      onOpenRoom(created.roomId)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Не удалось создать комнату',
      )
    } finally {
      setBusyCreate(false)
    }
  }

  function closeDeleteDialog() {
    if (isDeletingRoom) {
      return
    }
    setDeleteTarget(null)
  }

  async function confirmDeleteRoom() {
    if (!deleteTarget) {
      return
    }
    const roomId = deleteTarget.roomId
    setBusyKey(`delete:${roomId}`)
    setError(null)
    try {
      await deleteCollabRoom(roomId)
      setRooms((current) =>
        current ? current.filter((r) => r.roomId !== roomId) : current,
      )
      setDeleteTarget(null)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Не удалось удалить комнату',
      )
    } finally {
      setBusyKey(null)
    }
  }

  async function copyInviteLink(roomId: string) {
    const url = buildInviteUrl(roomId)
    try {
      await navigator.clipboard.writeText(url)
      setSnackbarOpen(true)
    } catch {
      setError(
        'Не удалось скопировать ссылку — разрешите доступ к буферу обмена',
      )
    }
  }

  const count = rooms?.length ?? 0
  const orangeGlow = alpha(theme.palette.primary.main, 0.14)

  return (
    <Box className="rooms-page" sx={{ width: '100%' }}>
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
              <MeetingRoomOutlinedIcon
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
                Живая коллаборация
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
              Комнаты
            </Typography>
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{
                maxWidth: 560,
                lineHeight: 1.6,
              }}
            >
              Одна комната — один редактор с кодом и превью. Приглашайте
              участников ссылкой с параметром{' '}
              <Box
                component="code"
                sx={{ fontSize: '0.85em', color: 'primary.light' }}
              >
                room
              </Box>
              ; изменения синхронизируются в реальном времени.
            </Typography>
            {!loading ? (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 1.5 }}
              >
                Всего комнат: <strong>{count}</strong>
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
            <Tooltip title="Обновить список">
              <span>
                <IconButton
                  onClick={() => void load()}
                  disabled={loading || busyCreate || busyKey !== null}
                  aria-label="Обновить список комнат"
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
              disabled={busyCreate || loading || busyKey !== null}
              onClick={() => void handleCreate()}
              startIcon={<AddRoundedIcon />}
              sx={{
                px: 2.5,
                py: 1.25,
                borderRadius: 1.5,
                boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.25)}`,
              }}
            >
              Новая комната
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {error ? (
        <Alert severity="error" sx={{ mb: 2.5 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      {loading ? (
        <Stack spacing={2}>
          {[0, 1, 2].map((key) => (
            <Paper
              key={key}
              variant="outlined"
              sx={{
                p: 2.5,
                borderRadius: 2,
                borderColor: 'divider',
              }}
            >
              <Stack
                direction={{ xs: 'column', sm: 'row' }}
                spacing={2}
                sx={{ justifyContent: 'space-between' }}
              >
                <Box sx={{ flex: 1 }}>
                  <Skeleton
                    variant="text"
                    width="42%"
                    height={28}
                    sx={{ mb: 1 }}
                  />
                  <Skeleton variant="text" width="72%" height={20} />
                  <Skeleton
                    variant="rounded"
                    width={140}
                    height={26}
                    sx={{ mt: 1.5, borderRadius: 2 }}
                  />
                </Box>
                <Skeleton
                  variant="rounded"
                  width={120}
                  height={40}
                  sx={{ borderRadius: 1.5 }}
                />
              </Stack>
            </Paper>
          ))}
        </Stack>
      ) : !rooms?.length ? (
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
          <MeetingRoomOutlinedIcon
            sx={{
              fontSize: 56,
              color: 'text.secondary',
              opacity: 0.45,
              mb: 2,
            }}
          />
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
            Пока нет комнат
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ maxWidth: 420, mx: 'auto', mb: 3 }}
          >
            Создайте первую комнату для собеседования или запустите её из
            пресета на вкладке «Пресеты». После этого здесь появится карточка с
            быстрым входом и копированием ссылки.
          </Typography>
          <Button
            variant="contained"
            color="primary"
            size="large"
            disabled={busyCreate || busyKey !== null}
            onClick={() => void handleCreate()}
            startIcon={<AddRoundedIcon />}
            sx={{ borderRadius: 1.5 }}
          >
            Создать комнату
          </Button>
        </Paper>
      ) : (
        <Stack
          spacing={2}
          component="ul"
          sx={{ listStyle: 'none', m: 0, p: 0 }}
        >
          {rooms.map((room) => (
            <Paper
              key={room.roomId}
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
                      {room.title}
                    </Typography>
                    <Stack
                      direction="row"
                      spacing={0.75}
                      sx={{ mb: 1.25, alignItems: 'center' }}
                    >
                      <ScheduleRoundedIcon
                        sx={{
                          fontSize: 18,
                          color: 'text.secondary',
                          opacity: 0.85,
                        }}
                      />
                      <Typography variant="caption" color="text.secondary">
                        Обновлено {formatRoomUpdated(room.updatedAt)}
                      </Typography>
                    </Stack>
                    <Chip
                      label={room.roomId}
                      size="small"
                      variant="outlined"
                      sx={{
                        height: 'auto',
                        py: 0.35,
                        fontFamily:
                          'ui-monospace, SFMono-Regular, Consolas, monospace',
                        fontSize: '0.75rem',
                        maxWidth: '100%',
                        '& .MuiChip-label': {
                          whiteSpace: 'normal',
                          wordBreak: 'break-all',
                          lineHeight: 1.35,
                        },
                      }}
                    />
                  </Box>

                  <Stack
                    direction={{ xs: 'column', sm: 'row' }}
                    spacing={1}
                    sx={{
                      flexShrink: 0,
                      alignItems: { xs: 'stretch', sm: 'center' },
                    }}
                  >
                    <Tooltip title="Удалить комнату">
                      <span>
                        <IconButton
                          aria-label={`Удалить комнату ${room.title}`}
                          disabled={busyKey !== null}
                          onClick={() => setDeleteTarget(room)}
                          sx={{
                            border: `1px solid ${theme.palette.divider}`,
                            borderRadius: 1.5,
                            color: 'error.main',
                          }}
                        >
                          <DeleteOutlineRoundedIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Копировать ссылку-приглашение">
                      <IconButton
                        edge="start"
                        aria-label={`Копировать ссылку для комнаты ${room.title}`}
                        disabled={busyKey !== null}
                        onClick={() => void copyInviteLink(room.roomId)}
                        sx={{
                          border: `1px solid ${theme.palette.divider}`,
                          borderRadius: 1.5,
                        }}
                      >
                        <ContentCopyRoundedIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                    <Button
                      variant="contained"
                      color="primary"
                      endIcon={<OpenInNewRoundedIcon sx={{ fontSize: 18 }} />}
                      disabled={busyKey !== null}
                      onClick={() => onOpenRoom(room.roomId)}
                      sx={{
                        px: 2.25,
                        borderRadius: 1.5,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      Открыть
                    </Button>
                  </Stack>
                </Stack>
              </Stack>
            </Paper>
          ))}
        </Stack>
      )}

      <Dialog
        open={deleteTarget !== null}
        onClose={() => closeDeleteDialog()}
        role="alertdialog"
        aria-labelledby="rooms-delete-dialog-title"
        aria-describedby="rooms-delete-dialog-description"
        slotProps={{
          paper: {
            sx: {
              borderRadius: 2,
              border: `1px solid ${theme.palette.divider}`,
            },
          },
        }}
      >
        <DialogTitle id="rooms-delete-dialog-title">
          Удалить комнату?
        </DialogTitle>
        <DialogContent>
          <DialogContentText id="rooms-delete-dialog-description">
            Комната{' '}
            <Box component="span" sx={{ fontWeight: 600 }}>
              «{deleteTarget?.title ?? ''}»
            </Box>{' '}
            будет удалена без возможности восстановления: файлы и данные
            коллаборации в базе будут стёрты.
          </DialogContentText>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button
            onClick={closeDeleteDialog}
            disabled={isDeletingRoom}
            sx={{ borderRadius: 1.5 }}
          >
            Отмена
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={isDeletingRoom}
            onClick={() => void confirmDeleteRoom()}
            sx={{ borderRadius: 1.5, minWidth: 120 }}
          >
            {isDeletingRoom ? (
              <CircularProgress color="inherit" size={22} thickness={5} />
            ) : (
              'Удалить'
            )}
          </Button>
        </DialogActions>
      </Dialog>

      <Snackbar
        open={snackbarOpen}
        autoHideDuration={3200}
        onClose={() => setSnackbarOpen(false)}
        message="Ссылка скопирована в буфер обмена"
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  )
}
