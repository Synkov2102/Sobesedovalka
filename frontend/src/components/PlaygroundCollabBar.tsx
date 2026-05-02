import { useMemo } from 'react'
import { useSandpack } from '@codesandbox/sandpack-react'
import {
  Avatar,
  Box,
  Button,
  Chip,
  Paper,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import type { CollabPeerDTO } from '../collab/collab.types'
import { peerAccentRgbCss } from '../collab/peerColor'
import { normalizeSandpackFilePath } from '../collab/sandpackPaths'

function peerInitials(displayName: string): string {
  const parts = displayName.trim().split(/\s+/).filter(Boolean)
  if (parts.length >= 2) {
    return `${parts[0]!.slice(0, 1)}${parts[1]!.slice(0, 1)}`.toUpperCase()
  }
  const single = parts[0] ?? displayName.trim()
  return (single.slice(0, 2) || '?').toUpperCase()
}

function fileBasename(activeFile: string): string {
  const path = normalizeSandpackFilePath(activeFile)
  if (!path) {
    return ''
  }
  const segments = path.split('/').filter(Boolean)
  return segments[segments.length - 1] ?? path
}

export function PlaygroundCollabBar({
  collabPeers,
  selfClientId,
}: {
  collabPeers: CollabPeerDTO[]
  selfClientId: string
}) {
  const theme = useTheme()
  const { sandpack } = useSandpack()

  const sortedPeers = useMemo(() => {
    const next = [...collabPeers]
    next.sort((a, b) => {
      if (a.clientId === selfClientId) {
        return -1
      }
      if (b.clientId === selfClientId) {
        return 1
      }
      return a.displayName.localeCompare(b.displayName, 'ru', {
        sensitivity: 'base',
      })
    })
    return next
  }, [collabPeers, selfClientId])

  const accentBg = alpha(theme.palette.primary.main, 0.06)

  return (
    <Paper
      elevation={0}
      role="status"
      aria-live="polite"
      aria-label="Участники совместного редактирования"
      sx={{
        flexShrink: 0,
        px: { xs: 1.5, sm: 2 },
        py: 1.25,
        mb: 1.5,
        borderRadius: 2,
        border: `1px solid ${theme.palette.divider}`,
        background: `linear-gradient(135deg, ${accentBg} 0%, ${theme.palette.background.paper} 48%)`,
      }}
    >
      {sortedPeers.length === 0 ? (
        <Typography
          variant="body2"
          color="text.secondary"
          sx={{ py: 0.25, px: 0.5 }}
        >
          Подключение к участникам…
        </Typography>
      ) : (
        <Box
          sx={{
            overflowX: 'auto',
            overflowY: 'hidden',
            pb: 0.25,
            mx: -0.25,
            px: 0.25,
            scrollbarGutter: 'stable',
          }}
        >
          <Stack
            direction="row"
            spacing={1.25}
            sx={{
              flexWrap: 'nowrap',
              alignItems: 'stretch',
              width: 'max-content',
              minWidth: '100%',
            }}
          >
            {sortedPeers.map((p) => {
              const path = normalizeSandpackFilePath(p.activeFile)
              const canOpen = Boolean(path && sandpack.files[path])
              const base = fileBasename(p.activeFile)
              const accentCss = peerAccentRgbCss(p)
              const contrast = theme.palette.getContrastText(accentCss)
              const isSelf = p.clientId === selfClientId
              const tooltipLines = [
                path ? path : 'Файл не выбран',
                `Курсор: ${p.line}:${p.col}`,
              ]
              const tooltipTitle = tooltipLines.join('\n')

              return (
                <Paper
                  key={p.clientId}
                  variant="outlined"
                  sx={{
                    flex: '0 0 auto',
                    maxWidth: 'min(320px, 85vw)',
                    borderRadius: 2,
                    borderColor: alpha(accentCss, 0.38),
                    bgcolor: alpha(accentCss, 0.07),
                    boxShadow: `inset 3px 0 0 0 ${accentCss}`,
                  }}
                >
                  <Stack
                    direction="row"
                    spacing={1.25}
                    sx={{
                      px: 1.25,
                      py: 1,
                      minWidth: 0,
                      alignItems: 'center',
                    }}
                  >
                    <Tooltip title={tooltipTitle} arrow placement="top">
                      <Avatar
                        sx={{
                          width: 36,
                          height: 36,
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          bgcolor: accentCss,
                          color: contrast,
                          flexShrink: 0,
                          border: `1px solid ${alpha(accentCss, 0.35)}`,
                        }}
                        aria-hidden
                      >
                        {peerInitials(p.displayName)}
                      </Avatar>
                    </Tooltip>
                    <Stack sx={{ minWidth: 0, flex: 1 }} spacing={0.35}>
                      <Stack
                        direction="row"
                        spacing={0.75}
                        sx={{ minWidth: 0, alignItems: 'center' }}
                      >
                        <Typography
                          variant="subtitle2"
                          component="span"
                          noWrap
                          sx={{ fontWeight: 650, letterSpacing: '-0.01em' }}
                          title={p.displayName}
                        >
                          {p.displayName}
                        </Typography>
                        {isSelf ? (
                          <Chip
                            label="Вы"
                            size="small"
                            sx={{
                              height: 22,
                              flexShrink: 0,
                              '& .MuiChip-label': { px: 0.85, fontSize: '0.7rem' },
                            }}
                          />
                        ) : null}
                      </Stack>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        noWrap
                        sx={{
                          fontFamily:
                            'ui-monospace, SFMono-Regular, Consolas, monospace',
                          letterSpacing: '0.02em',
                        }}
                        title={path ?? undefined}
                      >
                        {base || '—'} · {p.line}:{p.col}
                      </Typography>
                    </Stack>
                    <Tooltip
                      title={
                        canOpen
                          ? `Открыть ${path}`
                          : path
                            ? 'Файла нет в текущем проекте'
                            : 'Файл не выбран'
                      }
                    >
                      <span>
                        <Button
                          size="small"
                          variant="outlined"
                          disabled={!canOpen}
                          onClick={() => {
                            if (canOpen && path) {
                              sandpack.openFile(path)
                            }
                          }}
                          sx={{
                            flexShrink: 0,
                            borderRadius: 1.5,
                            px: 1,
                            py: 0.35,
                            fontSize: '0.75rem',
                            fontWeight: 600,
                            borderColor: alpha(accentCss, 0.45),
                            color: theme.palette.text.primary,
                            '&:hover': {
                              borderColor: alpha(accentCss, 0.75),
                              bgcolor: alpha(accentCss, 0.12),
                            },
                          }}
                          aria-label={`Открыть файл, который смотрит ${p.displayName}`}
                        >
                          К файлу
                        </Button>
                      </span>
                    </Tooltip>
                  </Stack>
                </Paper>
              )
            })}
          </Stack>
        </Box>
      )}
    </Paper>
  )
}
