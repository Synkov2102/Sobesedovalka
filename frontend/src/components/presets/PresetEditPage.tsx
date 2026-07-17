import {
  Alert,
  Box,
  Button,
  CircularProgress,
  FormControl,
  InputLabel,
  MenuItem,
  Paper,
  Select,
  Stack,
  TextField,
  Typography,
  type SelectChangeEvent,
} from '@mui/material'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { fetchOrganizations } from '../../api/organizations'
import { fetchTaskPreset, updateTaskPreset } from '../../api/taskPresets'
import { sectionSurfacePaddingSx } from '../../theme/layout'
import type {
  OrganizationListItem,
  TaskPreset,
  TaskPresetVisibility,
} from '../../types/api.types'
import {
  PresetSandpackWorkspace,
  type PresetSandpackWorkspaceHandle,
} from './PresetSandpackWorkspace'

function isSandpackCryptoAvailable(): boolean {
  if (typeof window === 'undefined') {
    return true
  }
  return (
    window.isSecureContext === true &&
    typeof globalThis.crypto?.subtle?.digest === 'function'
  )
}

type PresetEditPageProps = {
  presetId: string
  onBackToList: () => void
}

export function PresetEditPage({
  presetId,
  onBackToList,
}: PresetEditPageProps) {
  const sandpackRef = useRef<PresetSandpackWorkspaceHandle | null>(null)
  const [preset, setPreset] = useState<TaskPreset | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadingPreset, setLoadingPreset] = useState(true)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<TaskPresetVisibility>('private')
  const [organizationId, setOrganizationId] = useState('')
  const [organizations, setOrganizations] = useState<OrganizationListItem[]>([])
  const [orgsLoading, setOrgsLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const stableInitialFiles = useMemo(() => {
    if (!preset) {
      return undefined
    }
    return preset.files
  }, [preset])

  const stableInitialSolutionFiles = useMemo(() => {
    if (!preset) {
      return undefined
    }
    return preset.solutionFiles ?? {}
  }, [preset])

  const loadPreset = useCallback(async () => {
    setLoadingPreset(true)
    setLoadError(null)
    setPreset(null)
    try {
      const data = await fetchTaskPreset(presetId)
      setPreset(data)
      setTitle(data.title)
      setDescription(data.description ?? '')
      setVisibility(data.visibility ?? 'private')
      setOrganizationId(data.organizationId ?? '')
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : 'Не удалось загрузить пресет',
      )
    } finally {
      setLoadingPreset(false)
    }
  }, [presetId])

  useEffect(() => {
    void loadPreset()
  }, [loadPreset])

  useEffect(() => {
    let alive = true
    void (async () => {
      try {
        const list = await fetchOrganizations()
        if (alive) {
          setOrganizations(list)
        }
      } catch {
        if (alive) {
          setOrganizations([])
        }
      } finally {
        if (alive) {
          setOrgsLoading(false)
        }
      }
    })()
    return () => {
      alive = false
    }
  }, [])

  function handleVisibilityChange(event: SelectChangeEvent) {
    const next = event.target.value as TaskPresetVisibility
    setVisibility(next)
    if (next === 'private') {
      setOrganizationId('')
    } else if (!organizationId && organizations.length === 1) {
      setOrganizationId(organizations[0].id)
    }
  }

  async function handleSavePreset() {
    const t = title.trim()
    if (!t) {
      setError('Укажите название пресета')
      return
    }
    if (visibility === 'organization' && !organizationId) {
      setError('Выберите организацию для шаринга пресета')
      return
    }

    const exported = sandpackRef.current?.getExport()
    if (!exported || exported.files.length === 0) {
      setError(
        exported?.solutionFiles.length
          ? 'Нужен хотя бы один стартовый файл — не все файлы могут быть решением'
          : 'Не удалось прочитать файлы редактора — обновите страницу',
      )
      return
    }

    setBusy(true)
    setError(null)
    try {
      await updateTaskPreset(presetId, {
        title: t,
        description: description.trim() || undefined,
        files: exported.files,
        solutionFiles: exported.solutionFiles,
        visibility,
        ...(visibility === 'organization'
          ? { organizationId }
          : {}),
      })
      onBackToList()
    } catch (err) {
      setError(
        err instanceof Error ? err.message : 'Не удалось сохранить пресет',
      )
    } finally {
      setBusy(false)
    }
  }

  if (loadingPreset) {
    return (
      <Box
        sx={{
          flex: 1,
          minHeight: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          py: 6,
        }}
      >
        <Stack spacing={2} sx={{ alignItems: 'center' }}>
          <CircularProgress />
          <Typography color="text.secondary">Загрузка пресета…</Typography>
        </Stack>
      </Box>
    )
  }

  if (loadError || !preset) {
    return (
      <Box sx={{ flex: 1, minHeight: 0, py: 2 }}>
        <Alert severity="error" sx={{ mb: 2 }}>
          {loadError ?? 'Пресет не найден'}
        </Alert>
        <Button variant="outlined" onClick={onBackToList}>
          К списку пресетов
        </Button>
      </Box>
    )
  }

  if (preset.access !== 'owner') {
    return (
      <Box sx={{ flex: 1, minHeight: 0, py: 2 }}>
        <Alert severity="warning" sx={{ mb: 2 }}>
          Редактировать можно только свои пресеты. Клонируйте пресет из списка,
          чтобы получить свою копию.
        </Alert>
        <Button variant="outlined" onClick={onBackToList}>
          К списку пресетов
        </Button>
      </Box>
    )
  }

  const formDisabled = busy || !isSandpackCryptoAvailable()

  return (
    <Box
      className="preset-edit-page"
      sx={{
        flex: 1,
        minHeight: 0,
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Paper
        component="section"
        variant="outlined"
        aria-label="Название и описание пресета"
        sx={{
          flexShrink: 0,
          ...sectionSurfacePaddingSx,
          borderRadius: 2,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          mb: 1,
        }}
      >
        <Stack spacing={1.25}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1}
            sx={{
              alignItems: { xs: 'stretch', sm: 'flex-start' },
              justifyContent: 'space-between',
            }}
          >
            <Typography variant="subtitle1" sx={{ fontWeight: 700, pt: 0.25 }}>
              Редактировать пресет
            </Typography>
            <Button
              variant="contained"
              color="primary"
              size="medium"
              disabled={formDisabled || !title.trim()}
              onClick={() => void handleSavePreset()}
              sx={{ borderRadius: 1.5, flexShrink: 0 }}
            >
              Сохранить изменения
            </Button>
          </Stack>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1.5}
            sx={{ alignItems: 'stretch' }}
          >
            <TextField
              id="edit-preset-title"
              label="Название пресета"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Например: React todo с багом в фильтрации"
              slotProps={{ htmlInput: { maxLength: 120 } }}
              disabled={formDisabled}
              fullWidth
              required
              size="small"
              sx={{ flex: { md: 1 }, minWidth: 0 }}
            />
            <TextField
              id="edit-preset-description"
              label="Описание"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Задание и ожидаемый результат"
              slotProps={{ htmlInput: { maxLength: 1000 } }}
              disabled={formDisabled}
              fullWidth
              size="small"
              multiline
              minRows={2}
              maxRows={4}
              sx={{ flex: { md: 1.2 }, minWidth: 0 }}
            />
          </Stack>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={1.5}
            sx={{ alignItems: 'stretch' }}
          >
            <FormControl size="small" sx={{ minWidth: 200, flex: 1 }} disabled={formDisabled}>
              <InputLabel id="edit-preset-visibility-label">
                Видимость
              </InputLabel>
              <Select
                labelId="edit-preset-visibility-label"
                id="edit-preset-visibility"
                label="Видимость"
                value={visibility}
                onChange={handleVisibilityChange}
              >
                <MenuItem value="private">Только я</MenuItem>
                <MenuItem
                  value="organization"
                  disabled={organizations.length === 0 && !orgsLoading}
                >
                  Организация
                </MenuItem>
              </Select>
            </FormControl>
            {visibility === 'organization' ? (
              <FormControl
                size="small"
                sx={{ minWidth: 220, flex: 1.2 }}
                disabled={formDisabled || orgsLoading}
                required
              >
                <InputLabel id="edit-preset-org-label">Организация</InputLabel>
                <Select
                  labelId="edit-preset-org-label"
                  id="edit-preset-org"
                  label="Организация"
                  value={organizationId}
                  onChange={(e) => setOrganizationId(e.target.value)}
                >
                  {organizations.map((org) => (
                    <MenuItem key={org.id} value={org.id}>
                      {org.name}
                    </MenuItem>
                  ))}
                </Select>
              </FormControl>
            ) : null}
          </Stack>
          <Typography variant="caption" color="text.secondary">
            В проводнике ПКМ по файлу → «Пометить как решение»: эти файлы не
            попадут в комнату кандидатам, их увидит только ведущий.
          </Typography>
        </Stack>
      </Paper>

      {error ? (
        <Alert
          severity="error"
          sx={{ flexShrink: 0, mt: 1, mx: { xs: 0.5, sm: 0 } }}
          onClose={() => setError(null)}
        >
          {error}
        </Alert>
      ) : null}

      {!isSandpackCryptoAvailable() ? (
        <Alert
          severity="warning"
          sx={{ flexShrink: 0, mt: 1, mx: { xs: 0.5, sm: 0 } }}
        >
          Редактор с превью (Sandpack) нужен в безопасном контексте: откройте
          приложение по HTTPS или с localhost — иначе <code>crypto.subtle</code>{' '}
          недоступен и сборка превью не запускается.
        </Alert>
      ) : null}

      {isSandpackCryptoAvailable() ? (
        <Box
          sx={{
            flex: 1,
            minHeight: 0,
            minWidth: 0,
            display: 'flex',
            flexDirection: 'column',
            mt: 1,
          }}
        >
          <PresetSandpackWorkspace
            ref={sandpackRef}
            key={preset.id}
            initialFiles={stableInitialFiles}
            initialSolutionFiles={stableInitialSolutionFiles}
          />
        </Box>
      ) : null}
    </Box>
  )
}
