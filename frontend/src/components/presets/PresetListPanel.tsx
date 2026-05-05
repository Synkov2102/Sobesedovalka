import { useCallback, useEffect, useMemo, useState } from 'react'
import AddCircleOutlineRoundedIcon from '@mui/icons-material/AddCircleOutlineRounded'
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded'
import EditRoundedIcon from '@mui/icons-material/EditRounded'
import NoteAddRoundedIcon from '@mui/icons-material/NoteAddRounded'
import PlayArrowRoundedIcon from '@mui/icons-material/PlayArrowRounded'
import RefreshRoundedIcon from '@mui/icons-material/RefreshRounded'
import ScheduleRoundedIcon from '@mui/icons-material/ScheduleRounded'
import TopicOutlinedIcon from '@mui/icons-material/TopicOutlined'
import {
  Alert,
  Box,
  Button,
  Chip,
  IconButton,
  Paper,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import {
  deleteTaskPreset,
  fetchTaskPresets,
  startRoomFromPreset,
} from '../../api/taskPresets'
import { sectionSurfacePaddingSx } from '../../theme/layout'
import type { TaskPreset } from '../../types/api.types'

function formatPresetUpdated(iso: string): string {
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

function formatFileCountRu(n: number): string {
  const mod10 = n % 10
  const mod100 = n % 100
  if (mod10 === 1 && mod100 !== 11) {
    return `${n} файл`
  }
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 10 || mod100 >= 20)) {
    return `${n} файла`
  }
  return `${n} файлов`
}

type PresetListPanelProps = {
  onOpenCreate: () => void
  onOpenEdit: (presetId: string) => void
}

