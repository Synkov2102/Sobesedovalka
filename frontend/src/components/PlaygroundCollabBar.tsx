import { useMemo } from 'react'
import { Box, Chip, Stack, Tooltip, Typography } from '@mui/material'
import { alpha, useTheme } from '@mui/material/styles'
import type { CollabPeerDTO } from '../collab/collab.types'
import { peerAccentRgbCss } from '../collab/peerColor'
import { normalizeSandpackFilePath } from '../collab/sandpackPaths'
import { useWorkspace } from '../workspace/WorkspaceContext'

const BAR_HEIGHT_PX = 20

export function PlaygroundCollabBar({
  collabPeers,
  selfClientId,
}: {
  collabPeers: CollabPeerDTO[]
  selfClientId: string
}) {
  const theme = useTheme()
  const workspace = useWorkspace()

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

  return (
    <Box
      className="playground__collabBar"
      role="status"
      aria-live="polite"
      aria-label="Участники совместного редактирования"
      sx={{
        flexShrink: 0,
        height: BAR_HEIGHT_PX,
        minHeight: BAR_HEIGHT_PX,
        display: 'flex',
        alignItems: 'center',
        px: 1,
        border: `1px solid ${theme.palette.divider}`,
        bgcolor: alpha(theme.palette.background.paper, 0.92),
        overflow: 'hidden',
        borderRadius: 4,
        mt: 1,
      }}
    >
      {sortedPeers.length === 0 ? (
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ fontSize: '0.65rem', lineHeight: 1, px: 0.5 }}
        >
          Подключение…
        </Typography>
      ) : (
        <Box
          sx={{
            overflowX: 'auto',
            overflowY: 'hidden',
            width: '100%',
            scrollbarWidth: 'none',
            '&::-webkit-scrollbar': { display: 'none' },
          }}
        >
          <Stack
            direction="row"
            spacing={1.5}
            sx={{
              flexWrap: 'nowrap',
              alignItems: 'center',
              width: 'max-content',
              minWidth: '100%',
              height: BAR_HEIGHT_PX,
            }}
          >
            {sortedPeers.map((p) => {
              const path = normalizeSandpackFilePath(p.activeFile)
              const canOpen = Boolean(
                path && workspace.files[path] !== undefined,
              )
              const isSelf = p.clientId === selfClientId
              const isAway = p.cursorAway === true
              const accentCss = peerAccentRgbCss(p)
              const presenceMain = isAway
                ? theme.palette.error.main
                : theme.palette.success.main
              const tooltipLines = [
                path ? path : 'Файл не выбран',
                `Курсор: ${p.line}:${p.col}`,
                isAway ? 'Вне страницы' : 'На странице',
                canOpen ? 'Нажмите, чтобы открыть файл' : undefined,
              ].filter(Boolean)
              const tooltipTitle = tooltipLines.join('\n')

              const handleClick = () => {
                if (canOpen && path) {
                  workspace.openFile(path)
                }
              }

              return (
                <Tooltip
                  key={p.clientId}
                  title={tooltipTitle}
                  arrow
                  placement="top"
                >
                  <Box
                    component="button"
                    type="button"
                    onClick={handleClick}
                    disabled={!canOpen}
                    aria-label={
                      canOpen
                        ? `Открыть файл ${path}, который смотрит ${p.displayName}`
                        : `${p.displayName}, ${isAway ? 'вне страницы' : 'на странице'}`
                    }
                    sx={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 0.625,
                      flexShrink: 0,
                      height: BAR_HEIGHT_PX,
                      px: 0.625,
                      m: 0,
                      border: 0,
                      borderRadius: 0.5,
                      bgcolor: 'transparent',
                      color: 'text.primary',
                      font: 'inherit',
                      cursor: canOpen ? 'pointer' : 'default',
                      opacity: canOpen ? 1 : 0.85,
                      '&:hover:enabled': {
                        bgcolor: alpha(theme.palette.primary.main, 0.08),
                      },
                      '&:disabled': {
                        cursor: 'default',
                      },
                    }}
                  >
                    <Box
                      aria-hidden
                      sx={{
                        width: 6,
                        height: 6,
                        borderRadius: '50%',
                        flexShrink: 0,
                        bgcolor: accentCss,
                      }}
                    />
                    <Typography
                      component="span"
                      noWrap
                      sx={{
                        fontSize: '0.65rem',
                        lineHeight: 1,
                        fontWeight: isSelf ? 700 : 500,
                        maxWidth: 120,
                      }}
                    >
                      {p.displayName}
                      {isSelf ? ' (вы)' : ''}
                    </Typography>
                    <Chip
                      label={isAway ? 'off' : 'on'}
                      size="small"
                      aria-hidden
                      sx={{
                        flexShrink: 0,
                        height: 14,
                        ml: 0.25,
                        bgcolor: alpha(presenceMain, 0.18),
                        color: presenceMain,
                        border: `1px solid ${alpha(presenceMain, 0.55)}`,
                        '& .MuiChip-label': {
                          px: 0.55,
                          py: 0,
                          fontSize: '0.58rem',
                          fontWeight: 700,
                          letterSpacing: '0.04em',
                          textTransform: 'lowercase',
                        },
                      }}
                    />
                  </Box>
                </Tooltip>
              )
            })}
          </Stack>
        </Box>
      )}
    </Box>
  )
}
