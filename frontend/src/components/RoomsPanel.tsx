import { useCallback, useEffect, useState } from 'react'
import AddRoundedIcon from '@mui/icons-material/AddRounded'
import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import HistoryRoundedIcon from '@mui/icons-material/HistoryRounded'
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
  fetchCollabPageLeaveEvents,
  fetchCollabPasteEvents,
  fetchCollabRooms,
} from '../api/collabRooms'
import { sectionSurfacePaddingSx } from '../theme/layout'
import type {
  CollabPageLeaveEvent,
  CollabPasteEvent,
  CollabRoomSummary,
} from '../types/api.types'

type RoomsPanelProps = {
  onOpenRoom: (roomId: string) => void
}

type RoomHistoryEntry =
  | {
      id: string
      kind: 'paste'
      createdAt: string
      event: CollabPasteEvent
    }
  | {
      id: string
      kind: 'page-leave'
      createdAt: string
      event: CollabPageLeaveEvent
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

function buildRoomHistoryEntries(
  pasteEvents: CollabPasteEvent[] | null,
  pageLeaveEvents: CollabPageLeaveEvent[] | null,
): RoomHistoryEntry[] {
  const pasteEntries = (pasteEvents ?? []).map((event, index) => ({
    id: `paste:${event.createdAt}:${event.clientId}:${index}`,
    kind: 'paste' as const,
    createdAt: event.createdAt,
    event,
  }))
  const pageLeaveEntries = (pageLeaveEvents ?? []).map((event, index) => ({
    id: `page-leave:${event.createdAt}:${event.clientId}:${index}`,
    kind: 'page-leave' as const,
    createdAt: event.createdAt,
    event,
  }))

  return [...pasteEntries, ...pageLeaveEntries].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  )
}