export function PresetListPanel({
  onOpenCreate,
  onOpenEdit,
}: PresetListPanelProps) {
  const theme = useTheme()
  const [presets, setPresets] = useState<TaskPreset[]>([])
  const [loading, setLoading] = useState(true)
  const [busyKey, setBusyKey] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  const loadPresets = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const data = await fetchTaskPresets()
      setPresets(data)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Не удалось загрузить пресеты',
      )
      setPresets([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadPresets()
  }, [loadPresets])

  const presetCountLabel = useMemo(() => {
    const n = presets.length
    if (n === 0) {
      return 'Нет сохранённых пресетов'
    }
    if (n === 1) {
      return '1 пресет'
    }
    if (n >= 2 && n <= 4) {
      return `${n} пресета`
    }
    return `${n} пресетов`
  }, [presets.length])

  const orangeGlow = alpha(theme.palette.primary.main, 0.14)

  async function onDelete(id: string) {
    const confirmed = window.confirm('Удалить этот пресет?')
    if (!confirmed) {
      return
    }
    setBusyKey(`delete:${id}`)
    setError(null)
    try {
      await deleteTaskPreset(id)
      setPresets((current) => current.filter((preset) => preset.id !== id))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось удалить пресет')
    } finally {
      setBusyKey(null)
    }
  }

  async function onStartRoom(id: string) {
    setBusyKey(`start:${id}`)
    setError(null)
    try {
      const { roomId } = await startRoomFromPreset(id)
      const next = new URL(window.location.href)
      next.searchParams.set('room', roomId)
      window.location.assign(next.toString())
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Не удалось создать комнату',
      )
      setBusyKey(null)
    }
  }

  return (
    <Box className="presets-list-page" sx={{ width: '100%' }}>
      <Paper
        elevation={0}
        component="header"
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
            top: -40,
            right: -28,
            width: 168,
            height: 168,
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
              <TopicOutlinedIcon
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
                Шаблоны для собеседований
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
              Пресеты заданий
            </Typography>
            <Typography
              variant="body1"
              color="text.secondary"
              sx={{
                maxWidth: 560,
                lineHeight: 1.6,
              }}
            >
              Сохраняйте набор файлов как заготовку и запускайте новую{' '}
              <Box component="span" sx={{ color: 'primary.light' }}>
                комнату
              </Box>{' '}
              с этим кодом — участники попадут в общий редактор и превью.
            </Typography>
            {!loading ? (
              <Typography
                variant="caption"
                color="text.secondary"
                sx={{ display: 'block', mt: 1.5 }}
              >
                {presetCountLabel}
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
            <Tooltip title="Обновить список пресетов">
              <span>
                <IconButton
                  onClick={() => void loadPresets()}
                  disabled={loading || busyKey !== null}
                  aria-label="Обновить список пресетов"
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
              onClick={onOpenCreate}
              startIcon={<AddCircleOutlineRoundedIcon />}
              sx={{
                px: 2.5,
                py: 1.25,
                borderRadius: 1.5,
                boxShadow: `0 8px 24px ${alpha(theme.palette.primary.main, 0.25)}`,
              }}
            >
              Новый пресет
            </Button>
          </Stack>
        </Stack>
      </Paper>

      {error ? (
        <Alert severity="error" sx={{ mb: 2.5 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      ) : null}

      <Typography variant="h6" component="h2" sx={{ fontWeight: 600, mb: 2 }}>
        Мои пресеты
      </Typography>

      {loading ? (
        <Stack spacing={2}>
          {[0, 1, 2].map((key) => (
            <Paper
              key={key}
              variant="outlined"
              sx={{
                p: 2.25,
                borderRadius: 2,
                borderColor: 'divider',
              }}
            >
              <Skeleton variant="text" width="48%" height={26} sx={{ mb: 1 }} />
              <Skeleton
                variant="text"
                width="92%"
                height={18}
                sx={{ mb: 1.5 }}
              />
              <Stack
                direction="row"
                spacing={0.75}
                sx={{ flexWrap: 'wrap', mb: 2 }}
              >
                <Skeleton
                  variant="rounded"
                  width={72}
                  height={24}
                  sx={{ borderRadius: 2 }}
                />
                <Skeleton
                  variant="rounded"
                  width={88}
                  height={24}
                  sx={{ borderRadius: 2 }}
                />
              </Stack>
              <Skeleton
                variant="rounded"
                width={200}
                height={36}
                sx={{ borderRadius: 1.5 }}
              />
            </Paper>
          ))}
        </Stack>
      ) : presets.length === 0 ? (
        <Paper
          variant="outlined"
          sx={{
            py: { xs: 5, sm: 6 },
            px: 3,
            textAlign: 'center',
            borderRadius: 2,
            borderStyle: 'dashed',
            borderColor: alpha(theme.palette.divider, 0.9),
            bgcolor: alpha(theme.palette.background.paper, 0.5),
          }}
        >
          <TopicOutlinedIcon
            sx={{
              fontSize: 52,
              color: 'text.secondary',
              opacity: 0.45,
              mb: 2,
            }}
          />
          <Typography variant="h6" sx={{ fontWeight: 600, mb: 1 }}>
            Пока нет пресетов
          </Typography>
          <Typography
            variant="body2"
            color="text.secondary"
            sx={{ maxWidth: 400, mx: 'auto', mb: 3 }}
          >
            Создайте первый шаблон на отдельной странице: файлы станут стартовым
            кодом новой комнаты по кнопке «Запустить комнату».
          </Typography>
          <Button
            variant="contained"
            color="primary"
            size="large"
            onClick={onOpenCreate}
            startIcon={<NoteAddRoundedIcon />}
            sx={{ borderRadius: 1.5 }}
          >
            Создать пресет
          </Button>
        </Paper>
      ) : (
        <Stack
          spacing={2}
          component="ul"
          sx={{ listStyle: 'none', m: 0, p: 0 }}
        >
          {presets.map((preset) => {
            const filePaths = Object.keys(preset.files).sort((a, b) =>
              a.localeCompare(b),
            )
            return (
              <Paper
                key={preset.id}
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
                  <Box sx={{ flex: 1, minWidth: 0, p: 2.25, pl: 2 }}>
                    <Stack spacing={1.75}>
                      <Box sx={{ minWidth: 0 }}>
                        <Typography
                          variant="h6"
                          component="h3"
                          sx={{
                            fontWeight: 600,
                            fontSize: '1.05rem',
                            lineHeight: 1.35,
                            mb: 0.5,
                            wordBreak: 'break-word',
                          }}
                        >
                          {preset.title}
                        </Typography>
                        {preset.description ? (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              mt: 0.5,
                              lineHeight: 1.5,
                            }}
                          >
                            {preset.description}
                          </Typography>
                        ) : null}
                        <Stack
                          direction="row"
                          spacing={0.75}
                          sx={{
                            mt: 1.25,
                            mb: 1,
                            alignItems: 'center',
                            flexWrap: 'wrap',
                          }}
                        >
                          <ScheduleRoundedIcon
                            sx={{
                              fontSize: 18,
                              color: 'text.secondary',
                              opacity: 0.85,
                            }}
                          />
                          <Typography variant="caption" color="text.secondary">
                            Обновлён {formatPresetUpdated(preset.updatedAt)} ·{' '}
                            {formatFileCountRu(filePaths.length)}
                          </Typography>
                        </Stack>
                        <Stack
                          direction="row"
                          spacing={0.75}
                          sx={{ flexWrap: 'wrap', gap: 0.75 }}
                        >
                          {filePaths.map((path) => (
                            <Chip
                              key={path}
                              label={path}
                              size="small"
                              variant="outlined"
                              sx={{
                                fontFamily:
                                  'ui-monospace, SFMono-Regular, Consolas, monospace',
                                fontSize: '0.75rem',
                                height: 'auto',
                                maxWidth: '100%',
                                '& .MuiChip-label': {
                                  whiteSpace: 'normal',
                                  wordBreak: 'break-all',
                                  lineHeight: 1.35,
                                  py: 0.35,
                                },
                              }}
                            />
                          ))}
                        </Stack>
                      </Box>
                      <Stack
                        direction={{ xs: 'column', sm: 'row' }}
                        spacing={1}
                        sx={{
                          flexWrap: 'wrap',
                          alignItems: { xs: 'stretch', sm: 'center' },
                        }}
                      >
                        <Button
                          variant="contained"
                          color="primary"
                          size="small"
                          onClick={() => void onStartRoom(preset.id)}
                          disabled={busyKey !== null}
                          startIcon={
                            <PlayArrowRoundedIcon sx={{ fontSize: 20 }} />
                          }
                          sx={{ borderRadius: 1.5 }}
                        >
                          Запустить комнату
                        </Button>
                        <Button
                          variant="outlined"
                          color="secondary"
                          size="small"
                          onClick={() => onOpenEdit(preset.id)}
                          disabled={busyKey !== null}
                          startIcon={<EditRoundedIcon sx={{ fontSize: 18 }} />}
                        >
                          Редактировать
                        </Button>
                        <Button
                          variant="outlined"
                          color="error"
                          size="small"
                          onClick={() => void onDelete(preset.id)}
                          disabled={busyKey !== null}
                          startIcon={
                            <DeleteOutlineRoundedIcon sx={{ fontSize: 18 }} />
                          }
                        >
                          Удалить
                        </Button>
                      </Stack>
                    </Stack>
                  </Box>
                </Stack>
              </Paper>
            )
          })}
        </Stack>
      )}
    </Box>
  )
}
