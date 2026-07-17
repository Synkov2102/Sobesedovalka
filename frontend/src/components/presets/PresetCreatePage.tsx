import {
  Alert,
  Box,
  Button,
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
import { useEffect, useState, useRef } from 'react'
import { fetchOrganizations } from '../../api/organizations'
import { createTaskPreset } from '../../api/taskPresets'
import { sectionSurfacePaddingSx } from '../../theme/layout'
import type {
  OrganizationListItem,
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

type PresetCreatePageProps = {
  onBackToList: () => void
}

export function PresetCreatePage({ onBackToList }: PresetCreatePageProps) {
  const sandpackRef = useRef<PresetSandpackWorkspaceHandle | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [visibility, setVisibility] = useState<TaskPresetVisibility>('private')
  const [organizationId, setOrganizationId] = useState('')
  const [organizations, setOrganizations] = useState<OrganizationListItem[]>([])
  const [orgsLoading, setOrgsLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

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
      await createTaskPreset({
        title: t,
        description: description.trim() || undefined,
        files: exported.files,
        solutionFiles: exported.solutionFiles,
        visibility,
        organizationId:
          visibility === 'organization' ? organizationId : undefined,
      })
      onBackToList()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Не удалось создать пресет')
    } finally {
      setBusy(false)
    }
  }

  const formDisabled = busy || !isSandpackCryptoAvailable()

  return (
    <Box
      className="preset-create-page"
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
              Создать пресет
            </Typography>
            <Button
              variant="contained"
              color="primary"
              size="medium"
              disabled={formDisabled || !title.trim()}
              onClick={() => void handleSavePreset()}
              sx={{ borderRadius: 1.5, flexShrink: 0 }}
            >
              Сохранить пресет
            </Button>
          </Stack>
          <Stack
            direction={{ xs: 'column', md: 'row' }}
            spacing={1.5}
            sx={{ alignItems: 'stretch' }}
          >
            <TextField
              id="create-preset-title"
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
              id="create-preset-description"
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
              <InputLabel id="create-preset-visibility-label">
                Видимость
              </InputLabel>
              <Select
                labelId="create-preset-visibility-label"
                id="create-preset-visibility"
                label="Видимость"
                value={visibility}
                onChange={handleVisibilityChange}
              >
                <MenuItem value="private">Только я</MenuItem>
                <MenuItem value="organization" disabled={organizations.length === 0 && !orgsLoading}>
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
                <InputLabel id="create-preset-org-label">Организация</InputLabel>
                <Select
                  labelId="create-preset-org-label"
                  id="create-preset-org"
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
          {visibility === 'organization' &&
          !orgsLoading &&
          organizations.length === 0 ? (
            <Typography variant="caption" color="warning.main">
              Нет организаций — создайте организацию, чтобы шарить пресет.
            </Typography>
          ) : null}
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
          <PresetSandpackWorkspace ref={sandpackRef} />
        </Box>
      ) : null}
    </Box>
  )
}