function getPasteFileSegments(event: CollabPasteEvent) {
  const fileContent = event.fileContent || event.content
  const start = Math.min(
    Math.max(0, event.insertStartOffset ?? 0),
    fileContent.length,
  )
  const end = Math.min(
    Math.max(start, event.insertEndOffset ?? start + event.content.length),
    fileContent.length,
  )
  return {
    before: fileContent.slice(0, start),
    inserted: fileContent.slice(start, end),
    after: fileContent.slice(end),
  }
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
  const [historyTarget, setHistoryTarget] = useState<CollabRoomSummary | null>(
    null,
  )
  const [pasteEvents, setPasteEvents] = useState<CollabPasteEvent[] | null>(
    null,
  )
  const [pageLeaveEvents, setPageLeaveEvents] = useState<
    CollabPageLeaveEvent[] | null
  >(null)
  const [historyLoading, setHistoryLoading] = useState(false)
  const [historyError, setHistoryError] = useState<string | null>(null)
  const [snackbarOpen, setSnackbarOpen] = useState(false)

  const isDeletingRoom =
    deleteTarget !== null && busyKey === `delete:${deleteTarget.roomId}`
  const historyEntries = buildRoomHistoryEntries(pasteEvents, pageLeaveEvents)

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

  async function openRoomHistory(room: CollabRoomSummary) {
    setHistoryTarget(room)
    setPasteEvents(null)
    setPageLeaveEvents(null)
    setHistoryError(null)
    setHistoryLoading(true)
    try {
      const [events, leaveEvents] = await Promise.all([
        fetchCollabPasteEvents(room.roomId),
        fetchCollabPageLeaveEvents(room.roomId),
      ])
      setPasteEvents(events)
      setPageLeaveEvents(leaveEvents)
    } catch (err) {
      setHistoryError(
        err instanceof Error
          ? err.message
          : 'Не удалось загрузить историю комнаты',
      )
      setPasteEvents([])
      setPageLeaveEvents([])
    } finally {
      setHistoryLoading(false)
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
                      variant="outlined"
                      color="secondary"
                      startIcon={<HistoryRoundedIcon sx={{ fontSize: 18 }} />}
                      disabled={busyKey !== null}
                      onClick={() => void openRoomHistory(room)}
                      sx={{
                        px: 1.75,
                        borderRadius: 1.5,
                        whiteSpace: 'nowrap',
                      }}
                    >
                      История комнаты
                    </Button>
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

      <Dialog
        open={historyTarget !== null}
        onClose={() => setHistoryTarget(null)}
        maxWidth="md"
        fullWidth
        aria-labelledby="rooms-history-dialog-title"
        slotProps={{
          paper: {
            sx: {
              borderRadius: 2,
              border: `1px solid ${theme.palette.divider}`,
            },
          },
        }}
      >
        <DialogTitle id="rooms-history-dialog-title">
          История комнаты «{historyTarget?.title ?? ''}»
        </DialogTitle>
        <DialogContent dividers>
          <Stack spacing={2} sx={{ mb: 2 }}>
            <Typography variant="body2" color="text.secondary">
              Здесь собираются ключевые моменты комнаты: вставки пользователей и
              уходы курсора со страницы собеседования.
            </Typography>
            <Stack
              direction="row"
              spacing={1}
              sx={{ flexWrap: 'wrap', gap: 1 }}
            >
              <Chip
                size="small"
                color="primary"
                variant="outlined"
                label={`Вставки: ${pasteEvents?.length ?? 0}`}
              />
              <Chip
                size="small"
                variant="outlined"
                label={`Уходы со страницы: ${pageLeaveEvents?.length ?? 0}`}
              />
            </Stack>
          </Stack>
          {historyLoading ? (
            <Stack
              spacing={1.5}
              sx={{ alignItems: 'center', justifyContent: 'center', py: 5 }}
            >
              <CircularProgress size={28} />
              <Typography variant="body2" color="text.secondary">
                Загружаем историю комнаты…
              </Typography>
            </Stack>
          ) : historyError ? (
            <Alert severity="error">{historyError}</Alert>
          ) : !historyEntries.length ? (
            <Typography color="text.secondary">
              В этой комнате пока нет зафиксированных ключевых событий.
            </Typography>
          ) : (
            <Stack spacing={2}>
              {historyEntries.map((entry) => {
                const segments =
                  entry.kind === 'paste'
                    ? getPasteFileSegments(entry.event)
                    : null
                return (
                  <Paper
                    key={entry.id}
                    variant="outlined"
                    sx={{
                      p: 2,
                      borderRadius: 2,
                      borderColor: 'divider',
                      bgcolor: alpha(theme.palette.background.paper, 0.7),
                    }}
                  >
                    <Stack spacing={1}>
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1}
                        sx={{
                          justifyContent: 'space-between',
                          alignItems: { xs: 'flex-start', sm: 'center' },
                        }}
                      >
                        <Stack spacing={0.75}>
                          <Chip
                            size="small"
                            color={
                              entry.kind === 'paste' ? 'secondary' : 'warning'
                            }
                            variant="outlined"
                            label={
                              entry.kind === 'paste'
                                ? 'Вставка пользователя'
                                : 'Курсор ушёл со страницы'
                            }
                            sx={{ alignSelf: 'flex-start' }}
                          />
                          <Typography
                            variant="subtitle2"
                            sx={{ fontWeight: 700 }}
                          >
                            {entry.event.displayName}
                          </Typography>
                        </Stack>
                        <Typography variant="caption" color="text.secondary">
                          {formatRoomUpdated(entry.event.createdAt)}
                        </Typography>
                      </Stack>
                      {entry.kind === 'paste' && segments ? (
                        <>
                          <Typography variant="caption" color="text.secondary">
                            {entry.event.path}:{entry.event.line}:
                            {entry.event.col} · файл после вставки
                          </Typography>
                          <Box
                            component="pre"
                            sx={{
                              m: 0,
                              p: 1.5,
                              borderRadius: 1.5,
                              bgcolor: alpha(theme.palette.common.black, 0.28),
                              color: 'text.primary',
                              fontFamily:
                                'ui-monospace, SFMono-Regular, Consolas, monospace',
                              fontSize: '0.8rem',
                              lineHeight: 1.55,
                              maxHeight: 360,
                              overflow: 'auto',
                              whiteSpace: 'pre-wrap',
                              wordBreak: 'break-word',
                            }}
                          >
                            {segments.before}
                            <Box
                              component="span"
                              sx={{
                                bgcolor: alpha(
                                  theme.palette.success.main,
                                  0.32,
                                ),
                                color: 'success.light',
                                borderRadius: 0.5,
                              }}
                            >
                              {segments.inserted}
                            </Box>
                            {segments.after}
                          </Box>
                          {entry.event.truncated ? (
                            <Typography
                              variant="caption"
                              color="text.secondary"
                            >
                              Показаны первые {entry.event.content.length}{' '}
                              символов из {entry.event.contentLength}.
                            </Typography>
                          ) : null}
                        </>
                      ) : (
                        <Typography variant="body2" color="text.secondary">
                          Пользователь вывел курсор за пределы страницы
                          собеседования.
                        </Typography>
                      )}
                    </Stack>
                  </Paper>
                )
              })}
            </Stack>
          )}
        </DialogContent>
        <DialogActions sx={{ px: 3, py: 2 }}>
          <Button
            onClick={() => setHistoryTarget(null)}
            sx={{ borderRadius: 1.5 }}
          >
            Закрыть
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
